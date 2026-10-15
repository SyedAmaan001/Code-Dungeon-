/**
 * End-to-end tests: the real app (next dev) against a fresh PostgreSQL database, signed in
 * with the development-only sign-in. `next dev` is used because the dev sign-in is refused
 * in production builds by design. Requires TEST_DATABASE_URL (see README).
 */
import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl, E2E_DEV_SECRET, E2E_PORT } from "./scripts/e2e/config";

const admin = process.env.TEST_DATABASE_URL ?? "";
export const E2E_DATABASE_URL = admin ? e2eDatabaseUrl(admin) : "";

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
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx scripts/e2e/prepare-db.ts && npx next dev --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_MODE: "dev",
      DEV_AUTH_SECRET: E2E_DEV_SECRET,
      CONTENT_RELEASE: "development",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
