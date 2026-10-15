import { cpSync, mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { migrate, migrationStatus, readMigrations } from "@/db/migrate";
import { createTestDatabase, describeDb, MIGRATIONS_DIR, type TestDatabase } from "../support/db";

const PLAYER_TABLES = [
  "action_rate_limits",
  "challenge_progress",
  "checkpoints",
  "encounters",
  "level_progress",
  "player_achievements",
  "player_paths",
  "players",
  "quest_progress",
  "reward_items",
  "submissions",
  "xp_ledger",
];

describeDb("migrations", () => {
  let db: TestDatabase;
  beforeAll(async () => {
    db = await createTestDatabase({ migrate: false });
  });
  afterAll(() => db.drop());

  it("apply to an empty database, then re-run as a no-op", async () => {
    const first = await migrate(db.sql, MIGRATIONS_DIR);
    const all = ["0001_initial", "0002_age_check", "0003_action_rate_limits"];
    expect(first).toEqual({ applied: all, alreadyApplied: [] });
    const second = await migrate(db.sql, MIGRATIONS_DIR);
    expect(second).toEqual({ applied: [], alreadyApplied: all });
    expect(await migrationStatus(db.sql, MIGRATIONS_DIR)).toEqual(
      all.map((migration) => ({ migration, state: "applied" })),
    );
  });

  it("refuses an edited, already-applied migration", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cd-migrations-"));
    cpSync(MIGRATIONS_DIR, dir, { recursive: true });
    appendFileSync(join(dir, "0001_initial.sql"), "\n-- edited after release\n");
    await expect(migrate(db.sql, dir)).rejects.toThrow(/was changed after it was applied/);
    expect((await migrationStatus(db.sql, dir))[0]!.state).toBe("changed!");
  });

  it("rejects badly named migration files", () => {
    const dir = mkdtempSync(join(tmpdir(), "cd-migrations-"));
    appendFileSync(join(dir, "initial.sql"), "SELECT 1;");
    expect(() => readMigrations(dir)).toThrow(/must look like 0001_name.sql/);
  });

  it("enables row-level security with a policy on every player table", async () => {
    const tables = await db.sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relname <> 'schema_migrations'
      ORDER BY relname`;
    expect(tables.map((t) => t.relname)).toEqual(PLAYER_TABLES);
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
    const policies = await db.sql<
      { tablename: string }[]
    >`SELECT tablename FROM pg_policies WHERE schemaname = 'public'`;
    expect(new Set(policies.map((p) => p.tablename))).toEqual(new Set(PLAYER_TABLES));
  });

  it("creates a least-privilege application role", async () => {
    const [role] = await db.sql`
      SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'code_dungeon_app'`;
    expect(role).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      rolcanlogin: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
    const [grants] = await db.sql`
      SELECT has_table_privilege('code_dungeon_app', 'xp_ledger', 'UPDATE') AS ledger_update,
             has_table_privilege('code_dungeon_app', 'xp_ledger', 'DELETE') AS ledger_delete,
             has_table_privilege('code_dungeon_app', 'schema_migrations', 'SELECT') AS migrations_select,
             has_function_privilege('public', 'leaderboard_records(text)', 'EXECUTE') AS public_leaderboard`;
    expect(grants).toEqual({
      ledger_update: false,
      ledger_delete: false,
      migrations_select: false,
      public_leaderboard: false,
    });
  });
});
