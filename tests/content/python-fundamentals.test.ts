import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, maxPathXp } from "@/domain";
import { composeFeedback, createDefaultRegistry } from "@/learning/evaluation";
import { findPackDirs } from "@/learning/loader";
import { toPublicLevel } from "@/learning/projection";
import {
  prerequisiteOrder,
  reachableLevels,
  REQUIRED_HINTS,
  validatePack,
} from "@/learning/validate";
import { buildPathRules, LearningService } from "@/services/learning-service";
import { InMemoryProgressStore } from "@/services/progress-store";
import { correctSubmission, wrongSubmission } from "../support/answers";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

const pack = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));
const challenges = pack.levels.flatMap((l) => l.challenges.map((c) => ({ level: l, c })));
const registry = createDefaultRegistry();

describe("content/python-fundamentals — structure", () => {
  it("is the only pack and validates with no errors", () => {
    expect(findPackDirs(CONTENT_ROOT).map((d) => d.split(/[\\/]/).pop())).toEqual([
      "python-fundamentals",
    ]);
    expect(validatePack(pack).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("publishes exactly 25 levels, numbered 1–25, five per zone", () => {
    expect(pack.levels.map((l) => [l.number, l.status])).toEqual(
      Array.from({ length: 25 }, (_, i) => [i + 1, "published"]),
    );
    pack.meta.zones.forEach((zone, z) => {
      expect(pack.levels.filter((l) => l.zone === zone.id).map((l) => l.number)).toEqual(
        [1, 2, 3, 4, 5].map((n) => z * 5 + n),
      );
    });
  });

  it("follows the owner's Phase 2 topic sequence", () => {
    expect(pack.levels.map((l) => l.title)).toEqual([
      "Your First Python Program",
      "Values and Expressions",
      "Variables and Assignment",
      "Basic Data Types",
      "Strings",
      "Numbers and Arithmetic",
      "Input and Output",
      "Boolean Values",
      "Comparisons",
      "Conditional Statements",
      "Multiple Conditions",
      "While Loops",
      "For Loops and Ranges",
      "Loop Control",
      "Lists",
      "List Indexing and Slicing",
      "Tuples",
      "Dictionaries",
      "Sets",
      "Functions",
      "Parameters and Return Values",
      "Scope and Common Errors",
      "Working with Modules",
      "Exceptions and Defensive Programming",
      "Capstone: The Expedition Ledger",
    ]);
  });

  it("has a single starting level and every level is reachable", () => {
    expect(pack.levels.filter((l) => l.prerequisites.length === 0).map((l) => l.id)).toEqual([
      "py.L001",
    ]);
    expect(reachableLevels(pack.levels).size).toBe(25);
    expect(prerequisiteOrder(pack.levels)).toEqual(pack.levels.map((l) => l.id));
  });

  it("marks checkpoints, major encounters and the final boss", () => {
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

  it("gives every level objectives, worked examples, practice, a knowledge check and sources", () => {
    for (const l of pack.levels) {
      expect(l.lesson!.objectives.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.lesson!.examples.length, l.id).toBeGreaterThanOrEqual(1);
      expect(l.lesson!.practicalContext, l.id).toBeTruthy();
      expect(
        l.challenges.some((c) => c.role === "exercise"),
        l.id,
      ).toBe(true);
      expect(
        l.challenges.some((c) => c.role === "check"),
        l.id,
      ).toBe(true);
      expect(l.sources.length, l.id).toBeGreaterThanOrEqual(1);
      expect(l.review?.kind, l.id).toBe("agent");
    }
  });

  it("uses only deterministic, evaluator-backed formats and three hints everywhere", () => {
    for (const { c } of challenges) {
      expect(registry.has(c.type), c.id).toBe(true);
      expect(c.hints, c.id).toHaveLength(REQUIRED_HINTS);
    }
    const formats = new Set(challenges.map(({ c }) => c.type));
    expect([...formats].sort()).toEqual([
      "fill_blank",
      "find_fix_bug",
      "multiple_choice",
      "order_lines",
      "predict_output",
      "trace",
    ]);
  });

  it("never exposes answers, hints or explanations in the public projection", () => {
    for (const l of pack.levels) {
      const pub = JSON.stringify(toPublicLevel(l));
      for (const c of l.challenges) {
        for (const h of c.hints) expect(pub, c.id).not.toContain(JSON.stringify(h).slice(1, -1));
        expect(pub, c.id).not.toContain(JSON.stringify(c.explanation!).slice(1, -1));
      }
    }
  });
});

describe("content/python-fundamentals — answer keys against the evaluators", () => {
  it("accepts every answer key and rejects a wrong answer as incorrect (not invalid)", () => {
    for (const { c } of challenges) {
      expect(registry.evaluate(c, correctSubmission(c)).status, c.id).toBe("correct");
      expect(registry.evaluate(c, wrongSubmission(c)).status, c.id).toBe("incorrect");
    }
  });

  it("delivers every authored misconception message for its answer", () => {
    let checked = 0;
    for (const { c } of challenges) {
      for (const [key, message] of Object.entries(c.feedback?.byAnswer ?? {})) {
        const submission =
          c.type === "multiple_choice"
            ? { selected: key.split(",") }
            : c.type === "predict_output"
              ? { output: key }
              : c.type === "fill_blank" && c.blanks.length === 1
                ? { blanks: { [c.blanks[0]!.id]: key } }
                : c.type === "trace"
                  ? { values: Object.fromEntries(key.split(";").map((kv) => kv.split("="))) }
                  : c.type === "find_fix_bug"
                    ? key.startsWith("fix:")
                      ? { line: c.answer.line, fix: key.slice(4) }
                      : { line: Number(key.slice(5)), fix: c.answer.fix }
                    : undefined;
        if (submission === undefined) continue;
        const result = registry.evaluate(c, submission);
        expect(result.status, `${c.id} ${key}`).toBe("incorrect");
        expect(composeFeedback(c, result).message, `${c.id} ${key}`).toBe(message);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(60);
  });
});

describe("content/python-fundamentals — XP under the default policy", () => {
  it("derives every XP value from the central policy (content carries no XP numbers)", () => {
    const rules = buildPathRules(pack);
    const kinds = { standard: 20, checkpoint: 2, major: 2, boss: 1 };
    const challengeXp = challenges.reduce(
      (s, { c }) =>
        s + DEFAULT_POLICY.xp.perDifficulty * c.difficulty + DEFAULT_POLICY.xp.firstTryBonus,
      0,
    );
    const completionXp = Object.entries(kinds).reduce(
      (s, [k, n]) => s + DEFAULT_POLICY.xp.levelCompletion[k as keyof typeof kinds] * n,
      0,
    );
    expect(completionXp).toBe(20 * 25 + 2 * 50 + 2 * 75 + 150);
    expect(maxPathXp(rules)).toBe(challengeXp + completionXp);
  });

  it("can be played from level 1 to 25 through the service, unlocking each level in turn", async () => {
    const service = new LearningService({
      pack,
      store: new InMemoryProgressStore(),
      now: () => new Date("2026-10-15T00:00:00Z"),
    });
    let n = 0;
    for (const level of pack.levels) {
      const view = await service.getLevel("player", level.id);
      expect(view.status, level.id).toBe("ok");
      for (const c of level.challenges) {
        const r = await service.submit("player", {
          submissionId: `play-${String(n++).padStart(4, "0")}`,
          levelId: level.id,
          challengeId: c.id,
          answer: correctSubmission(c),
        });
        expect(r.status === "evaluated" && r.correct, c.id).toBe(true);
      }
    }
    const path = await service.getPath("player");
    expect(path.levels.every((l) => l.status === "completed" && l.mastered)).toBe(true);
    expect(path.totalXp).toBe(maxPathXp(service.rules));
    expect(path.progressIsDurable).toBe(false);
  });
});

describe("content/python-fundamentals — game layer (Phase 3)", () => {
  async function newGame() {
    const { GameService } = await import("@/services/game-service");
    const { InMemoryGameStateStore } = await import("@/services/game-store");
    let tick = 0;
    const now = () => new Date(Date.UTC(2026, 9, 15, 0, 0, tick++));
    const learning = new LearningService({ pack, store: new InMemoryProgressStore(), now });
    return new GameService({ pack, learning, store: new InMemoryGameStateStore(), now });
  }

  it("declares no quest or achievement XP (rewards are cosmetic items)", () => {
    for (const r of [...pack.meta.quests, ...pack.meta.achievements])
      expect(r.reward.xp, r.id).toBe(0);
    expect(pack.meta.quests.every((q) => q.reward.item)).toBe(true);
  });

  it("a perfect playthrough completes every quest (incl. optional objectives) and unlocks every achievement", async () => {
    const game = await newGame();
    let n = 0;
    for (const level of pack.levels)
      for (const c of level.challenges)
        await game.submit("hero", {
          submissionId: `hero-${String(n++).padStart(4, "0")}`,
          levelId: level.id,
          challengeId: c.id,
          answer: correctSubmission(c),
        });
    const view = await game.getView("hero");
    expect(view.quests.map((q) => [q.id, q.state])).toEqual(
      pack.meta.quests.map((q) => [q.id, "completed"]),
    );
    expect(view.quests.flatMap((q) => q.objectives).every((o) => o.met)).toBe(true);
    expect(view.achievements.filter((a) => !a.unlocked).map((a) => a.id)).toEqual([]);
    expect(view.encounters.map((e) => [e.levelId, e.status, e.flawless])).toEqual([
      ["py.L005", "won", true],
      ["py.L010", "won", true],
      ["py.L015", "won", true],
      ["py.L020", "won", true],
      ["py.L025", "won", true],
    ]);
    expect(view.checkpoints).toEqual(["py.L005", "py.L015"]);
    expect(view.items).toHaveLength(10);
    expect(view.totalXp).toBe(maxPathXp(buildPathRules(pack))); // the game layer added no XP
    expect(view.resumeLevelId).toBeNull();
    expect(view.levels.every((l) => l.review === "agent")).toBe(true);
  });

  it("the final boss can be lost and retried without losing learning progress", async () => {
    const game = await newGame();
    let n = 0;
    const send = (levelId: string, challengeId: string, answer: unknown) =>
      game.submit("rook", {
        submissionId: `rook-${String(n++).padStart(4, "0")}`,
        levelId,
        challengeId,
        answer,
      });
    for (const level of pack.levels.slice(0, 24))
      for (const c of level.challenges) await send(level.id, c.id, correctSubmission(c));
    const boss = pack.levels[24]!;
    const first = boss.challenges[0]!;
    await send(boss.id, first.id, correctSubmission(first));
    const events = [];
    for (let i = 0; i < 3; i++)
      events.push(
        ...(await send(boss.id, boss.challenges[1]!.id, wrongSubmission(boss.challenges[1]!))).game
          .events,
      );
    expect(events.map((e) => e.type)).toEqual([
      "encounter_life_lost",
      "encounter_life_lost",
      "encounter_life_lost",
      "encounter_defeated",
    ]);
    let view = await game.getView("rook");
    expect(view.encounters.at(-1)).toMatchObject({
      levelId: "py.L025",
      status: "defeated",
      defeats: 1,
    });
    const xpAfterDefeat = view.totalXp;
    for (const c of boss.challenges) await send(boss.id, c.id, correctSubmission(c));
    view = await game.getView("rook");
    expect(view.encounters.at(-1)).toMatchObject({ status: "won", runs: 2 });
    expect(view.achievements.find((a) => a.id === "py.ach.expedition-complete")!.unlocked).toBe(
      true,
    );
    expect(view.totalXp).toBeGreaterThan(xpAfterDefeat); // XP earned in the lost run was kept, new firsts still pay
  });
});
