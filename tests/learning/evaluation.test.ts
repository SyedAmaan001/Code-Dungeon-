import { describe, expect, it } from "vitest";
import {
  BUILT_IN_EVALUATORS,
  composeFeedback,
  createDefaultRegistry,
  defineEvaluator,
  EvaluatorRegistry,
  normalizeOutput,
  normalizeToken,
} from "@/learning/evaluation";
import { z } from "zod";
import type { Challenge } from "@/learning/schema";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

const pack = loadOrThrow(VALID_SMALL);
const challenge = (id: string): Challenge => {
  const c = pack.levels.flatMap((l) => l.challenges).find((x) => x.id === id);
  if (!c) throw new Error(`fixture has no ${id}`);
  return c;
};
const registry = createDefaultRegistry();
const evaluate = (id: string, submission: unknown) => registry.evaluate(challenge(id), submission);

describe("normalisation", () => {
  it("ignores only invisible output differences", () => {
    expect(normalizeOutput("23  \r\n\n")).toBe("23");
    expect(normalizeOutput("a\rb")).toBe("a\nb");
    expect(normalizeOutput("  23")).toBe("  23"); // leading spaces are visible output
    expect(normalizeOutput("a  b")).toBe("a  b"); // internal spacing is visible output
  });
  it("trims tokens but preserves case and inner whitespace", () => {
    expect(normalizeToken("  print \n")).toBe("print");
    expect(normalizeToken("Print")).toBe("Print");
    expect(normalizeToken('"a  b"')).toBe('"a  b"');
  });
});

describe("multiple_choice", () => {
  it("accepts the correct option and rejects others with targeted feedback", () => {
    expect(evaluate("fx.L001.c2", { selected: ["a"] })).toEqual({ status: "correct" });
    const wrong = evaluate("fx.L001.c2", { selected: ["b"] });
    expect(wrong).toEqual({ status: "incorrect", misconceptionKey: "b" });
    expect(composeFeedback(challenge("fx.L001.c2"), wrong).message).toContain("variable name");
    expect(
      composeFeedback(challenge("fx.L001.c2"), evaluate("fx.L001.c2", { selected: ["c"] })).message,
    ).toBe("Check the quotes and the capital letter.");
  });
  it("rejects malformed selections without counting them", () => {
    expect(evaluate("fx.L001.c2", { selected: ["z"] }).status).toBe("invalid_submission");
    expect(evaluate("fx.L001.c2", { selected: ["a", "b"] })).toMatchObject({
      status: "invalid_submission",
      reason: "choose exactly one option",
    });
    expect(evaluate("fx.L001.c2", { selected: [] }).status).toBe("invalid_submission");
    expect(evaluate("fx.L001.c2", "a").status).toBe("invalid_submission");
    expect(evaluate("fx.L001.c2", null).status).toBe("invalid_submission");
  });
  it("treats duplicate selections of the same option as one", () => {
    expect(evaluate("fx.L001.c2", { selected: ["a", "a"] })).toEqual({ status: "correct" });
  });
  it("reports partial progress for multi-select without naming options", () => {
    const multi = {
      ...challenge("fx.L001.c2"),
      allowMultiple: true,
      answer: { correct: ["a", "c"] },
    } as Challenge;
    const r = registry.evaluate(multi, { selected: ["a", "b"] });
    expect(r).toMatchObject({
      status: "incorrect",
      detail: { kind: "selection", missed: 1, wrongSelected: 1 },
    });
    expect(composeFeedback(multi, r).detail).toMatch(/don't fit.*missing/);
  });
});

describe("predict_output", () => {
  it("accepts the exact output, tolerating trailing whitespace and line endings", () => {
    expect(evaluate("fx.L001.c1", { output: "23" }).status).toBe("correct");
    expect(evaluate("fx.L001.c1", { output: "23 \r\n" }).status).toBe("correct");
  });
  it("keeps case, quotes and leading spaces significant", () => {
    expect(evaluate("fx.L001.c1", { output: '"23"' }).status).toBe("incorrect");
    expect(evaluate("fx.L001.c1", { output: " 23" }).status).toBe("incorrect");
  });
  it("matches authored misconceptions", () => {
    const r = evaluate("fx.L001.c1", { output: "5" });
    expect(r).toEqual({ status: "incorrect", misconceptionKey: "5" });
    expect(composeFeedback(challenge("fx.L001.c1"), r).message).toContain("these are strings");
  });
  it("rejects oversized or wrongly shaped submissions", () => {
    expect(evaluate("fx.L001.c1", { output: "x".repeat(2_001) }).status).toBe("invalid_submission");
    expect(evaluate("fx.L001.c1", { output: 23 }).status).toBe("invalid_submission");
  });
});

describe("fill_blank", () => {
  it("accepts trimmed answers and is case-sensitive", () => {
    expect(evaluate("fx.L002.c1", { blanks: { b1: " print " } }).status).toBe("correct");
    const r = evaluate("fx.L002.c1", { blanks: { b1: "Print" } });
    expect(r).toMatchObject({ status: "incorrect", misconceptionKey: "Print" });
    expect(composeFeedback(challenge("fx.L002.c1"), r).message).toContain("case-sensitive");
  });
  it("requires every blank and nothing else", () => {
    expect(evaluate("fx.L002.c1", { blanks: {} }).status).toBe("invalid_submission");
    expect(evaluate("fx.L002.c1", { blanks: { b1: "   " } }).status).toBe("invalid_submission");
    expect(evaluate("fx.L002.c1", { blanks: { b1: "print", b9: "x" } }).status).toBe(
      "invalid_submission",
    );
  });
});

describe("order_lines", () => {
  it("accepts an accepted order", () => {
    expect(evaluate("fx.L002.c2", { order: ["l1", "l2", "l3", "l4"] }).status).toBe("correct");
  });
  it("reports how many lines are in place without saying which", () => {
    const r = evaluate("fx.L002.c2", { order: ["l1", "l2", "l4", "l3"] });
    expect(r).toEqual({ status: "incorrect", detail: { kind: "positions", inPlace: 2, total: 4 } });
    expect(composeFeedback(challenge("fx.L002.c2"), r).detail).toBe(
      "2 of 4 lines are already in the right place.",
    );
  });
  it("rejects orders that omit, repeat or invent lines", () => {
    for (const order of [
      ["l1", "l2", "l3"],
      ["l1", "l1", "l2", "l3"],
      ["l1", "l2", "l3", "l9"],
    ])
      expect(evaluate("fx.L002.c2", { order }).status).toBe("invalid_submission");
  });
});

describe("trace", () => {
  it("checks every field and names the wrong ones", () => {
    expect(evaluate("fx.L002.c3", { values: { x: "5", y: "10" } }).status).toBe("correct");
    const r = evaluate("fx.L002.c3", { values: { x: "5", y: "6" } });
    expect(r).toMatchObject({
      status: "incorrect",
      detail: { kind: "fields", incorrect: ["y"], total: 2 },
    });
    expect(composeFeedback(challenge("fx.L002.c3"), r).detail).toBe("Check again: y.");
  });
});

describe("find_fix_bug", () => {
  it("requires the right line and the right fix", () => {
    expect(evaluate("fx.L002.c4", { line: 3, fix: "f1" }).status).toBe("correct");
    const rightLine = evaluate("fx.L002.c4", { line: 3, fix: "f2" });
    expect(rightLine).toMatchObject({
      status: "incorrect",
      misconceptionKey: "fix:f2",
      detail: { lineCorrect: true },
    });
    expect(composeFeedback(challenge("fx.L002.c4"), rightLine).message).toContain("tuple");
    expect(evaluate("fx.L002.c4", { line: 1, fix: "f1" })).toMatchObject({
      status: "incorrect",
      detail: { kind: "bug", lineCorrect: false },
    });
  });
  it("rejects impossible lines and unknown fixes", () => {
    expect(evaluate("fx.L002.c4", { line: 99, fix: "f1" }).status).toBe("invalid_submission");
    expect(evaluate("fx.L002.c4", { line: 0, fix: "f1" }).status).toBe("invalid_submission");
    expect(evaluate("fx.L002.c4", { line: 3, fix: "f9" }).status).toBe("invalid_submission");
    expect(evaluate("fx.L002.c4", { line: 2.5, fix: "f1" }).status).toBe("invalid_submission");
  });
});

describe("untrusted fields and engine failures", () => {
  it("rejects submissions that try to carry score, XP or correctness", () => {
    for (const extra of [{ xp: 9999 }, { correct: true }, { score: 100 }])
      expect(evaluate("fx.L001.c1", { output: "23", ...extra }).status).toBe("invalid_submission");
  });

  it("reports a missing evaluator as an evaluation error, not a wrong answer", () => {
    const codeWrite = challenge("fx.L003.c1");
    const r = registry.evaluate(codeWrite, { code: "print(1)" });
    expect(r).toMatchObject({ status: "evaluation_error" });
    expect(composeFeedback(codeWrite, r)).toMatchObject({ tone: "error", counted: false });
  });

  it("contains evaluator crashes and keeps the cause out of learner feedback", () => {
    const broken = new EvaluatorRegistry([
      defineEvaluator("predict_output", z.strictObject({ output: z.string() }), () => {
        throw new Error("internal detail");
      }),
    ]);
    const r = broken.evaluate(challenge("fx.L001.c1"), { output: "23" });
    expect(r).toEqual({
      status: "evaluation_error",
      reason: "the answer could not be checked",
      cause: "internal detail",
    });
    expect(JSON.stringify(composeFeedback(challenge("fx.L001.c1"), r))).not.toContain(
      "internal detail",
    );
  });

  it("refuses to register two evaluators for one format", () => {
    expect(() => createDefaultRegistry().register(BUILT_IN_EVALUATORS[0]!)).toThrow(
      /already registered/,
    );
  });

  it("lets a future subject register its own format", () => {
    const custom = new EvaluatorRegistry().register({
      type: "numeric_answer",
      evaluate: () => ({ status: "correct" }),
    });
    expect(custom.types()).toEqual(["numeric_answer"]);
  });
});

describe("feedback", () => {
  it("shows the explanation only after a correct answer", () => {
    const c = challenge("fx.L001.c1");
    expect(composeFeedback(c, { status: "correct" }).explanation).toBe(c.explanation);
    expect(composeFeedback(c, { status: "incorrect" }).explanation).toBeUndefined();
  });
  it("marks invalid submissions as not counted", () => {
    expect(
      composeFeedback(challenge("fx.L001.c1"), { status: "invalid_submission", reason: "x" }),
    ).toMatchObject({
      tone: "invalid",
      counted: false,
    });
  });
});
