/**
 * Content-Security-Policy with a per-request script nonce (R-52, I-15).
 *
 * The proxy (src/proxy.ts) creates a fresh nonce for every page request, sends the
 * policy to the browser, and forwards it on the request so Next.js puts the nonce on
 * its own scripts (every route is rendered per request, so each page gets its nonce).
 * `'strict-dynamic'` lets those trusted scripts load the app's chunks; any other inline
 * or injected script is refused. `'self'` is only a fallback for browsers without CSP 3.
 */
export const CSP_HEADER = "Content-Security-Policy";

/** A random, base64-encoded 128-bit nonce (Web Crypto, so it also runs in the proxy). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** The policy for one response. `dev` adds what `next dev` needs (eval for fast refresh). */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
