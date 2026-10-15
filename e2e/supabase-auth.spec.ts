/**
 * Supabase-mode journeys against a production build and a local MOCK of Supabase Auth.
 * These prove Code Dungeon's own sign-in code (PKCE redirects, code exchange, HttpOnly
 * session cookies, server-side getUser verification, email-verification gate, sign-out,
 * account deletion through the admin API). They are NOT a test of real Google OAuth or
 * real Supabase: those need the approved Supabase project (R-47).
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { MOCK_SUPABASE } from "../scripts/e2e/config";
import { onboard, query } from "./helpers";

test.describe.configure({ mode: "serial" });

const mock = (path: string, init?: RequestInit) => fetch(`${MOCK_SUPABASE.url}${path}`, init);

async function googleSignIn(page: Page, email: string, verified = true) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("heading", { name: "Mock Google sign-in" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("code_challenge")).toBeTruthy(); // PKCE
  await page.getByLabel("Google account email").fill(email);
  if (!verified) await page.getByLabel("Email verified by Google").uncheck();
  await page.getByRole("button", { name: "Continue as this Google user" }).click();
}

test.beforeAll(async () => {
  await mock("/__mock/reset", { method: "POST" });
});

test("production build serves security headers and refuses to be framed", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("Google sign-in (mocked IdP) creates a session, onboarding links the identity, no email stored", async ({
  page,
  context,
}) => {
  await googleSignIn(page, "gale@example.test");
  await expect(page).toHaveURL(/\/onboarding$/);
  const cookies = await context.cookies();
  const auth = cookies.filter((c) => c.name.startsWith("sb-"));
  expect(auth.length).toBeGreaterThan(0);
  expect(auth.every((c) => c.httpOnly)).toBe(true); // scripts cannot read the session
  expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");

  await onboard(page, "Gale", { visible: true });
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("heading", { name: "Your expedition begins" })).toBeVisible();

  const [user] = (await (await mock("/__mock/users")).json()) as { id: string; email: string }[];
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM players WHERE auth_provider = 'supabase'",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]!.auth_subject).toBe(user!.id); // linked by provider user id
  expect(JSON.stringify(rows)).not.toContain("gale@example.test");
});

test("an unverified Google email is refused and can sign out", async ({ page }) => {
  await googleSignIn(page, "unverified@example.test", false);
  await expect(page).toHaveURL(/\/sign-in\?error=unverified/);
  await expect(page.getByText(/email address is not verified/)).toBeVisible();
  await page.goto("/play");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/sign-in?error=unverified");
  await page.getByRole("button", { name: "Sign out and use another account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/sign-in");
  await expect(page.getByText(/email address is not verified/)).toHaveCount(0);
});

test("email magic link (mocked mailbox) confirms the address and signs in, keeping redirects on-site", async ({
  page,
}) => {
  // A hostile `next` must never send the player off-site after sign-in.
  await page.goto("/sign-in?next=https%3A%2F%2Fevil.example%2Fsteal");
  await page.getByLabel("Email").fill("mira@example.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/a sign-in link is on its way/)).toBeVisible();

  const mail = (await (await mock("/__mock/outbox?email=mira%40example.test")).json()) as {
    link: string;
  };
  expect(decodeURIComponent(mail.link)).not.toContain("evil.example");
  await page.goto(mail.link);
  await expect(page).toHaveURL(/^http:\/\/localhost:3101\/onboarding$/);
  await onboard(page, "Mira");
  await expect(page).toHaveURL(/\/play$/);
});

test("a forged or reused sign-in code is rejected", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code&next=/play");
  await expect(page).toHaveURL(/\/sign-in\?error=link/);
  await expect(page.getByText("That sign-in link is invalid or has expired.")).toBeVisible();
  await page.goto("/auth/confirm?token_hash=x&type=invite");
  await expect(page).toHaveURL(/\/sign-in\?error=link/);
});

test("sign-out ends the session everywhere it matters", async ({ page, context }) => {
  await googleSignIn(page, "gale@example.test");
  await expect(page).toHaveURL(/\/play$/);
  await page.goto("/play/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await context.cookies()).filter((c) => c.name.startsWith("sb-"))).toHaveLength(0);
  await page.goto("/play/map");
  await expect(page).toHaveURL(/\/sign-in/);
  const calls = (await (await mock("/__mock/calls")).json()) as string[];
  expect(calls).toContain("POST /auth/v1/logout");
});

test("account deletion removes the game data and the Supabase user together", async ({ page }) => {
  await googleSignIn(page, "gale@example.test");
  await expect(page).toHaveURL(/\/play$/);
  const [before] = await query<{ id: string }>("SELECT id FROM players WHERE handle = 'Gale'");
  expect(before).toBeTruthy();

  await page.goto("/play/profile");
  const button = page.getByRole("button", { name: "Delete my account" });
  await expect(button).toBeDisabled();
  await page.getByLabel(/Type your handle/).fill("gale"); // wrong case
  await page.getByLabel(/I understand this is permanent/).check();
  await expect(button).toBeDisabled();
  await page.getByLabel(/Type your handle/).fill("Gale");
  await button.click();
  await expect(page).toHaveURL(/\/account-deleted$/);
  await expect(page.getByRole("heading", { name: "Your account was deleted" })).toBeVisible();

  expect(await query("SELECT 1 FROM players WHERE id = $1", [before!.id])).toHaveLength(0);
  for (const t of ["xp_ledger", "submissions", "player_paths", "quest_progress"])
    expect(await query(`SELECT 1 FROM ${t} WHERE player_id = $1`, [before!.id]), t).toHaveLength(0);
  const users = (await (await mock("/__mock/users")).json()) as { email: string }[];
  expect(users.map((u) => u.email)).not.toContain("gale@example.test");

  // The same Google account now starts over as a new player.
  await page.goto("/play");
  await expect(page).toHaveURL(/\/sign-in/);
  await googleSignIn(page, "gale@example.test");
  await expect(page).toHaveURL(/\/onboarding$/);
});
