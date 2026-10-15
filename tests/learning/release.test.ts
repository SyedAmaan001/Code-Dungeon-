import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPathRules, LearningService } from "@/services/learning-service";
import { InMemoryProgressStore } from "@/services/progress-store";
import {
  applyReleasePolicy,
  levelsNeedingHumanReview,
  parseContentRelease,
  reviewStatus,
} from "@/learning/release";
import { Level } from "@/learning/schema";
import { clonePack, loadOrThrow, VALID_SMALL } from "../support/packs";

const PYTHON = join(process.cwd(), "content", "python-fundamentals");

describe("review status (DEC-011)", () => {
  it("keeps AI review and human review distinct", () => {
    const base = { reviewer: "r", date: "2026-10-15", pythonVersion: "3.13" };
    expect(reviewStatus({ review: { ...base, kind: "agent" } })).toBe("ai_reviewed");
    expect(reviewStatus({ review: { ...base, kind: "human" } })).toBe("human_reviewed");
    expect(reviewStatus({})).toBe("unreviewed");
  });

  it("requires an explicit review kind: a missing kind is not read as human review", () => {
    const level = {
      id: "x.L1",
      version: 1,
      number: 1,
      zone: "z",
      title: "T",
      status: "draft",
      review: { reviewer: "someone", date: "2026-10-15", pythonVersion: "3.13" },
    };
    const parsed = Level.safeParse(level);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["review", "kind"]);
  });

  it("all 25 Python levels are recorded as AI-reviewed, not human-reviewed", () => {
    const pack = loadOrThrow(PYTHON);
    const published = pack.levels.filter((l) => l.status === "published");
    expect(published).toHaveLength(25);
    expect(published.every((l) => reviewStatus(l) === "ai_reviewed")).toBe(true);
    expect(levelsNeedingHumanReview(pack)).toHaveLength(25);
  });
});

describe("human review cannot be claimed by an AI reviewer", () => {
  it("rejects kind: human with an AI agent as reviewer, accepts a person", async () => {
    const { validatePack } = await import("@/learning/validate");
    const pack = clonePack(loadOrThrow(VALID_SMALL));
    pack.levels[0]!.review = {
      reviewer: "Claude Code (AI agent) with automated content checks",
      date: "2026-10-15",
      pythonVersion: "3.13",
      kind: "human",
    };
    const errors = validatePack(pack).filter((i) => i.severity === "error");
    expect(errors.map((e) => e.at)).toContain("review.reviewer");
    pack.levels[0]!.review.reviewer = "Ada Lovelace";
    expect(validatePack(pack).filter((i) => i.at === "review.reviewer")).toEqual([]);
  });
});

describe("content release policy", () => {
  it("defaults to development and rejects unknown modes", () => {
    expect(parseContentRelease(undefined)).toBe("development");
    expect(parseContentRelease(" ")).toBe("development");
    expect(parseContentRelease("public")).toBe("public");
    expect(() => parseContentRelease("prod")).toThrow(/CONTENT_RELEASE/);
  });

  it("development keeps every published level playable", () => {
    const pack = loadOrThrow(PYTHON);
    const { pack: released, withheld } = applyReleasePolicy(pack, "development");
    expect(released).toBe(pack);
    expect(withheld).toEqual([]);
    expect(buildPathRules(released).levels).toHaveLength(25);
  });

  it("public withholds every level without human review, without mutating the source", () => {
    const pack = loadOrThrow(PYTHON);
    const { pack: released, withheld } = applyReleasePolicy(pack, "public");
    expect(withheld.map((w) => w.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(buildPathRules(released).levels).toHaveLength(0);
    expect(pack.levels.filter((l) => l.status === "published")).toHaveLength(25);
  });

  it("public serves human-reviewed levels and keeps dependants of withheld levels locked", async () => {
    const pack = clonePack(loadOrThrow(VALID_SMALL));
    // L001 human-reviewed; L002 marked AI-reviewed, so it is withheld.
    pack.levels[1]!.review!.kind = "agent";
    const { pack: released, withheld } = applyReleasePolicy(pack, "public");
    expect(withheld.map((w) => w.levelId)).toEqual(["fx.L002"]);

    const learning = new LearningService({ pack: released, store: new InMemoryProgressStore() });
    const path = await learning.getPath("p1");
    expect(path.levels.map((l) => l.levelId)).toEqual(["fx.L001"]);
    expect(await learning.getLevel("p1", "fx.L002")).toMatchObject({ code: "unknown_level" });
  });
});
