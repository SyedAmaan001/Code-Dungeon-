/**
 * Production configuration preflight (docs/cloud-plan.md). Pure: takes the environment and
 * returns findings that name variables, never their values, so the output is safe to share.
 * Reuses the app's own rules (readAuthConfig, readAdminConfig, parseContentRelease) instead
 * of restating them, so the preflight and the running app cannot disagree.
 *
 * Run with `npm run config:check` (scripts/config-check.ts).
 */
import { readAdminConfig, readAuthConfig } from "@/auth/config";
import { preparedStatementsEnabled } from "@/db/client";
import { parseContentRelease } from "@/learning/release";

type Env = Record<string, string | undefined>;

export interface Finding {
  level: "error" | "warning";
  /** The environment variable concerned (never its value). */
  name: string;
  message: string;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function databaseFindings(env: Env): Finding[] {
  const raw = (env.DATABASE_URL ?? "").trim();
  if (!raw)
    return [
      { level: "error", name: "DATABASE_URL", message: "is not set; the game cannot start." },
    ];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [{ level: "error", name: "DATABASE_URL", message: "is not a valid connection URL." }];
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    return [{ level: "error", name: "DATABASE_URL", message: "must be a postgres:// URL." }];

  const findings: Finding[] = [];
  const transactionPooler = url.port === "6543" || url.hostname.endsWith(".pooler.supabase.com");
  if (url.port === "6543" && preparedStatementsEnabled(env))
    findings.push({
      level: "error",
      name: "DATABASE_PREPARE",
      message:
        "must be false: DATABASE_URL uses a transaction-mode pooler (port 6543), which does not support prepared statements.",
    });
  const ssl = url.searchParams.get("sslmode");
  if (!LOOPBACK.has(url.hostname) && ssl !== "require" && ssl !== "verify-full")
    findings.push({
      level: "error",
      name: "DATABASE_URL",
      message: "points at a remote server without sslmode=require (or verify-full).",
    });
  const max = Number((env.DATABASE_POOL_MAX ?? "").trim() || "5");
  if (transactionPooler && max > 2)
    findings.push({
      level: "warning",
      name: "DATABASE_POOL_MAX",
      message:
        "should be 1 or 2 per serverless instance behind a pooler (default 5), or many instances can exhaust it.",
    });
  return findings;
}

/** Findings for a production deployment in Supabase mode. Empty errors = ready to deploy. */
export function checkProductionConfig(env: Env): Finding[] {
  const production = { ...env, NODE_ENV: "production" };
  const findings: Finding[] = [];

  const auth = readAuthConfig(production);
  if (auth.mode !== "supabase")
    findings.push({
      level: "error",
      name: "AUTH_MODE",
      message: `production sign-in must be AUTH_MODE=supabase. The app would start with sign-in disabled: ${auth.mode === "disabled" ? auth.reason : "development sign-in is refused in production."}`,
    });
  else if (!readAdminConfig(production))
    findings.push({
      level: "error",
      name: "SUPABASE_SECRET_KEY",
      message:
        "is missing or not a secret key; account deletion would be refused (DEC-015). Set it as a server-only variable.",
    });

  if ((env.DEV_AUTH_SECRET ?? "").trim())
    findings.push({
      level: "warning",
      name: "DEV_AUTH_SECRET",
      message: "is set but never used in production; remove it from the deployment.",
    });

  findings.push(...databaseFindings(env));

  try {
    if (parseContentRelease(env.CONTENT_RELEASE) !== "public")
      findings.push({
        level: "warning",
        name: "CONTENT_RELEASE",
        message:
          "is development: every level is playable, including levels no person has reviewed. Use public for a public release (DEC-011).",
      });
  } catch {
    findings.push({
      level: "error",
      name: "CONTENT_RELEASE",
      message: "must be development or public.",
    });
  }
  return findings;
}
