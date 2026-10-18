/**
 * PostgreSQL connection factory. Server-side only: the connection string is a secret
 * and must never reach a browser bundle (it is read from the environment, never logged).
 */
import postgres from "postgres";

export type Sql = postgres.Sql;

export interface DatabaseOptions {
  /** Defaults to the DATABASE_URL environment variable. */
  url?: string;
  /** Maximum pool size (default 10). */
  max?: number;
  /** Named prepared statements (default: from DATABASE_PREPARE, else on). */
  prepare?: boolean;
}

/**
 * DATABASE_PREPARE=false turns off named prepared statements, which transaction-mode
 * connection poolers (e.g. Supabase's pooler on port 6543) do not support. Anything else
 * keeps the driver default. Every query the app runs is inside a transaction (`scoped()`),
 * so per-transaction settings such as `SET LOCAL ROLE` work through such a pooler.
 */
export function preparedStatementsEnabled(env: Record<string, string | undefined>): boolean {
  return (env.DATABASE_PREPARE ?? "").trim().toLowerCase() !== "false";
}

export function createSql(options: DatabaseOptions = {}): Sql {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example and README › Database)");
  return postgres(url, {
    max: options.max ?? 10,
    prepare: options.prepare ?? preparedStatementsEnabled(process.env),
    onnotice: () => {},
  });
}

/** Redact credentials from a connection string for safe display. */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable connection string)";
  }
}
