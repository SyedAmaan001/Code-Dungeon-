/**
 * Email link confirmation using a token hash (for Supabase email templates that link
 * here instead of /auth/callback). Supabase mode only.
 */
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth/config";
import { safeNext } from "@/auth/redirect";
import { supabaseServerClient } from "@/auth/server";

const ALLOWED: EmailOtpType[] = ["email", "magiclink", "signup"];

export async function GET(request: NextRequest) {
  const config = authConfig();
  if (config.mode !== "supabase") return NextResponse.redirect(new URL("/sign-in", request.url));
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));
  if (tokenHash && type && ALLOWED.includes(type)) {
    const supabase = await supabaseServerClient(config);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, config.appUrl));
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", config.appUrl));
}
