"use server";
/**
 * Onboarding (handle + neutral 13+ age check, DEC-010) and profile settings.
 * The player id always comes from the verified session, never from the form.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_POLICY, checkAge } from "@/auth/age";
import { getIdentity, playerForAction } from "@/auth/server";
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
