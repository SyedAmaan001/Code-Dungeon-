import { describe, expect, it } from "vitest";
import { collectSnippets, verifySnippet } from "@/learning/python-verify";
import { toPublicLevel } from "@/learning/projection";
import { prerequisiteOrder, validatePack } from "@/learning/validate";
import { loadOrThrow } from "../support/packs";
import {
  SYNTHETIC_LEVELS,
  SYNTHETIC_PUBLISHED,
  writeSyntheticPack,
} from "../support/synthetic-pack";

describe("synthetic 100-level path (test data, not curriculum)", () => {
  const pack = loadOrThrow(writeSyntheticPack());

  it("loads 100 levels in 20 zones from YAML files and validates cleanly", () => {
    expect(pack.levels).toHaveLength(SYNTHETIC_LEVELS);
    expect(pack.meta.zones).toHaveLength(20);
    expect(pack.levels.map((l) => l.number)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(validatePack(pack)).toEqual([]);
  });

  it("publishes 25 and keeps 26–100 as drafts", () => {
    const published = pack.levels.filter((l) => l.status === "published").map((l) => l.number);
    expect(published).toEqual(Array.from({ length: SYNTHETIC_PUBLISHED }, (_, i) => i + 1));
  });

  it("resolves a non-linear prerequisite graph across all 100 levels", () => {
    const order = prerequisiteOrder(pack.levels);
    expect(order).toHaveLength(100);
    const position = new Map(order.map((id, i) => [id, i]));
    for (const level of pack.levels)
      for (const pre of level.prerequisites)
        expect(position.get(pre)!).toBeLessThan(position.get(level.id)!);
    expect(pack.levels.find((l) => l.number === 100)?.prerequisites).toHaveLength(4);
  });

  it("projects every level without errors", () => {
    expect(pack.levels.map(toPublicLevel)).toHaveLength(100);
  });

  it("verifies a sample of synthetic snippets with real Python", () => {
    const snippets = collectSnippets(pack);
    expect(snippets).toHaveLength(SYNTHETIC_PUBLISHED * 2);
    for (const s of [snippets[0]!, snippets.at(-1)!]) expect(verifySnippet(s).ok).toBe(true);
  });
});
