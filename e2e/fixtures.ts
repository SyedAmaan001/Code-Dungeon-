/**
 * Shared Playwright fixture: every test fails if the browser logs a console error or a
 * request fails at the network level / returns 5xx, unless the test opts out explicitly
 * (e.g. the offline test, where failed requests are the point).
 */
import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ allowNetworkFailures: boolean; healthy: void }>({
  allowNetworkFailures: [false, { option: true }],
  healthy: [
    async ({ page, allowNetworkFailures }, use) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !allowNetworkFailures) problems.push(`console: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("requestfailed", (r) => {
        const reason = r.failure()?.errorText ?? "";
        // Prefetches and in-flight requests cancelled by a navigation are not failures.
        if (allowNetworkFailures || /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason))
          return;
        problems.push(`request failed (${reason}): ${r.method()} ${r.url()}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      await use();
      expect(problems, "console errors or failed requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
