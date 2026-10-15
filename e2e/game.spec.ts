import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEFAULT_POLICY } from "../src/domain/policy";
import {
  answer,
  level,
  noHorizontalScroll,
  onboard,
  openChallenge,
  python,
  query,
  seedPlayer,
  signIn,
  xpChip,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("signed-out visitors are sent to sign-in for every game route", async ({ page }) => {
  for (const path of [
    "/play",
    "/play/map",
    "/play/journal",
    "/play/level/py.L001",
    "/onboarding",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  }
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a forged session cookie is rejected", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "cd_dev_session",
      value: "v1.eyJzdWIiOiJtYWxsb3J5In0.forged",
      url: "http://localhost:3100",
    },
  ]);
  await page.goto("/play");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("onboarding refuses under-13s and stores nothing", async ({ page }) => {
  await signIn(page, "young-one");
  await onboard(page, "YoungOne", { birthYear: new Date().getUTCFullYear() - 11 });
  await expect(page.getByRole("heading", { name: "We can't create an account" })).toBeVisible();
  const rows = await query(
    "SELECT 1 FROM players WHERE auth_provider = 'dev' AND auth_subject = 'young-one'",
  );
  expect(rows).toHaveLength(0);
  // Re-entering a different year straight away is refused too.
  await page.goto("/onboarding");
  await onboard(page, "YoungOne", { birthYear: 1990 });
  await expect(page.getByRole("heading", { name: "We can't create an account" })).toBeVisible();
});

test("a new player completes level 1; progress, XP and quests persist across sessions", async ({
  page,
  browser,
}) => {
  await signIn(page, "alice");
  await onboard(page, "Alice", { visible: true });
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("heading", { name: "Your expedition begins" })).toBeVisible();
  await expect(xpChip(page)).toContainText("0");

  const l1 = level(1);
  await page.getByRole("link", { name: /Enter level 1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: l1.title })).toBeVisible();

  // First challenge: a wrong answer, a hint, then the right answer (no first-try bonus).
  await answer(page, l1.challenges[0]!, false);
  await page.getByRole("button", { name: /Reveal hint 1/ }).click();
  await expect(page.locator(".hint")).toContainText(l1.challenges[0]!.hints[0]!);
  await answer(page, l1.challenges[0]!, true);
  for (let i = 1; i < l1.challenges.length; i++) {
    await openChallenge(page, i);
    await answer(page, l1.challenges[i]!, true);
  }

  const { xp } = DEFAULT_POLICY;
  const expected =
    l1.challenges.reduce((s, c) => s + xp.perDifficulty * c.difficulty, 0) +
    xp.firstTryBonus * (l1.challenges.length - 1) +
    xp.levelCompletion.standard;
  await expect(page.getByText("Level complete")).toBeVisible();
  await expect(xpChip(page)).toContainText(String(expected));
  await expect(page.getByRole("link", { name: /Level 2:/ }).first()).toBeVisible();

  // A brand-new browser session sees the same saved progress.
  const other = await browser.newContext();
  const page2 = await other.newPage();
  await signIn(page2, "alice");
  await expect(page2).toHaveURL(/\/play$/);
  await expect(xpChip(page2)).toContainText(String(expected));
  await expect(page2.getByText("1/25")).toBeVisible();
  await page2.goto("/play/map");
  await expect(page2.getByRole("link", { name: /Level 2: Values and Expressions/ })).toBeVisible();
  await page2.goto("/play/journal");
  await expect(page2.getByRole("heading", { name: "Repair the Gate" })).toBeVisible();
  await other.close();
});

test("another account sees none of that progress and cannot enter locked rooms", async ({
  page,
}) => {
  await signIn(page, "bob");
  await onboard(page, "Bob");
  await expect(xpChip(page)).toContainText("0");
  await page.goto("/play/level/py.L002");
  await expect(page.getByText("This room is sealed.")).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);

  await page.goto("/play/leaderboard");
  const board = page.getByRole("table");
  await expect(board.getByRole("row", { name: /Alice/ })).toBeVisible();
  await expect(board.getByText("Bob")).toHaveCount(0);
  // Leaderboard visibility is off by default (high-privacy default for a 13+ audience).
  await expect(page.getByText(/You are hidden from the leaderboard/)).toBeVisible();
});

test("a level page sent to the browser holds no hints, explanations or answer feedback", async ({
  page,
}) => {
  await signIn(page, "bob");
  const l1 = level(1);
  const response = await page.goto(`/play/level/${l1.id}`);
  const html = (await response!.text()) + (await page.content());
  for (const c of l1.challenges) {
    for (const hint of c.hints) expect(html).not.toContain(hint);
    if (c.explanation) expect(html).not.toContain(c.explanation);
    if (c.feedback) expect(html).not.toContain(c.feedback.correct);
  }
});

test("a major encounter costs lives, ends the run, and keeps learning progress", async ({
  page,
}) => {
  seedPlayer("dora", "Dora", 9);
  await signIn(page, "dora");
  const l10 = level(10);
  await page.goto(`/play/level/${l10.id}`);
  const encounter = page.getByRole("region", { name: "Major encounter" });
  await expect(encounter).toContainText("3 of 3 lives");
  const before = (await xpChip(page).textContent()) ?? "";

  await answer(page, l10.challenges[0]!, false);
  await expect(encounter).toContainText("2 of 3 lives");
  await answer(page, l10.challenges[0]!, false);
  await expect(encounter).toContainText("1 of 3 lives");
  await answer(page, l10.challenges[0]!, false);
  await expect(page.getByRole("tabpanel")).toContainText("Run 1 is over");
  await expect(encounter).toContainText("Run 1 was lost");
  await expect(xpChip(page)).toHaveText(before);

  // Winning a fresh run: answer every challenge correctly.
  for (let i = 0; i < l10.challenges.length; i++) {
    await openChallenge(page, i);
    await answer(page, l10.challenges[i]!, true);
  }
  await expect(encounter).toContainText(/victory/i);
  await expect(encounter).toContainText("Cleared flawlessly after 2 runs");
});

test("every challenge format can be answered with its own controls", async ({ page }) => {
  seedPlayer("fay", "Fay", 25);
  await signIn(page, "fay");
  const seen = new Set<string>();
  for (const l of python.levels)
    for (const [i, c] of l.challenges.entries()) {
      if (seen.has(c.type)) continue;
      seen.add(c.type);
      await page.goto(`/play/level/${l.id}`);
      await openChallenge(page, i);
      await answer(page, c, false);
      await answer(page, c, true);
    }
  expect([...seen].sort()).toEqual([
    "fill_blank",
    "find_fix_bug",
    "multiple_choice",
    "order_lines",
    "predict_output",
    "trace",
  ]);
  await page.goto("/play");
  await expect(page.getByRole("heading", { name: "Expedition complete" })).toBeVisible();
  await expect(xpChip(page)).toContainText("2,455");
});

test("lesson code keeps its indentation and exact characters", async ({ page }) => {
  await signIn(page, "fay");
  await page.goto(`/play/level/${level(10).id}`);
  const block = page.locator(".lesson pre").first();
  await expect(block).toContainText('    print("Hot")');
  expect(await block.evaluate((el) => getComputedStyle(el).fontVariantLigatures)).toBe("none");
  await expect(page.locator(".lesson")).not.toContainText("```");
});

test("the journal and collection show quests and rewards earned on the path", async ({ page }) => {
  seedPlayer("erin", "Erin", 5);
  await signIn(page, "erin");
  await page.goto("/play/journal");
  const quest = page.getByRole("article", { name: "Repair the Gate" });
  await expect(quest).toContainText("Complete");
  await page.goto("/play/collection");
  await expect(page.getByText("Gate Key")).toBeVisible();
  await expect(page.getByText("Copper Ring")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Achievements/ })).toContainText("of 11");
  await page.goto("/play");
  await expect(page.getByText("last checkpoint")).toBeVisible();
  await expect(page.locator(".ledger")).toContainText("Level 5");
});

test("profile changes are saved and hide the player from the leaderboard", async ({ page }) => {
  await signIn(page, "alice");
  await page.goto("/play/profile");
  await page.getByLabel(/Show my handle and XP/).uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto("/play/leaderboard");
  await expect(page.getByText(/You are hidden from the leaderboard/)).toBeVisible();
  await expect(page.getByRole("table").getByText("Alice")).toHaveCount(0);
  await page.goto("/play/profile");
  await page.getByLabel(/Show my handle and XP/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
});

test("phone-sized layouts have no horizontal scrolling and a bottom navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, "erin");
  for (const path of [
    "/play",
    "/play/map",
    `/play/level/${level(6).id}`,
    "/play/journal",
    "/play/collection",
    "/play/leaderboard",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await noHorizontalScroll(page);
  }
  await expect(page.getByRole("navigation", { name: "Game (mobile)" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Game", exact: true })).toBeHidden();
  await context.close();
});

test("main screens have no serious or critical accessibility violations", async ({ page }) => {
  const scan = async (label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${label}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  };
  await page.goto("/");
  await scan("landing");
  await page.goto("/sign-in");
  await scan("sign-in");
  await signIn(page, "erin");
  for (const path of [
    "/play",
    "/play/map",
    `/play/level/${level(5).id}`,
    `/play/level/${level(6).id}`,
    "/play/journal",
    "/play/collection",
    "/play/leaderboard",
    "/play/profile",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await scan(path);
  }
});

test("reduced motion stops decorative animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page, "bob");
  await page.goto("/play/map");
  const duration = await page
    .locator('.room[data-status="available"] .room__seal')
    .first()
    .evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await context.close();
});
