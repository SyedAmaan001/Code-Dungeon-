/**
 * Migration 0006 (DEC-022): on a host with Supabase-style Data API roles and default grants,
 * those roles end up with no access to any Code Dungeon table, sequence or function, now or
 * for objects created later, while the application role keeps its own grants.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { migrate } from "@/db/migrate";
import { createTestDatabase, describeDb, MIGRATIONS_DIR, type TestDatabase } from "../support/db";

const API_ROLES = ["anon", "authenticated", "service_role"];

describeDb("Data API lockdown (migration 0006)", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase({ migrate: false });
    // Simulate the hosted defaults: API roles exist and get everything created in public.
    for (const r of API_ROLES)
      await db.sql.unsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${r}') THEN CREATE ROLE ${r} NOLOGIN; END IF; END $$`,
      );
    const roles = API_ROLES.join(", ");
    await db.sql.unsafe(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${roles};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${roles};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${roles};
      GRANT USAGE ON SCHEMA public TO ${roles};`);
    await migrate(db.sql, MIGRATIONS_DIR);
  });
  afterAll(() => db.drop());

  it("leaves the API roles no privilege on any table or function in public", async () => {
    const leaks = await db.sql`
      SELECT r.rolname, c.relname AS object
      FROM pg_class c CROSS JOIN pg_roles r
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'S', 'v')
        AND r.rolname IN ${db.sql(API_ROLES)}
        AND (has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
             OR (c.relkind = 'S' AND has_sequence_privilege(r.oid, c.oid, 'USAGE')))
      UNION ALL
      SELECT r.rolname, p.proname
      FROM pg_proc p CROSS JOIN pg_roles r
      WHERE p.pronamespace = 'public'::regnamespace AND r.rolname IN ${db.sql(API_ROLES)}
        AND has_function_privilege(r.oid, p.oid, 'EXECUTE')`;
    expect(leaks).toEqual([]);
  });

  it("refuses an anonymous Data API caller on tables and SECURITY DEFINER functions", async () => {
    for (const query of [
      "SELECT * FROM schema_migrations",
      "SELECT * FROM leaderboard_records('python-fundamentals')",
      "SELECT account_rate_limit_hit('identity:" + "a".repeat(64) + ":onboarding', 60, 5)",
    ])
      await expect(
        db.sql.begin(async (tx) => {
          await tx.unsafe("SET LOCAL ROLE anon");
          return tx.unsafe(query);
        }),
      ).rejects.toMatchObject({ code: "42501" });
  });

  it("keeps future objects closed to the API roles", async () => {
    await db.sql`CREATE TABLE later_table (id int)`;
    const [row] = await db.sql`SELECT has_table_privilege('anon', 'later_table', 'SELECT') AS ok`;
    expect(row!.ok).toBe(false);
    await db.sql`DROP TABLE later_table`;
  });

  it("keeps the application role's own grants", async () => {
    const [row] = await db.sql`
      SELECT has_function_privilege('code_dungeon_app', 'app_current_player()', 'EXECUTE') AS fn,
             has_function_privilege('code_dungeon_app', 'leaderboard_page(text, integer, integer)', 'EXECUTE') AS page,
             has_table_privilege('code_dungeon_app', 'players', 'SELECT') AS players`;
    expect(row).toEqual({ fn: true, page: true, players: true });
  });
});
