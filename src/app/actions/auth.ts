"use server";
/**
 * Sign-in and sign-out actions. Supabase mode: Google OAuth and email magic link
 * (DEC-009; no passwords). Dev mode: a signed development cookie, refused in production.
 * Redirect targets are fixed to APP_URL and a sanitised `next` path — never request headers.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth/config";
import {
  DEV_SESSION_COOKIE,
  DEV_SESSION_TTL_SECONDS,
  normaliseDevName,
  signDevSession,
} from "@/auth/dev-session";
import { safeNext } from "@/auth/redirect";
import { supabaseServerClient } from "@/auth/server";

export type AuthFormState =
  { status: "idle" } | { status: "error"; message: string } | { status: "sent" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function callbackUrl(appUrl: string, next: string) {
  return `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const config = authConfig();
  if (config.mode !== "supabase") redirect("/sign-in");
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await supabaseServerClient(config);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(config.appUrl, next) },
  });
  if (error || !data.url) redirect("/sign-in?error=google");
  redirect(data.url);
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const config = authConfig();
  if (config.mode !== "supabase")
    return { status: "error", message: "Email sign-in is not configured here." };
  const email = String(formData.get("email") ?? "").trim();
  if (email.length > 254 || !EMAIL.test(email))
    return { status: "error", message: "Enter a valid email address." };
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await supabaseServerClient(config);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(config.appUrl, next), shouldCreateUser: true },
  });
  // Same answer whether or not the address has an account (no account enumeration).
  if (error)
    return {
      status: "error",
      message: "We couldn't send a sign-in link just now. Wait a minute and try again.",
    };
  return { status: "sent" };
}

export async function devSignIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const config = authConfig();
  if (config.mode !== "dev")
    return { status: "error", message: "The development sign-in is not enabled." };
  const name = normaliseDevName(String(formData.get("name") ?? ""));
  if (!name)
    return {
      status: "error",
      message: "Use 2–32 lowercase letters, digits or hyphens, starting with a letter.",
    };
  (await cookies()).set(DEV_SESSION_COOKIE, signDevSession(name, config.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEV_SESSION_TTL_SECONDS,
  });
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signOut(): Promise<void> {
  const config = authConfig();
  if (config.mode === "supabase") await (await supabaseServerClient(config)).auth.signOut();
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/");
}
