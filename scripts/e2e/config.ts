/** Shared settings for the end-to-end suite (no secrets: the dev secret below is a fixed test value). */
export const E2E_DATABASE = "code_dungeon_e2e";
export const E2E_PORT = 3100;
/** Test-only HMAC key for the development sign-in. Not a credential; never used outside e2e. */
export const E2E_DEV_SECRET = "e2e-only-dev-auth-secret-not-a-real-credential-0001";

export function e2eDatabaseUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${E2E_DATABASE}`;
  return url.toString();
}
