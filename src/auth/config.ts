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

export function readAuthConfig(env: Env): AuthConfig {
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
    if (env.NODE_ENV === "production" && !appUrl.startsWith("https:"))
      return { mode: "disabled", reason: "APP_URL must use https in production." };
    return { mode: "supabase", supabaseUrl, publishableKey, appUrl };
  }

  return { mode: "disabled", reason: `Unknown AUTH_MODE "${mode}". ${DISABLED_HELP}` };
}

export function authConfig(): AuthConfig {
  return readAuthConfig(process.env);
}
