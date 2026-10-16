/**
 * End-to-end tests against a fresh PostgreSQL database (code_dungeon_e2e). Two projects:
 *
 * - `dev-signin`: the app under `next dev` with the development-only sign-in (which a
 *   production build refuses by design). Covers the game loop, isolation and accessibility.
 * - `supabase-mock`: a *production build* in Supabase mode, talking over real HTTP to a
 *   local MOCK of Supabase Auth (e2e/mock-supabase/server.ts). Covers our Google OAuth and
 *   magic-link code paths, sessions, sign-out and account deletion. It does not exercise
 *   real Google or Supabase; that needs an approved project (docs/risk-register.md R-47).
 *
 * Requires TEST_DATABASE_URL (see README).
 */
import { defineConfig, devices } from "@playwright/test";
import {
  e2eDatabaseUrl,
  E2E_DEV_SECRET,
  E2E_PORT,
  MOCK_SUPABASE,
  SUPABASE_E2E_PORT,
} from "./scripts/e2e/config";

const admin = process.env.TEST_DATABASE_URL ?? "";
export const E2E_DATABASE_URL = admin ? e2eDatabaseUrl(admin) : "";
const env = process.env as Record<string, string>;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "dev-signin",
      testMatch: /(game|theme)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${E2E_PORT}` },
    },
    {
      name: "supabase-mock",
      testMatch: /(supabase-auth|theme-production)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${SUPABASE_E2E_PORT}` },
    },
  ],
  webServer: [
    {
      command: "npx tsx e2e/mock-supabase/server.ts",
      url: `${MOCK_SUPABASE.url}/`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { ...env, MOCK_SUPABASE_PORT: String(MOCK_SUPABASE.port) },
    },
    {
      command: `npx tsx scripts/e2e/prepare-db.ts && npx next dev --port ${E2E_PORT}`,
      url: `http://localhost:${E2E_PORT}/`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ...env,
        DATABASE_URL: E2E_DATABASE_URL,
        AUTH_MODE: "dev",
        DEV_AUTH_SECRET: E2E_DEV_SECRET,
        CONTENT_RELEASE: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
    {
      // A separate build directory so it can coexist with `next dev` above.
      command: `npx next build && npx next start --port ${SUPABASE_E2E_PORT}`,
      url: `http://localhost:${SUPABASE_E2E_PORT}/`,
      timeout: 420_000,
      reuseExistingServer: false,
      env: {
        ...env,
        NEXT_DIST_DIR: ".next-e2e",
        DATABASE_URL: E2E_DATABASE_URL,
        AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE.url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE.publishableKey,
        SUPABASE_SECRET_KEY: MOCK_SUPABASE.secretKey,
        APP_URL: `http://localhost:${SUPABASE_E2E_PORT}`,
        CONTENT_RELEASE: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
