import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { loadPack } from "../src/learning/loader";
import type { Challenge, ContentPack } from "../src/learning/schema";
import { e2eDatabaseUrl } from "../scripts/e2e/config";
import { correctSubmission, wrongSubmission } from "../tests/support/answers";

export const python: ContentPack = (() => {
  const { pack } = loadPack(join(process.cwd(), "content", "python-fundamentals"));
  if (!pack) throw new Error("python pack failed to load");
  return pack;
})();

export const level = (n: number) => python.levels.find((l) => l.number === n)!;

const dbUrl = () => e2eDatabaseUrl(process.env.TEST_DATABASE_URL ?? "");

/** Read-only checks against the e2e database (as the owner role, for assertions only). */
export async function query<T extends object>(text: string, params: unknown[] = []) {
  const sql = postgres(dbUrl(), { max: 1, onnotice: () => {} });
  try {
    return (await sql.unsafe(text, params as never[])) as unknown as T[];
  } finally {
    await sql.end();
  }
}

/** Play the first `levels` levels for a new player through the real services. */
export function seedPlayer(name: string, handle: string, levels: number) {
  // The test runner's own Node with the tsx loader: `npx` is not directly executable on
  // Windows and may resolve to a different Node version there.
  const args = ["--import", "tsx", "scripts/e2e/seed.ts", name, handle, String(levels)];
  execFileSync(process.execPath, args, {
    env: { ...process.env, DATABASE_URL: dbUrl(), NODE_OPTIONS: "--conditions=react-server" },
    stdio: "pipe",
  });
}

export async function signIn(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Development identity").fill(name);
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/play" || u.pathname === "/onboarding"),
    page.getByRole("button", { name: "Sign in (development)" }).click(),
  ]);
}

export async function onboard(
  page: Page,
  handle: string,
  options: { birthYear?: number; visible?: boolean } = {},
) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Choose a handle").fill(handle);
  await page.getByLabel("Birth month").selectOption("6");
  await page.getByLabel("Birth year").fill(String(options.birthYear ?? 2000));
  if (options.visible) await page.getByLabel(/Show my handle and XP/).check();
  await page.getByRole("button", { name: "Begin the expedition" }).click();
  // Wait for the server action's outcome (game shell, refusal or form error) so callers that
  // navigate next cannot race ahead of account creation.
  await expect(
    page
      .locator(".xp-chip")
      .or(page.getByRole("heading", { name: "We can't create an account" }))
      .or(page.locator(".form-error")),
  ).toBeVisible();
}

export const xpChip = (page: Page) => page.locator(".xp-chip");

const panel = (page: Page) => page.getByRole("tabpanel");

/** Fill the active challenge's controls with an answer in the evaluator's format. */
async function fillAnswer(page: Page, c: Challenge, answer: unknown) {
  const p = panel(page);
  const a = answer as Record<string, unknown>;
  if ("selected" in a) {
    for (const id of a.selected as string[]) await p.locator(`input[value="${id}"]`).check();
  } else if ("output" in a) {
    await p.locator("textarea").fill(a.output as string);
  } else if ("blanks" in a && c.type === "fill_blank") {
    const order = [...c.template.matchAll(/\{\{blank:([A-Za-z0-9._-]+)\}\}/g)].map((m) => m[1]!);
    const inputs = p.locator("input.blank");
    for (const [i, id] of order.entries())
      await inputs.nth(i).fill((a.blanks as Record<string, string>)[id]!);
  } else if ("order" in a && c.type === "order_lines") {
    const textOf = new Map(c.lines.map((l) => [l.id, " ".repeat(l.indent * 4) + l.text]));
    const target = (a.order as string[]).map((id) => textOf.get(id)!);
    for (let i = 0; i < target.length; i++) {
      let current = await p.locator(".order-item code").allTextContents();
      let j = current.indexOf(target[i]!);
      while (j > i) {
        await p
          .getByRole("button", { name: `Move line ${j + 1} up`, exact: false })
          .first()
          .click();
        current = await p.locator(".order-item code").allTextContents();
        j = current.indexOf(target[i]!);
      }
    }
  } else if ("values" in a && c.type === "trace") {
    for (const f of c.fields)
      await p
        .getByLabel(f.label, { exact: true })
        .fill((a.values as Record<string, string>)[f.id]!);
  } else if ("line" in a) {
    const sets = p.locator("fieldset");
    await sets.nth(0).locator(`input[value="${a.line}"]`).check();
    await sets
      .nth(1)
      .locator(`input[value="${a.fix as string}"]`)
      .check();
  } else throw new Error(`no UI filler for ${c.type}`);
}

async function submit(page: Page) {
  const action = page.waitForResponse(
    (r) => r.request().method() === "POST" && !!r.request().headers()["next-action"],
  );
  await panel(page)
    .getByRole("button", { name: /^Submit/ })
    .click();
  await action;
  await expect(panel(page).getByRole("button", { name: /^Submit/ })).toBeEnabled();
}

export async function openChallenge(page: Page, index: number) {
  await page.getByRole("tab").nth(index).click();
}

export async function answer(page: Page, c: Challenge, correct: boolean) {
  await fillAnswer(page, c, correct ? correctSubmission(c) : wrongSubmission(c));
  await submit(page);
  await expect(panel(page).locator(".feedback__head")).toContainText(
    correct ? "Correct" : "Not quite",
  );
}

export async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}
