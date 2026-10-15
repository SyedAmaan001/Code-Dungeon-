"use server";
/**
 * Onboarding (handle + neutral 13+ age check, DEC-010), profile settings and account
 * deletion. The player id always comes from the verified session, never from the form.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_POLICY, checkAge } from "@/auth/age";
import { readAdminConfig } from "@/auth/config";
import { DEV_PROVIDER, DEV_SESSION_COOKIE } from "@/auth/dev-session";
import { SUPABASE_PROVIDER } from "@/auth/identity";
import { getIdentity, playerForAction, supabaseServerClient } from "@/auth/server";
import { deleteSupabaseUser } from "@/auth/supabase-admin";
import { getRuntime } from "@/services/runtime";

export type OnboardingState =
  { status: "idle" } | { status: "error"; message: string } | { status: "too_young" };

/** Discourages immediately re-entering a different birth year (stores no age data). */
const AGE_GATE_COOKIE = "cd_age_gate";

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const id = await getIdentity();
  if (id.status !== "signed_in") redirect("/sign-in");
  const { accounts } = getRuntime();
  if (await accounts.playerIdForIdentity(id.identity.provider, id.identity.subject))
    redirect("/play");

  const jar = await cookies();
  if (jar.get(AGE_GATE_COOKIE)?.value === "blocked") return { status: "too_young" };

  const age = checkAge(
    { birthYear: formData.get("birthYear"), birthMonth: formData.get("birthMonth") },
    new Date(),
  );
  if (!age.ok) return { status: "error", message: age.reason };
  if (!age.eligible) {
    jar.set(AGE_GATE_COOKIE, "blocked", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return { status: "too_young" };
  }

  const created = await accounts.create({
    handle: String(formData.get("handle") ?? ""),
    visible: formData.get("visible") === "on",
    identity: id.identity,
    ageCheck: { policy: AGE_POLICY.id, at: new Date() },
  });
  if (!created.ok) return { status: "error", message: `Choose another name: ${created.reason}.` };
  redirect("/play");
}

export type ProfileState =
  { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const player = await playerForAction();
  if (!player) redirect("/sign-in");
  const result = await getRuntime().accounts.update(player.playerId, {
    handle: String(formData.get("handle") ?? ""),
    visible: formData.get("visible") === "on",
  });
  return result.ok
    ? { status: "saved" }
    : { status: "error", message: `Not saved: ${result.reason}.` };
}

export type DeleteAccountState = { status: "idle" } | { status: "error"; message: string };

/**
 * Delete the signed-in player's account (R-46). Requires typing the exact handle and
 * ticking the acknowledgement. The game data and the sign-in identity are deleted in one
 * database transaction: if the identity provider refuses, nothing is deleted.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const player = await playerForAction();
  if (!player) redirect("/sign-in");
  if (String(formData.get("confirmHandle") ?? "") !== player.handle)
    return { status: "error", message: `Type your handle, ${player.handle}, exactly to confirm.` };
  if (formData.get("acknowledge") !== "on")
    return {
      status: "error",
      message: "Tick the box to confirm you understand this is permanent.",
    };

  const id = await getIdentity();
  if (id.status !== "signed_in") redirect("/sign-in");
  const admin = readAdminConfig(process.env);
  if (id.identity.provider === SUPABASE_PROVIDER && !admin)
    return {
      status: "error",
      message:
        "Account deletion is not available on this server yet: the server-side deletion key is not configured. Nothing was deleted.",
    };

  let deleted: boolean;
  try {
    deleted = await getRuntime().accounts.deleteAccount(player.playerId, async (linked) => {
      // The identity removed must be the one this session signed in with.
      if (
        !linked ||
        linked.provider !== id.identity.provider ||
        linked.subject !== id.identity.subject
      )
        throw new Error("identity mismatch");
      if (linked.provider === SUPABASE_PROVIDER) await deleteSupabaseUser(admin!, linked.subject);
      else if (linked.provider !== DEV_PROVIDER) throw new Error("unknown identity provider");
    });
  } catch (err) {
    console.error(
      "[code-dungeon] account deletion failed",
      err instanceof Error ? err.message : "unknown error",
    );
    return {
      status: "error",
      message: "Your account could not be deleted just now. Nothing was deleted; try again later.",
    };
  }

  if (!deleted) redirect("/onboarding");

  // Signed-in state no longer refers to anything; end the session on this device.
  if (id.config.mode === "supabase")
    await (await supabaseServerClient(id.config)).auth.signOut().catch(() => undefined);
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/account-deleted");
}
