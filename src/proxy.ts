/**
 * Next.js proxy (formerly middleware). Two jobs only:
 *   1. Supabase mode: refresh the auth session cookies before pages render.
 *   2. Redirect visitors who are clearly signed out away from protected routes early.
 * It is an optimisation. Authorization happens on the server in every protected page
 * and server action (src/auth/server.ts) — never here alone.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, supabaseCookieOptions } from "@/auth/config";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/auth/dev-session";
import { isProtectedPath } from "@/auth/redirect";

function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const config = authConfig();
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  if (config.mode === "supabase") {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(config.supabaseUrl, config.publishableKey, {
      cookieOptions: supabaseCookieOptions(process.env),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (protectedPath && !user) return toSignIn(request);
    return response;
  }

  if (protectedPath) {
    const signedIn =
      config.mode === "dev" &&
      verifyDevSession(request.cookies.get(DEV_SESSION_COOKIE)?.value, config.secret) !== undefined;
    if (!signedIn) return toSignIn(request);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
