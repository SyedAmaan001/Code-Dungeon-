/**
 * Recreate the end-to-end test database (code_dungeon_e2e) and apply migrations.
 * Needs TEST_DATABASE_URL (an admin connection that may CREATE/DROP DATABASE).
 * Local/CI only: it drops the e2e database, never any other.
 */
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createSql } from "../../src/db/client";
import { migrate } from "../../src/db/migrate";
import { e2eDatabaseUrl, E2E_DATABASE } from "./config";

const admin = process.env.TEST_DATABASE_URL;
if (!admin) {
  console.error("TEST_DATABASE_URL is not set (see README › End-to-end tests).");
  process.exit(1);
}

const root = postgres(admin, { max: 1, onnotice: () => {} });
await root.unsafe(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
await root.unsafe(`CREATE DATABASE ${E2E_DATABASE}`);
await root.end();

const sql = createSql({ url: e2eDatabaseUrl(admin), max: 1 });
const result = await migrate(sql, fileURLToPath(new URL("../../db/migrations", import.meta.url)));
await sql.end();
console.log(`e2e database ready (${result.applied.length} migration(s) applied)`);
