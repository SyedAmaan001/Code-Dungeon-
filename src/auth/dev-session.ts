/**
 * Development-only sign-in tokens (AUTH_MODE=dev; DEC-009).
 *
 * A token is `v1.<payload>.<signature>`: base64url JSON `{ sub, iat, exp }` signed with
 * HMAC-SHA256 using DEV_AUTH_SECRET. It proves only that this server issued it; it is
 * not an identity provider and is refused in production builds (see ./config.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEV_SESSION_COOKIE = "cd_dev_session";
export const DEV_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEV_PROVIDER = "dev";

/** Dev identities are short names so they read clearly in the database (`dev` / `alice`). */
const NAME = /^[a-z][a-z0-9-]{1,31}$/;

export function normaliseDevName(raw: string): string | undefined {
  const name = raw.trim().toLowerCase();
  return NAME.test(name) ? name : undefined;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const sign = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function signDevSession(subject: string, secret: string, now = new Date()): string {
  if (!normaliseDevName(subject)) throw new Error("invalid development identity name");
  const iat = Math.floor(now.getTime() / 1000);
  const payload = b64(JSON.stringify({ sub: subject, iat, exp: iat + DEV_SESSION_TTL_SECONDS }));
  return `v1.${payload}.${sign(`v1.${payload}`, secret)}`;
}

/** The token's subject, or undefined if it is malformed, forged or expired. */
export function verifyDevSession(
  token: string | undefined,
  secret: string,
  now = new Date(),
): string | undefined {
  if (!token || token.length > 512) return undefined;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return undefined;
  const [, payload, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(`v1.${payload}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof data !== "object" || data === null) return undefined;
    const { sub, exp } = data as { sub?: unknown; exp?: unknown };
    if (typeof sub !== "string" || typeof exp !== "number") return undefined;
    if (exp <= Math.floor(now.getTime() / 1000)) return undefined;
    return normaliseDevName(sub) === sub ? sub : undefined;
  } catch {
    return undefined;
  }
}
