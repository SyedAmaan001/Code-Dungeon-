/**
 * Post-sign-in destinations come from query strings, so they are untrusted: only
 * same-site absolute paths are allowed (no scheme, no `//host`, no backslash tricks).
 */
export const DEFAULT_AFTER_SIGN_IN = "/play";

export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > 200) return DEFAULT_AFTER_SIGN_IN;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return DEFAULT_AFTER_SIGN_IN;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_AFTER_SIGN_IN;
  try {
    const url = new URL(raw, "https://example.invalid");
    if (url.origin !== "https://example.invalid") return DEFAULT_AFTER_SIGN_IN;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
}

/** Routes that need a signed-in player (checked again on the server by requirePlayer). */
export function isProtectedPath(pathname: string): boolean {
  return pathname === "/play" || pathname.startsWith("/play/") || pathname === "/onboarding";
}
