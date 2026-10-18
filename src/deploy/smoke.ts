/**
 * Credential-free deployment smoke test (docs/cloud-plan.md). Read-only: it sends GET requests
 * as an anonymous visitor, never signs in and never writes data, so it is safe against
 * staging or production. Run with `npm run smoke -- <base-url>` (scripts/smoke.ts).
 *
 * It checks what must hold on every deployment: security headers and a fresh script nonce
 * per response, signed-out redirects, the sign-in page, rejection of a forged sign-in code,
 * and no secrets or answer keys in the HTML or the browser JavaScript it references.
 */

export interface SmokeResult {
  name: string;
  ok: boolean;
  detail?: string;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Strings that must never appear in anything sent to a browser. */
export const FORBIDDEN_IN_BROWSER = [
  "DATABASE_URL",
  "postgres://",
  "postgresql://",
  "SUPABASE_SECRET_KEY",
  "sb_secret_",
  "service_role",
  "DEV_AUTH_SECRET",
  "code_dungeon_app",
  "acceptedVariants",
  "createHmac",
];

const NONCE = /'nonce-([A-Za-z0-9+/=]+)'/;

/** Header checks for one HTML response (pure, so they are unit-tested). */
export function checkHeaders(headers: Headers, html: string, https: boolean): SmokeResult[] {
  const csp = headers.get("content-security-policy") ?? "";
  const nonce = NONCE.exec(csp)?.[1];
  const has = (name: string, expected: string) => (headers.get(name) ?? "").includes(expected);
  return [
    {
      name: "CSP has a script nonce with strict-dynamic",
      ok: !!nonce && csp.includes("'strict-dynamic'"),
    },
    { name: "CSP allows no eval or inline scripts", ok: !/unsafe-eval|unsafe-inline/.test(csp) },
    { name: "CSP forbids framing", ok: csp.includes("frame-ancestors 'none'") },
    { name: "page scripts carry the nonce", ok: !!nonce && html.includes(`nonce="${nonce}"`) },
    { name: "X-Frame-Options is DENY", ok: has("x-frame-options", "DENY") },
    { name: "X-Content-Type-Options is nosniff", ok: has("x-content-type-options", "nosniff") },
    {
      name: "Referrer-Policy is set",
      ok: has("referrer-policy", "strict-origin-when-cross-origin"),
    },
    { name: "no X-Powered-By header", ok: headers.get("x-powered-by") === null },
    {
      name: "HSTS on https",
      ok: !https || has("strict-transport-security", "max-age="),
      ...(!https && { detail: "skipped: not https" }),
    },
  ];
}

/** Which forbidden strings a text contains (pure). */
export function findForbidden(text: string): string[] {
  return FORBIDDEN_IN_BROWSER.filter((s) => text.includes(s));
}

export function nonceOf(headers: Headers): string | undefined {
  return NONCE.exec(headers.get("content-security-policy") ?? "")?.[1];
}

/** Script URLs a page references from its own origin (`/_next/...`). */
export function sameOriginScripts(html: string, base: URL): string[] {
  const urls = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1]!, base));
  return [...new Set(urls.filter((u) => u.origin === base.origin).map((u) => u.toString()))];
}

export async function runSmoke(baseUrl: string, fetchImpl: Fetch = fetch): Promise<SmokeResult[]> {
  const base = new URL(baseUrl);
  const at = (path: string) => new URL(path, base).toString();
  const get = (path: string) => fetchImpl(at(path), { redirect: "manual" });
  const results: SmokeResult[] = [];

  const home = await get("/");
  const homeHtml = await home.text();
  results.push({
    name: "GET / returns 200",
    ok: home.status === 200,
    detail: `status ${home.status}`,
  });
  results.push(...checkHeaders(home.headers, homeHtml, base.protocol === "https:"));
  const again = await get("/");
  await again.text();
  const first = nonceOf(home.headers);
  results.push({
    name: "each response gets a fresh nonce",
    ok: !!first && nonceOf(again.headers) !== first,
  });

  const play = await get("/play");
  await play.text();
  const playTarget = play.headers.get("location") ?? "";
  results.push({
    name: "signed-out /play redirects to sign-in",
    ok:
      play.status >= 300 && play.status < 400 && new URL(playTarget, base).pathname === "/sign-in",
    detail: `status ${play.status}`,
  });

  const signIn = await get("/sign-in");
  const signInHtml = await signIn.text();
  results.push({
    name: "GET /sign-in returns 200",
    ok: signIn.status === 200,
    detail: `status ${signIn.status}`,
  });

  const forged = await get("/auth/callback?code=forged-smoke-test-code&next=%2Fplay");
  await forged.text();
  const forgedTarget = new URL(forged.headers.get("location") ?? "/", base);
  results.push({
    name: "a forged sign-in code is refused",
    ok:
      forged.status >= 300 &&
      forged.status < 400 &&
      forgedTarget.pathname === "/sign-in" &&
      forgedTarget.origin === base.origin,
    detail:
      forgedTarget.searchParams.get("error") === "link"
        ? "rejected by Supabase mode"
        : "redirected to sign-in (not in Supabase mode)",
  });

  const scripts = sameOriginScripts(homeHtml + signInHtml, base);
  const leaks = new Set([...findForbidden(homeHtml), ...findForbidden(signInHtml)]);
  for (const src of scripts) {
    const res = await fetchImpl(src);
    for (const s of findForbidden(await res.text())) leaks.add(s);
  }
  results.push({
    name: `no secrets or answer keys in pages and ${scripts.length} script(s)`,
    ok: leaks.size === 0,
    ...(leaks.size > 0 && { detail: `found: ${[...leaks].join(", ")}` }),
  });
  return results;
}
