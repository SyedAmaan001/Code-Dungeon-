/**
 * Minimal, reviewable migration runner.
 *
 * - Migrations are plain SQL files in db/migrations named NNNN_description.sql.
 * - Applied in filename order, each in its own transaction, recorded in schema_migrations
 *   with a SHA-256 checksum. Re-running is a no-op; an edited, already-applied migration
 *   is an error (write a new migration instead).
 * - A transaction-level advisory lock prevents two runners applying migrations at once.
 * Run as the database owner (not as code_dungeon_app).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "./client";

export interface Migration {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationReport {
  applied: string[];
  alreadyApplied: string[];
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const LOCK_KEY = 4_217_350_001; // arbitrary constant for pg_advisory_xact_lock

export function readMigrations(dir: string): Migration[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const seen = new Set<string>();
  return files.map((file) => {
    const m = FILE_PATTERN.exec(file);
    if (!m) throw new Error(`migration file name must look like 0001_name.sql: ${file}`);
    if (seen.has(m[1]!)) throw new Error(`duplicate migration version ${m[1]}`);
    seen.add(m[1]!);
    const sql = readFileSync(join(dir, file), "utf8");
    return {
      version: m[1]!,
      name: m[2]!,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    };
  });
}

export async function migrate(sql: Sql, dir: string): Promise<MigrationReport> {
  const migrations = readMigrations(dir);
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
  const report: MigrationReport = { applied: [], alreadyApplied: [] };
  for (const m of migrations) {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const [row] = await tx<
        { checksum: string }[]
      >`SELECT checksum FROM schema_migrations WHERE version = ${m.version}`;
      if (row) {
        if (row.checksum !== m.checksum)
          throw new Error(
            `migration ${m.version}_${m.name} was changed after it was applied; add a new migration instead`,
          );
        report.alreadyApplied.push(`${m.version}_${m.name}`);
        return;
      }
      await tx.unsafe(m.sql);
      await tx`INSERT INTO schema_migrations (version, name, checksum) VALUES (${m.version}, ${m.name}, ${m.checksum})`;
      report.applied.push(`${m.version}_${m.name}`);
    });
  }
  return report;
}

export async function migrationStatus(sql: Sql, dir: string) {
  const exists = await sql`SELECT to_regclass('public.schema_migrations') AS t`;
  const applied = exists[0]?.t
    ? await sql<
        { version: string; checksum: string }[]
      >`SELECT version, checksum FROM schema_migrations`
    : [];
  const byVersion = new Map(applied.map((r) => [r.version, r.checksum]));
  return readMigrations(dir).map((m) => ({
    migration: `${m.version}_${m.name}`,
    state: !byVersion.has(m.version)
      ? "pending"
      : byVersion.get(m.version) === m.checksum
        ? "applied"
        : "changed!",
  }));
}
