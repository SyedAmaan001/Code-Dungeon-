/**
 * The Onyx preview theme (DEC-019): a display preference that must never change game state,
 * must persist, and must keep the map, the level room and the challenges usable and accessible.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { answer, level, noHorizontalScroll, openChallenge, seedPlayer, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function axeClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious.map((v) => `${label}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

test.beforeAll(() => seedPlayer("tess", "Tess", 9));

test("the theme switch persists, changes no progress and can be undone", async ({ page }) => {
  await signIn(page, "tess");
  await expect.poll(() => theme(page)).toBe("fantasy");
  const xp = await page.locator(".xp-chip").innerText();

  await page.goto("/play/profile");
  const appearance = page.getByRole("group", { name: "Theme" });
  await expect(appearance.getByRole("button", { name: "Fantasy" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await appearance.getByRole("button", { name: "Onyx (preview)" }).click();
  await expect.poll(() => theme(page)).toBe("onyx");
  await expect(appearance.getByRole("button", { name: "Onyx (preview)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Rendered by the server from the cookie: a fresh load starts in Onyx, with the same XP.
  await page.goto("/play/map");
  await expect.poll(() => theme(page)).toBe("onyx");
  await expect(page.locator(".xp-chip")).toHaveText(xp);
  const heading = await page
    .locator("h1")
    .evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0]);
  expect(heading).toContain("Bitcount Ink");

  // The top-bar toggle switches back.
  await page.getByRole("button", { name: "Switch to the Fantasy theme" }).click();
  await expect.poll(() => theme(page)).toBe("fantasy");
  await expect(page.locator(".xp-chip")).toHaveText(xp);
});

test("an unknown theme cookie falls back to the default theme", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "cd_theme", value: "<script>", url: baseURL! }]);
  await signIn(page, "tess");
  await expect.poll(() => theme(page)).toBe("fantasy");
});

test.describe("in the Onyx theme", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "cd_theme", value: "onyx", url: baseURL! }]);
  });

  test("the map, level room and challenges have no serious accessibility violations", async ({
    page,
  }) => {
    await signIn(page, "tess");
    for (const path of ["/play", "/play/map", `/play/level/${level(10).id}`, "/play/profile"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await theme(page)).toBe("onyx");
      await axeClean(page, path);
    }
    await page.goto("/play/map");
    await page.getByText("How to read the map").click();
    await axeClean(page, "map legend open");
  });

  test("a challenge can be answered and its feedback is shown", async ({ page }) => {
    await signIn(page, "tess");
    const l = level(10);
    await page.goto(`/play/level/${l.id}`);
    await openChallenge(page, 0);
    await answer(page, l.challenges[0]!, true);
    await axeClean(page, "feedback shown");
  });

  test("phone layouts have no horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "tess");
    for (const path of ["/play", "/play/map", `/play/level/${level(10).id}`, "/play/profile"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  test("reduced motion turns off smooth scrolling and entrance animation", async ({ page }) => {
    await signIn(page, "tess");
    await page.goto("/play/map");
    await expect(page.locator(".room").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(
      false,
    );
    expect(await page.locator(".room").first().getAttribute("style")).toBeNull();
  });
});

test("with motion allowed, Onyx enables smooth scrolling and rooms finish fully visible", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "cd_theme", value: "onyx", url: baseURL! }]);
  await signIn(page, "tess");
  await page.goto("/play/map");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("lenis")))
    .toBe(true);
  // Entrances end at full opacity with no transform left behind.
  await expect
    .poll(() =>
      page
        .locator(".room")
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return `${s.opacity} ${s.transform}`;
        }),
    )
    .toBe("1 none");
});
