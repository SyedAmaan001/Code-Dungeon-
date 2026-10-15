/**
 * Privileged Supabase calls (server only). The secret key never leaves the server:
 * this module imports "server-only", so a Client Component importing it fails the build.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AdminConfig } from "./config";

/** Delete a Supabase Auth user by id. Throws if Supabase does not confirm the deletion. */
export async function deleteSupabaseUser(
  config: NonNullable<AdminConfig>,
  userId: string,
): Promise<void> {
  const admin = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error)
    throw new Error(`Supabase refused to delete the user (${error.status ?? "no status"})`);
}
