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
}

export function createSql(options: DatabaseOptions = {}): Sql {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example and README › Database)");
  return postgres(url, {
    max: options.max ?? 10,
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
