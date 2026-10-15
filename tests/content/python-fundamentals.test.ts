import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findPackDirs } from "@/learning/loader";
import { prerequisiteOrder, validatePack } from "@/learning/validate";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

describe("content/python-fundamentals (the real launch path)", () => {
  const pack = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));

  it("is the only pack and validates with no errors", () => {
    expect(findPackDirs(CONTENT_ROOT).map((d) => d.split(/[\\/]/).pop())).toEqual([
      "python-fundamentals",
    ]);
    expect(validatePack(pack).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("outlines 25 levels in five zones of five, in order", () => {
    expect(pack.levels.map((l) => l.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(pack.meta.zones.map((z) => z.order)).toEqual([1, 2, 3, 4, 5]);
    pack.meta.zones.forEach((zone, z) => {
      const numbers = pack.levels.filter((l) => l.zone === zone.id).map((l) => l.number);
      expect(numbers).toEqual([1, 2, 3, 4, 5].map((n) => z * 5 + n));
    });
    expect(prerequisiteOrder(pack.levels)).toHaveLength(25);
  });

  it("marks the documented checkpoints, major encounters and final boss", () => {
    const kinds = Object.fromEntries(
      pack.levels.filter((l) => l.kind !== "standard").map((l) => [l.number, l.kind]),
    );
    expect(kinds).toEqual({
      5: "checkpoint",
      10: "major",
      15: "checkpoint",
      20: "major",
      25: "boss",
    });
  });

  it("publishes nothing until content is authored and reviewed", () => {
    expect(pack.levels.every((l) => l.status === "draft")).toBe(true);
    expect(pack.meta.path.status).toBe("draft");
  });
});
