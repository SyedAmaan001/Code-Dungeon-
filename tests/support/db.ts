/**
 * Database test support. Each test file gets its own throwaway database, migrated from
 * db/migrations, and dropped afterwards.
 *
 * TEST_DATABASE_URL must point at a PostgreSQL server where the user may CREATE DATABASE
 * (local: `npm run db:local -- start`; CI: a postgres:16 service). Without it the database
 * suites are skipped — unless REQUIRE_DB_TESTS=1 (set in CI), which makes them fail instead.
 */
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { describe } from "vitest";
import { createSql, type Sql } from "@/db/client";
import { migrate } from "@/db/migrate";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations", import.meta.url));

if (process.env.REQUIRE_DB_TESTS === "1" && !TEST_DATABASE_URL)
  throw new Error("REQUIRE_DB_TESTS=1 but TEST_DATABASE_URL is not set");

/** `describe` for suites that need PostgreSQL. */
export const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

export interface TestDatabase {
  url: string;
  sql: Sql;
  drop(): Promise<void>;
}

/** Create an empty database (optionally migrated) and return a connection to it. */
export async function createTestDatabase(
  options: { migrate?: boolean } = {},
): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
  const name = `cd_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const sql = createSql({ url: url.toString(), max: 10 });
  if (options.migrate !== false) await migrate(sql, MIGRATIONS_DIR);
  return {
    url: url.toString(),
    sql,
    async drop() {
      await sql.end();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
