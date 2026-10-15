/**
 * Turning a provider session into a verified identity (docs/auth-design.md §2).
 *
 * Supabase: `auth.getUser()` sends the access token to Supabase Auth, which verifies it
 * (signature, expiry, revocation) and returns the user. Cookie contents are never
 * trusted on their own. Users without a confirmed email are rejected (DEC-009).
 */
import { DEV_PROVIDER, verifyDevSession } from "./dev-session";

export const SUPABASE_PROVIDER = "supabase";

export interface VerifiedIdentity {
  /** `supabase` or, in development only, `dev`. Stored in players.auth_provider. */
  provider: string;
  /** Provider user id (never an email). Stored in players.auth_subject. */
  subject: string;
}

export type IdentityResult =
  | { status: "signed_in"; identity: VerifiedIdentity }
  | { status: "signed_out" }
  | { status: "email_unverified" };

/** The part of the Supabase client this module uses (lets tests stub it). */
export interface SupabaseUserSource {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email_confirmed_at?: string | null } | null };
      error: unknown;
    }>;
  };
}

export async function resolveSupabaseIdentity(client: SupabaseUserSource): Promise<IdentityResult> {
  let user: { id: string; email_confirmed_at?: string | null } | null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return { status: "signed_out" };
    user = data.user;
  } catch {
    // Fail closed: if the session cannot be verified, the visitor is treated as signed out.
    return { status: "signed_out" };
  }
  if (!user || typeof user.id !== "string" || user.id === "") return { status: "signed_out" };
  if (!user.email_confirmed_at) return { status: "email_unverified" };
  return { status: "signed_in", identity: { provider: SUPABASE_PROVIDER, subject: user.id } };
}

export function resolveDevIdentity(
  token: string | undefined,
  secret: string,
  now = new Date(),
): IdentityResult {
  const subject = verifyDevSession(token, secret, now);
  return subject
    ? { status: "signed_in", identity: { provider: DEV_PROVIDER, subject } }
    : { status: "signed_out" };
}
