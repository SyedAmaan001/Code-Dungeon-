import { beforeAll, describe, expect, it } from "vitest";
import type { ContentPack, Level } from "@/learning/schema";
import { findCycles, prerequisiteOrder, validatePack } from "@/learning/validate";
import { clonePack, loadOrThrow, VALID_SMALL } from "../support/packs";

let base: ContentPack;
beforeAll(() => {
  base = loadOrThrow(VALID_SMALL);
});

const errorsOf = (pack: ContentPack, codeRunnerEnabled = false) =>
  validatePack(pack, { codeRunnerEnabled })
    .filter((i) => i.severity === "error")
    .map((i) => i.message);

const level = (pack: ContentPack, id: string): Level => {
  const found = pack.levels.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

describe("validatePack — valid fixture", () => {
  it("loads every challenge type and reports no issues", () => {
    expect(validatePack(base)).toEqual([]);
    const types = new Set(base.levels.flatMap((l) => l.challenges.map((c) => c.type)));
    expect([...types].sort()).toEqual(
      [
        "code_write",
        "fill_blank",
        "find_fix_bug",
        "multiple_choice",
        "order_lines",
        "predict_output",
        "trace",
      ].sort(),
    );
  });
});

describe("validatePack — rejects invalid content", () => {
  it("duplicate ids", () => {
    const p = clonePack(base);
    level(p, "fx.L002").challenges[0]!.id = "fx.L001.c1";
    expect(errorsOf(p)).toContainEqual(expect.stringContaining('duplicate id "fx.L001.c1"'));
  });

  it("duplicate level numbers", () => {
    const p = clonePack(base);
    level(p, "fx.L002").number = 1;
    expect(errorsOf(p)).toContainEqual(expect.stringContaining("level number 1 already used"));
  });

  it("unknown zone and unknown prerequisite", () => {
    const p = clonePack(base);
    level(p, "fx.L002").zone = "fx.zone.nowhere";
    level(p, "fx.L002").prerequisites = ["fx.L999"];
    const errors = errorsOf(p);
    expect(errors).toContainEqual(expect.stringContaining('unknown zone "fx.zone.nowhere"'));
    expect(errors).toContainEqual(expect.stringContaining('unknown prerequisite level "fx.L999"'));
  });

  it("prerequisite cycles", () => {
    const p = clonePack(base);
    level(p, "fx.L001").prerequisites = ["fx.L003"];
    expect(errorsOf(p)).toContainEqual(expect.stringContaining("prerequisite cycle"));
    expect(findCycles(p.levels)).toHaveLength(1);
    expect(() => prerequisiteOrder(p.levels)).toThrow();
  });

  it("published level that requires a draft level", () => {
    const p = clonePack(base);
    level(p, "fx.L001").status = "draft";
    expect(errorsOf(p)).toContainEqual(
      expect.stringContaining('published level requires unpublished level "fx.L001"'),
    );
  });

  it("incomplete published level (publication gate)", () => {
    const p = clonePack(base);
    const l = level(p, "fx.L001");
    delete l.lesson;
    delete l.review;
    l.sources = [];
    delete l.challenges[0]!.explanation;
    delete l.challenges[0]!.feedback;
    const errors = errorsOf(p);
    expect(errors).toContainEqual(expect.stringContaining("missing a lesson"));
    expect(errors).toContainEqual(expect.stringContaining("missing review metadata"));
    expect(errors).toContainEqual(expect.stringContaining("missing at least one source"));
    expect(errors).toContainEqual(expect.stringContaining("needs an explanation"));
    expect(errors).toContainEqual(expect.stringContaining("needs correct/incorrect feedback"));
  });

  it("unknown source reference", () => {
    const p = clonePack(base);
    level(p, "fx.L001").sources = [{ source: "not-a-source" }];
    expect(errorsOf(p)).toContainEqual(expect.stringContaining('unknown source "not-a-source"'));
  });

  it("publishing code_write while live execution is disabled", () => {
    const p = clonePack(base);
    const l = level(p, "fx.L003");
    l.status = "published";
    l.estimatedMinutes = 5;
    l.lesson = structuredClone(level(p, "fx.L001").lesson);
    l.sources = [{ source: "python-tutorial-3.13" }];
    l.review = { reviewer: "test", date: "2026-10-15", pythonVersion: "3.13" };
    l.challenges[0]!.feedback = { correct: "Yes.", incorrect: "No." };
    l.challenges[0]!.explanation = "Because.";
    expect(errorsOf(p)).toContainEqual(
      expect.stringContaining("cannot be published while live code execution is disabled"),
    );
    expect(errorsOf(p, true)).toEqual([]);
  });

  it("multiple choice answer inconsistencies", () => {
    const p = clonePack(base);
    const c = level(p, "fx.L001").challenges[1]!;
    if (c.type !== "multiple_choice") throw new Error("fixture changed");
    c.answer.correct = ["a", "z"];
    const errors = errorsOf(p);
    expect(errors).toContainEqual(expect.stringContaining('unknown option "z"'));
    expect(errors).toContainEqual(expect.stringContaining("exactly one correct option"));
  });

  it("fill_blank, order_lines, trace and find_fix_bug inconsistencies", () => {
    const p = clonePack(base);
    const [fill, order, trace, fix] = level(p, "fx.L002").challenges;
    if (
      fill?.type !== "fill_blank" ||
      order?.type !== "order_lines" ||
      trace?.type !== "trace" ||
      fix?.type !== "find_fix_bug"
    )
      throw new Error("fixture changed");
    fill.template = "{{blank:b2}}()";
    order.answer.orders = [["l1", "l2", "l3"]];
    trace.answer.values = { x: ["5"] };
    fix.answer = { line: 99, fix: "f9" };
    const errors = errorsOf(p);
    expect(errors).toContainEqual(expect.stringContaining('blank "b1" does not appear'));
    expect(errors).toContainEqual(expect.stringContaining('placeholder "b2" is not declared'));
    expect(errors).toContainEqual(expect.stringContaining("must use every line exactly once"));
    expect(errors).toContainEqual(expect.stringContaining('field "y" has no accepted values'));
    expect(errors).toContainEqual(expect.stringContaining("beyond the 4-line program"));
    expect(errors).toContainEqual(expect.stringContaining('unknown fix "f9"'));
  });

  it("quests and achievements must reference real levels and zones", () => {
    const p = clonePack(base);
    p.meta.quests[0]!.objectives[0]!.predicate = { kind: "complete_levels", levels: ["fx.L404"] };
    p.meta.achievements[0]!.predicate = { kind: "complete_zone", zone: "fx.zone.void" };
    const errors = errorsOf(p);
    expect(errors).toContainEqual(expect.stringContaining('unknown level "fx.L404"'));
    expect(errors).toContainEqual(expect.stringContaining('unknown zone "fx.zone.void"'));
  });
});
