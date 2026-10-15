import { describe, expect, it } from "vitest";
import { challengeKeys } from "@/learning/keys";
import { displayOrder, toPublicLevel } from "@/learning/projection";
import type { Challenge, Level } from "@/learning/schema";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

const CANARY = "CANARY-SECRET-7f3a";

/** Plant the canary in every server-only field of every challenge type. */
function withCanaries(level: Level): Level {
  const l = structuredClone(level);
  for (const c of l.challenges as Challenge[]) {
    c.hints = [CANARY];
    c.explanation = CANARY;
    c.feedback = { correct: CANARY, incorrect: CANARY, byAnswer: { [CANARY]: CANARY } };
    switch (c.type) {
      case "multiple_choice":
        c.answer.correct = [`${CANARY}-opt`];
        break;
      case "predict_output":
        c.answer = { output: CANARY, acceptedVariants: [CANARY] };
        break;
      case "fill_blank":
        c.answer = { accepted: { b1: [CANARY] } };
        break;
      case "order_lines":
        c.answer = { orders: [[...c.lines.map((x) => x.id)], [CANARY, CANARY]] };
        break;
      case "trace":
        c.answer = { values: { x: [CANARY] } };
        break;
      case "find_fix_bug":
        c.answer = { line: 1, fix: CANARY };
        break;
      case "code_write":
        c.answer = { tests: [{ stdin: CANARY, expectedOutput: CANARY }] };
        break;
    }
  }
  return l;
}

describe("public projection", () => {
  const pack = loadOrThrow(VALID_SMALL);

  it("never contains answers, feedback, hints or explanations for any challenge type", () => {
    for (const level of pack.levels) {
      const pub = toPublicLevel(withCanaries(level));
      expect(JSON.stringify(pub)).not.toContain(CANARY);
      for (const key of ["status", "outline", "review", "sources"])
        expect(pub).not.toHaveProperty(key);
      for (const c of pub.challenges)
        for (const key of ["answer", "feedback", "explanation", "hints"])
          expect(c).not.toHaveProperty(key);
    }
  });

  it("keeps what learners need to attempt each challenge", () => {
    const pub = toPublicLevel(pack.levels[0]!);
    expect(pub.lesson?.objectives[0]).toBeTruthy();
    expect(pub.lesson?.examples).toHaveLength(1);
    expect(pub.lesson?.practicalContext).toBeTruthy();
    expect(pub.challenges[0]).toMatchObject({
      type: "predict_output",
      code: 'print("2" + "3")',
      hintCount: 3,
      role: "exercise",
      required: true,
    });
    expect(pub.challenges[1]).toMatchObject({ type: "multiple_choice" });
  });

  it("server-only keys carry the answers the projection withholds", () => {
    const keys = challengeKeys(pack.levels[0]!);
    expect(keys.get("fx.L001.c1")?.answer).toEqual({ output: "23", acceptedVariants: [] });
  });

  it("shows order_lines deterministically and never in an accepted order", () => {
    const level = pack.levels.find((l) => l.id === "fx.L002")!;
    const c = level.challenges.find((x) => x.type === "order_lines");
    if (c?.type !== "order_lines") throw new Error("fixture changed");
    const first = displayOrder(c).map((l) => l.id);
    expect(displayOrder(c).map((l) => l.id)).toEqual(first);
    expect(c.answer.orders.map((o) => o.join())).not.toContain(first.join());
    expect([...first].sort()).toEqual(c.lines.map((l) => l.id).sort());
  });
});
