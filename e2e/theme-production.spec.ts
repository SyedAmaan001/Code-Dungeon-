/**
 * The theme stylesheet in a production build (DEC-019): minified CSS must keep the cascade-layer
 * order (base design system < Onyx overrides < Tailwind utilities), so the default theme is
 * unchanged and Onyx really overrides it.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const primaryButton = (page: import("@playwright/test").Page) =>
  page
    .locator(".btn--primary")
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, color: s.backgroundColor, font: s.fontFamily };
    });

test("the default theme renders the approved fantasy styles", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("fantasy");
  const button = await primaryButton(page);
  expect(button.image).toContain("linear-gradient");
  expect(button.font).toContain("Alegreya Sans");
  const h1 = await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1).toContain("Cinzel");
});

test("the Onyx preview overrides the base styles and stays accessible", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "cd_theme", value: "onyx", url: baseURL! }]);
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("onyx");
  const button = await primaryButton(page);
  expect(button.image).toBe("none");
  expect(button.color).toBe("rgb(79, 95, 230)");
  expect(button.font).toContain("Inter");
  const h1 = await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1).toContain("Bitcount Ink");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
});
