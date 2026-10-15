/**
 * Server-side session and authorization (the data-access boundary for identity).
 *
 * Every protected page and every server action calls `requirePlayer()` or
 * `playerForAction()`. They resolve the session on the server (Supabase verifies the
 * token; the dev token is HMAC-checked), map the verified identity to a player id
 * through `player_id_for_identity` (RLS-scoped), and only then touch player data.
 * The proxy's redirect is an optimisation, never the check.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRuntime } from "@/services/runtime";
import type { AccountProfile } from "@/services/postgres-player-store";
import { authConfig, type AuthConfig } from "./config";
import { DEV_SESSION_COOKIE } from "./dev-session";
import { resolveDevIdentity, resolveSupabaseIdentity, type IdentityResult } from "./identity";

export async function supabaseServerClient(config: Extract<AuthConfig, { mode: "supabase" }>) {
  const store = await cookies();
  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The verified identity for this request (memoised per request). */
export const getIdentity = cache(async (): Promise<IdentityResult & { config: AuthConfig }> => {
  const config = authConfig();
  if (config.mode === "dev") {
    const token = (await cookies()).get(DEV_SESSION_COOKIE)?.value;
    return { ...resolveDevIdentity(token, config.secret), config };
  }
  if (config.mode === "supabase") {
    return { ...(await resolveSupabaseIdentity(await supabaseServerClient(config))), config };
  }
  return { status: "signed_out", config };
});

export type SessionState =
  | { state: "signed_out"; config: AuthConfig }
  | { state: "email_unverified"; config: AuthConfig }
  | { state: "needs_onboarding"; config: AuthConfig; provider: string; subject: string }
  | { state: "player"; config: AuthConfig; player: AccountProfile };

/** Identity plus the linked player profile, if any (memoised per request). */
export const getSession = cache(async (): Promise<SessionState> => {
  const id = await getIdentity();
  if (id.status === "signed_out") return { state: "signed_out", config: id.config };
  if (id.status === "email_unverified") return { state: "email_unverified", config: id.config };
  const { accounts } = getRuntime();
  const playerId = await accounts.playerIdForIdentity(id.identity.provider, id.identity.subject);
  const player = playerId ? await accounts.get(playerId) : undefined;
  if (!player) return { state: "needs_onboarding", config: id.config, ...id.identity };
  return { state: "player", config: id.config, player };
});

/** For pages: the signed-in player, or a redirect to sign-in / onboarding. */
export async function requirePlayer(): Promise<AccountProfile> {
  const session = await getSession();
  if (session.state === "player") return session.player;
  if (session.state === "needs_onboarding") redirect("/onboarding");
  redirect(session.state === "email_unverified" ? "/sign-in?error=unverified" : "/sign-in");
}

/** For server actions: the signed-in player, or null (the action answers "signed_out"). */
export async function playerForAction(): Promise<AccountProfile | null> {
  const session = await getSession();
  return session.state === "player" ? session.player : null;
}
