/**
 * Next.js proxy (formerly middleware). Three jobs only:
 *   1. Supabase mode: refresh the auth session cookies before pages render.
 *   2. Redirect visitors who are clearly signed out away from protected routes early.
 *   3. Send a Content-Security-Policy with a fresh script nonce (src/csp.ts).
 * Jobs 1 and 2 are an optimisation. Authorization happens on the server in every protected page
 * and server action (src/auth/server.ts) — never here alone.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, supabaseCookieOptions } from "@/auth/config";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/auth/dev-session";
import { isProtectedPath } from "@/auth/redirect";
import { contentSecurityPolicy, createNonce, CSP_HEADER } from "@/csp";

function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

/** Continue to the page, forwarding the policy so Next.js puts the nonce on its scripts. */
function next(request: NextRequest, csp: string) {
  const headers = new Headers(request.headers);
  headers.set(CSP_HEADER, csp);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const csp = contentSecurityPolicy(createNonce(), process.env.NODE_ENV !== "production");
  const response = await route(request, csp);
  response.headers.set(CSP_HEADER, csp);
  return response;
}

async function route(request: NextRequest, csp: string) {
  const config = authConfig();
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  if (config.mode === "supabase") {
    let response = next(request, csp);
    const supabase = createServerClient(config.supabaseUrl, config.publishableKey, {
      cookieOptions: supabaseCookieOptions(process.env),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = next(request, csp);
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
  return next(request, csp);
}

export const config = {
  // Everything except static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
