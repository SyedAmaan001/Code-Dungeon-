import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviewChecklist } from "@/learning/review-checklist";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

describe("curriculum review checklist", () => {
  const pack = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));
  const text = reviewChecklist(pack);

  it("is committed up to date (run npm run content:review-checklist)", () => {
    const committed = readFileSync(
      join(process.cwd(), "docs", "CURRICULUM_REVIEW_CHECKLIST.md"),
      "utf8",
    );
    expect(committed).toBe(text + "\n");
  });

  it("covers every level and challenge, and claims no human review", () => {
    for (const l of pack.levels) {
      expect(text).toContain(`### Level ${l.number} — ${l.title}`);
      for (const c of l.challenges) expect(text).toContain(`\`${c.id}\``);
    }
    expect(text).toContain("**Status:** 0 of 25 published levels are human-reviewed.");
    expect(text.match(/AI-reviewed only — human review pending/g)).toHaveLength(25);
    expect(text).not.toContain("**Human-reviewed**");
  });
});
