import { describe, expect, it } from "vitest";
import {
  applyAttempt,
  applyHintReveal,
  DEFAULT_POLICY,
  emptyProgress,
  isUnlocked,
  levelView,
  maxPathXp,
  totalXp,
  type LearnerProgress,
  type PathRules,
  type ProgressionPolicy,
} from "@/domain";

const rules: PathRules = {
  pathId: "p",
  levels: [
    {
      id: "L1",
      number: 1,
      kind: "standard",
      prerequisites: [],
      challenges: [
        { id: "L1.ex", difficulty: 1, role: "exercise", required: true, hintCount: 3 },
        { id: "L1.check", difficulty: 2, role: "check", required: true, hintCount: 3 },
        { id: "L1.bonus", difficulty: 3, role: "exercise", required: false, hintCount: 3 },
      ],
    },
    {
      id: "L2",
      number: 2,
      kind: "boss",
      prerequisites: ["L1"],
      challenges: [{ id: "L2.check", difficulty: 1, role: "check", required: true, hintCount: 2 }],
    },
  ],
};

const T = "2026-10-15T00:00:00Z";

function attempt(
  p: LearnerProgress,
  levelId: string,
  challengeId: string,
  correct: boolean,
  policy: ProgressionPolicy = DEFAULT_POLICY,
): LearnerProgress {
  const r = applyAttempt(rules, p, { levelId, challengeId, correct, at: T }, policy);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.progress;
}

function hint(p: LearnerProgress, levelId: string, challengeId: string): LearnerProgress {
  const r = applyHintReveal(rules, p, { levelId, challengeId });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.progress;
}

describe("unlocks", () => {
  it("starts with only the root level available", () => {
    const p = emptyProgress("p");
    expect(levelView(rules, p, "L1")).toEqual({
      levelId: "L1",
      status: "available",
      mastered: false,
      attempted: false,
    });
    expect(levelView(rules, p, "L2").status).toBe("locked");
  });

  it("refuses attempts and hints on locked levels (authoritative prerequisite check)", () => {
    const p = emptyProgress("p");
    expect(
      applyAttempt(rules, p, { levelId: "L2", challengeId: "L2.check", correct: true, at: T }),
    ).toEqual({
      ok: false,
      error: { code: "level_locked", levelId: "L2" },
    });
    expect(applyHintReveal(rules, p, { levelId: "L2", challengeId: "L2.check" })).toMatchObject({
      ok: false,
      error: { code: "level_locked" },
    });
  });

  it("rejects unknown levels and challenges, including challenges from another level", () => {
    const p = emptyProgress("p");
    expect(
      applyAttempt(rules, p, { levelId: "L9", challengeId: "x", correct: true, at: T }),
    ).toMatchObject({
      error: { code: "unknown_level" },
    });
    expect(
      applyAttempt(rules, p, { levelId: "L1", challengeId: "L2.check", correct: true, at: T }),
    ).toMatchObject({
      error: { code: "unknown_challenge" },
    });
  });

  it("unlocks the next level when required challenges are complete, and says so", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    const r = applyAttempt(rules, p, {
      levelId: "L1",
      challengeId: "L1.check",
      correct: true,
      at: T,
    });
    if (!r.ok) throw new Error();
    p = r.progress;
    expect(r.events.map((e) => e.type)).toEqual([
      "challenge_attempted",
      "challenge_solved",
      "xp_awarded",
      "xp_awarded",
      "level_completed",
      "xp_awarded",
      "level_mastered",
      "level_unlocked",
    ]);
    expect(isUnlocked(rules, p, "L2")).toBe(true);
    expect(levelView(rules, p, "L1").status).toBe("completed");
  });

  it("can require mastery instead of completion", () => {
    const policy = { ...DEFAULT_POLICY, unlockRequires: "mastered" as const };
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true, policy);
    p = attempt(p, "L1", "L1.check", false, policy);
    p = attempt(p, "L1", "L1.check", true, policy);
    expect(levelView(rules, p, "L1", policy)).toMatchObject({
      status: "completed",
      mastered: false,
    });
    expect(isUnlocked(rules, p, "L2", policy)).toBe(false);
  });
});

describe("attempted → correct → completed → mastered", () => {
  it("tracks a level that is attempted but not completed", () => {
    const p = attempt(emptyProgress("p"), "L1", "L1.ex", false);
    expect(levelView(rules, p, "L1")).toMatchObject({ status: "in_progress", attempted: true });
    expect(p.levels.L1!.challenges["L1.ex"]).toMatchObject({
      attempts: 1,
      correct: false,
      firstTryClean: false,
    });
  });

  it("completes when every required challenge is correct (optional ones are not needed)", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    expect(p.levels.L1!.completedAt).toBeUndefined();
    p = attempt(p, "L1", "L1.check", true);
    expect(p.levels.L1!.completedAt).toBe(T);
    expect(p.levels.L1!.challenges["L1.bonus"]).toBeUndefined();
  });

  it("does not grant mastery when the knowledge check needed a retry", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    p = attempt(p, "L1", "L1.check", false);
    p = attempt(p, "L1", "L1.check", true); // immediate retry after feedback
    expect(levelView(rules, p, "L1")).toMatchObject({ status: "completed", mastered: false });
  });

  it("does not grant mastery when a hint was used, but a clean replay earns it", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    p = hint(p, "L1", "L1.check");
    p = attempt(p, "L1", "L1.check", true);
    expect(levelView(rules, p, "L1").mastered).toBe(false);

    p = hint(p, "L1", "L1.check"); // a hint during the replay still blocks it
    p = attempt(p, "L1", "L1.check", true);
    expect(levelView(rules, p, "L1").mastered).toBe(false);

    p = attempt(p, "L1", "L1.check", true); // clean replay after completion
    expect(levelView(rules, p, "L1").mastered).toBe(true);
  });

  it("never loses completion or mastery after later wrong answers", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    p = attempt(p, "L1", "L1.check", true);
    p = attempt(p, "L1", "L1.check", false);
    p = attempt(p, "L1", "L1.ex", false);
    expect(levelView(rules, p, "L1")).toMatchObject({ status: "completed", mastered: true });
  });

  it("does not mutate the input progress", () => {
    const p = emptyProgress("p");
    attempt(p, "L1", "L1.ex", true);
    expect(p).toEqual(emptyProgress("p"));
  });
});

describe("XP", () => {
  it("awards per difficulty, first-try bonus and completion by level kind", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true); // 10 + 5
    p = attempt(p, "L1", "L1.check", true); // 20 + 5, completion 25
    expect(totalXp(p)).toBe(65);
    p = attempt(p, "L2", "L2.check", true); // 10 + 5, boss 150
    expect(totalXp(p)).toBe(230);
    expect(p.xp.map((e) => e.sourceKey)).toEqual([
      "challenge:L1.ex",
      "challenge-first-try:L1.ex",
      "challenge:L1.check",
      "challenge-first-try:L1.check",
      "level:L1",
      "challenge:L2.check",
      "challenge-first-try:L2.check",
      "level:L2",
    ]);
  });

  it("gives no XP for wrong answers and never subtracts XP", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", false);
    expect(totalXp(p)).toBe(0);
    p = attempt(p, "L1", "L1.ex", true); // base only: not first try
    expect(totalXp(p)).toBe(10);
    expect(p.xp.every((e) => e.amount > 0)).toBe(true);
  });

  it("drops only the first-try bonus when a hint was used", () => {
    let p = hint(emptyProgress("p"), "L1", "L1.ex");
    p = attempt(p, "L1", "L1.ex", true);
    expect(p.xp.map((e) => e.sourceKey)).toEqual(["challenge:L1.ex"]);
  });

  it("cannot award the same XP twice, however often a challenge is answered", () => {
    let p = emptyProgress("p");
    for (let i = 0; i < 5; i++) p = attempt(p, "L1", "L1.ex", true);
    p = attempt(p, "L1", "L1.check", true);
    for (let i = 0; i < 5; i++) p = attempt(p, "L1", "L1.check", true);
    const keys = p.xp.map((e) => e.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(totalXp(p)).toBe(65);
  });

  it("follows the replay policy: replay is allowed and earns no repeat XP", () => {
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true);
    p = attempt(p, "L1", "L1.check", true);
    const before = totalXp(p);
    const r = applyAttempt(rules, p, { levelId: "L1", challengeId: "L1.ex", correct: true, at: T });
    expect(r.ok && r.events.some((e) => e.type === "xp_awarded")).toBe(false);
    p = attempt(p, "L1", "L1.ex", true);
    expect(totalXp(p)).toBe(before);
  });

  it("refuses replay when the policy disables it", () => {
    const policy = { ...DEFAULT_POLICY, replay: { allowed: false } };
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true, policy);
    p = attempt(p, "L1", "L1.check", true, policy);
    expect(
      applyAttempt(rules, p, { levelId: "L1", challengeId: "L1.ex", correct: true, at: T }, policy),
    ).toMatchObject({
      ok: false,
      error: { code: "replay_disabled" },
    });
  });

  it("pays an optional mastery bonus exactly once when configured", () => {
    const policy = { ...DEFAULT_POLICY, xp: { ...DEFAULT_POLICY.xp, masteryBonus: 20 } };
    let p = attempt(emptyProgress("p"), "L1", "L1.ex", true, policy);
    p = attempt(p, "L1", "L1.check", true, policy);
    p = attempt(p, "L1", "L1.check", true, policy);
    expect(p.xp.filter((e) => e.reason === "level_mastered")).toHaveLength(1);
  });

  it("computes the maximum XP a path can award", () => {
    // L1: 25 + (10+5) + (20+5) + (30+5) ; L2: 150 + (10+5)
    expect(maxPathXp(rules)).toBe(100 + 165);
  });
});

describe("hints", () => {
  it("reveals tiers strictly in order and stops at the last one", () => {
    let p = emptyProgress("p");
    const tiers: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = applyHintReveal(rules, p, { levelId: "L1", challengeId: "L1.ex" });
      if (!r.ok) throw new Error();
      tiers.push(r.tier);
      p = r.progress;
    }
    expect(tiers).toEqual([1, 2, 3]);
    expect(applyHintReveal(rules, p, { levelId: "L1", challengeId: "L1.ex" })).toMatchObject({
      ok: false,
      error: { code: "no_more_hints" },
    });
    expect(levelView(rules, p, "L1").status).toBe("in_progress");
  });
});
