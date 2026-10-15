/**
 * OAuth and magic-link return URL (PKCE): exchanges the one-time code for a session.
 * Only used in Supabase mode. Redirects stay on APP_URL with a sanitised `next` path.
 */
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth/config";
import { safeNext } from "@/auth/redirect";
import { supabaseServerClient } from "@/auth/server";

export async function GET(request: NextRequest) {
  const config = authConfig();
  if (config.mode !== "supabase") return NextResponse.redirect(new URL("/sign-in", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServerClient(config);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, config.appUrl));
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", config.appUrl));
}
