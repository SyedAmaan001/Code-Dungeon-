/**
 * Authentication mode, read from the environment (DEC-009).
 *
 *   AUTH_MODE=supabase  Supabase Auth (Google OAuth + email magic link). Needs
 *                       NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, APP_URL.
 *   AUTH_MODE=dev       Development-only sign-in for local play and tests. Needs
 *                       DEV_AUTH_SECRET (32+ characters). Refused when NODE_ENV=production.
 *   unset               Sign-in disabled: protected pages explain that auth is not configured.
 *
 * Pure (takes the environment as an argument) so the rules are unit-tested.
 * No service-role key is ever read: the app only uses the publishable key.
 */

export type AuthConfig =
  | {
      mode: "supabase";
      supabaseUrl: string;
      publishableKey: string;
      /** Public origin used for OAuth and magic-link redirects (never taken from request headers). */
      appUrl: string;
    }
  | { mode: "dev"; secret: string }
  | { mode: "disabled"; reason: string };

type Env = Record<string, string | undefined>;

const DISABLED_HELP =
  "Sign-in is not configured. Set AUTH_MODE=dev for local development, or AUTH_MODE=supabase once a Supabase project is approved.";

function origin(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Names that must never be exposed to the browser through the NEXT_PUBLIC_ prefix. */
function exposedSecretName(env: Env): string | undefined {
  return Object.keys(env).find(
    (k) => k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD/i.test(k),
  );
}

const isLoopback = (origin: string) => {
  const host = new URL(origin).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
};

export function readAuthConfig(env: Env): AuthConfig {
  const exposed = exposedSecretName(env);
  if (exposed)
    return {
      mode: "disabled",
      reason: `${exposed} would be sent to browsers. Secrets must never use the NEXT_PUBLIC_ prefix.`,
    };
  const mode = (env.AUTH_MODE ?? "").trim();
  if (mode === "") return { mode: "disabled", reason: DISABLED_HELP };

  if (mode === "dev") {
    if (env.NODE_ENV === "production")
      return {
        mode: "disabled",
        reason: "The development sign-in cannot be used in a production build.",
      };
    const secret = env.DEV_AUTH_SECRET ?? "";
    if (secret.length < 32)
      return {
        mode: "disabled",
        reason: "AUTH_MODE=dev needs DEV_AUTH_SECRET with at least 32 characters.",
      };
    return { mode: "dev", secret };
  }

  if (mode === "supabase") {
    const supabaseUrl = origin(env.NEXT_PUBLIC_SUPABASE_URL);
    const publishableKey = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
    const appUrl = origin(env.APP_URL);
    if (!supabaseUrl || !publishableKey || !appUrl)
      return {
        mode: "disabled",
        reason:
          "AUTH_MODE=supabase needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and APP_URL.",
      };
    if (publishableKey.startsWith("sb_secret_"))
      return {
        mode: "disabled",
        reason: "A secret key was given as the publishable key. Use the publishable key only.",
      };
    if (env.NODE_ENV === "production" && !appUrl.startsWith("https:") && !isLoopback(appUrl))
      return { mode: "disabled", reason: "APP_URL must use https in production." };
    if (
      env.NODE_ENV === "production" &&
      !supabaseUrl.startsWith("https:") &&
      !isLoopback(supabaseUrl)
    )
      return { mode: "disabled", reason: "NEXT_PUBLIC_SUPABASE_URL must use https in production." };
    return { mode: "supabase", supabaseUrl, publishableKey, appUrl };
  }

  return { mode: "disabled", reason: `Unknown AUTH_MODE "${mode}". ${DISABLED_HELP}` };
}

export function authConfig(): AuthConfig {
  return readAuthConfig(process.env);
}

/**
 * Server-only Supabase admin access, used for one thing: deleting a player's sign-in
 * identity when they delete their account. The key is read from SUPABASE_SECRET_KEY
 * (never NEXT_PUBLIC_*), is not configured until the owner approves it, and is only
 * imported by server code (src/auth/supabase-admin.ts imports "server-only").
 */
export type AdminConfig = { url: string; secretKey: string } | null;

export function readAdminConfig(env: Env): AdminConfig {
  const config = readAuthConfig(env);
  const secretKey = (env.SUPABASE_SECRET_KEY ?? "").trim();
  if (config.mode !== "supabase" || !secretKey) return null;
  if (secretKey.startsWith("sb_publishable_") || secretKey === config.publishableKey) return null;
  return { url: config.supabaseUrl, secretKey };
}

/**
 * Cookie options for Supabase sessions. Code Dungeon only uses Supabase on the server, so
 * session cookies are HttpOnly (scripts cannot read them) and Secure in production.
 */
export function supabaseCookieOptions(env: Env) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
  };
}
