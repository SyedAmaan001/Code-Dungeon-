import { describe, expect, it } from "vitest";
import {
  applyAttempt,
  applyHintRevealed,
  applyVerifiedAttempt,
  emptyGameState,
  emptyProgress,
  evaluatePredicate,
  gameView,
  reconcile,
  type GameEvent,
  type GameRules,
  type GameState,
  type LearnerProgress,
  type PathRules,
} from "@/domain";

const T = "2026-10-15T00:00:00Z";

// L1 standard → L2 checkpoint → L3 boss (with one optional challenge)
const pathRules: PathRules = {
  pathId: "p",
  levels: [
    {
      id: "L1",
      number: 1,
      kind: "standard",
      prerequisites: [],
      challenges: [
        { id: "L1.a", difficulty: 1, role: "exercise", required: true, hintCount: 3 },
        { id: "L1.b", difficulty: 1, role: "check", required: true, hintCount: 3 },
      ],
    },
    {
      id: "L2",
      number: 2,
      kind: "checkpoint",
      prerequisites: ["L1"],
      challenges: [
        { id: "L2.a", difficulty: 1, role: "exercise", required: true, hintCount: 3 },
        { id: "L2.b", difficulty: 1, role: "check", required: true, hintCount: 3 },
      ],
    },
    {
      id: "L3",
      number: 3,
      kind: "boss",
      prerequisites: ["L2"],
      challenges: [
        { id: "L3.a", difficulty: 2, role: "exercise", required: true, hintCount: 3 },
        { id: "L3.b", difficulty: 2, role: "check", required: true, hintCount: 3 },
        { id: "L3.x", difficulty: 1, role: "exercise", required: false, hintCount: 3 },
      ],
    },
  ],
};

const rules: GameRules = {
  pathId: "p",
  levels: [
    {
      id: "L1",
      number: 1,
      zone: "z1",
      kind: "standard",
      challenges: [
        { id: "L1.a", type: "predict_output", required: true },
        { id: "L1.b", type: "multiple_choice", required: true },
      ],
    },
    {
      id: "L2",
      number: 2,
      zone: "z1",
      kind: "checkpoint",
      challenges: [
        { id: "L2.a", type: "find_fix_bug", required: true },
        { id: "L2.b", type: "multiple_choice", required: true },
      ],
    },
    {
      id: "L3",
      number: 3,
      zone: "z2",
      kind: "boss",
      challenges: [
        { id: "L3.a", type: "find_fix_bug", required: true },
        { id: "L3.b", type: "multiple_choice", required: true },
        { id: "L3.x", type: "trace", required: false },
      ],
    },
  ],
  quests: [
    {
      id: "q.camp",
      objectives: [
        { id: "o1", predicate: { kind: "complete_levels", levels: ["L1"] }, optional: false },
        { id: "o2", predicate: { kind: "encounter_won", level: "L2" }, optional: false },
        { id: "bonus", predicate: { kind: "earn_xp", amount: 10_000 }, optional: true },
      ],
      rewardItem: "gate-key",
    },
    {
      id: "q.boss",
      activation: { kind: "level_unlocked", level: "L3" },
      objectives: [
        { id: "o1", predicate: { kind: "encounter_won", level: "L3" }, optional: false },
      ],
      rewardItem: "crown",
    },
  ],
  achievements: [
    { id: "first", predicate: { kind: "complete_level_count", count: 1 }, rewardItem: "ring" },
    { id: "zone1", predicate: { kind: "complete_zone", zone: "z1" } },
    {
      id: "flawless-boss",
      predicate: { kind: "flawless_encounters", encounterKind: "boss", count: 1 },
      rewardItem: "goggles",
    },
    {
      id: "bug-hunter",
      predicate: { kind: "correct_challenges_of_type", challengeType: "find_fix_bug", count: 2 },
    },
    { id: "clean", predicate: { kind: "level_no_hints_first_try", count: 1 } },
  ],
};

/** A learner session: learning progress via the real progression engine, game state via the game engine. */
class Session {
  progress: LearnerProgress = emptyProgress("p");
  game: GameState = emptyGameState("p");
  events: GameEvent[] = [];

  answer(levelId: string, challengeId: string, correct: boolean) {
    const learned = applyAttempt(pathRules, this.progress, {
      levelId,
      challengeId,
      correct,
      at: T,
    });
    if (!learned.ok) throw new Error(`learning rejected: ${learned.error.code}`);
    this.progress = learned.progress;
    this.apply(applyVerifiedAttempt(rules, this.game, { levelId, challengeId, correct, at: T }));
    this.apply(reconcile({ rules, pathRules, progress: this.progress }, this.game, T));
    return this;
  }

  hint(levelId: string) {
    this.apply(applyHintRevealed(rules, this.game, { levelId, at: T }));
    return this;
  }

  private apply(o: { state: GameState; events: GameEvent[] }) {
    this.game = o.state;
    this.events.push(...o.events);
  }

  types() {
    return this.events.map((e) => e.type);
  }

  view() {
    return gameView({ rules, pathRules, progress: this.progress }, this.game);
  }
}

const clearL1 = (s: Session) => s.answer("L1", "L1.a", true).answer("L1", "L1.b", true);
const clearL2 = (s: Session) => s.answer("L2", "L2.a", true).answer("L2", "L2.b", true);

describe("normal progress", () => {
  it("activates the starting quest, completes objectives and unlocks achievements once", () => {
    const s = new Session();
    s.answer("L1", "L1.a", true);
    expect(s.types()).toEqual(["quest_activated"]);
    s.answer("L1", "L1.b", true);
    expect(s.events.slice(1)).toEqual([
      { type: "quest_objective_met", questId: "q.camp", objectiveId: "o1" },
      { type: "achievement_unlocked", achievementId: "first" },
      { type: "item_awarded", item: "ring", source: "achievement:first" },
      { type: "achievement_unlocked", achievementId: "clean" },
    ]);
  });

  it("standard levels are not encounters", () => {
    const s = clearL1(new Session());
    expect(s.types()).not.toContain("encounter_started");
    expect(s.view().encounters.map((e) => e.levelId)).toEqual(["L2", "L3"]);
  });
});

describe("checkpoint encounters", () => {
  it("start on the first answer, cannot be lost, and record the checkpoint when cleared", () => {
    const s = clearL1(new Session());
    s.answer("L2", "L2.a", false)
      .answer("L2", "L2.a", false)
      .answer("L2", "L2.a", false)
      .answer("L2", "L2.a", false);
    expect(s.types()).not.toContain("encounter_defeated");
    expect(s.types()).not.toContain("encounter_life_lost");
    clearL2(s);
    expect(s.events).toContainEqual({
      type: "encounter_won",
      levelId: "L2",
      encounterKind: "checkpoint",
      run: 1,
      flawless: false,
    });
    expect(s.events).toContainEqual({ type: "checkpoint_reached", levelId: "L2" });
    expect(s.view()).toMatchObject({ checkpoints: ["L2"], lastCheckpoint: "L2" });
  });

  it("completing the checkpoint completes the camp quest, the zone achievement and awards the item once", () => {
    const s = clearL2(clearL1(new Session()));
    expect(s.events).toContainEqual({ type: "quest_completed", questId: "q.camp" });
    expect(s.events).toContainEqual({ type: "achievement_unlocked", achievementId: "zone1" });
    expect(s.events).toContainEqual({
      type: "item_awarded",
      item: "gate-key",
      source: "quest:q.camp",
    });
    expect(s.events).toContainEqual({ type: "quest_activated", questId: "q.boss" }); // L3 unlocked
    expect(s.view().items).toEqual(["ring", "gate-key"]);
  });
});

describe("boss encounters", () => {
  const atBoss = () => clearL2(clearL1(new Session()));

  it("wins flawlessly with no mistakes and no hints; optional challenges are not needed", () => {
    const s = atBoss().answer("L3", "L3.a", true).answer("L3", "L3.b", true);
    expect(s.events).toContainEqual({
      type: "encounter_started",
      levelId: "L3",
      encounterKind: "boss",
      run: 1,
      lives: 3,
    });
    expect(s.events).toContainEqual({
      type: "encounter_won",
      levelId: "L3",
      encounterKind: "boss",
      run: 1,
      flawless: true,
    });
    expect(s.events).toContainEqual({
      type: "achievement_unlocked",
      achievementId: "flawless-boss",
    });
    expect(s.events).toContainEqual({ type: "quest_completed", questId: "q.boss" });
  });

  it("loses a life per wrong answer and is defeated at zero lives without losing learning progress", () => {
    const s = atBoss()
      .answer("L3", "L3.a", true)
      .answer("L3", "L3.b", false)
      .answer("L3", "L3.b", false)
      .answer("L3", "L3.b", false);
    expect(s.events.filter((e) => e.type === "encounter_life_lost")).toEqual([
      { type: "encounter_life_lost", levelId: "L3", livesRemaining: 2 },
      { type: "encounter_life_lost", levelId: "L3", livesRemaining: 1 },
      { type: "encounter_life_lost", levelId: "L3", livesRemaining: 0 },
    ]);
    expect(s.events).toContainEqual({ type: "encounter_defeated", levelId: "L3", run: 1 });
    expect(s.view().encounters[1]).toMatchObject({
      status: "defeated",
      defeats: 1,
      livesRemaining: 3,
    });
    // learning progress from the defeated run is kept
    expect(s.progress.levels.L3!.challenges["L3.a"]!.correct).toBe(true);
  });

  it("needs every required challenge solved within one run after a defeat", () => {
    const s = atBoss()
      .answer("L3", "L3.a", true)
      .answer("L3", "L3.b", false)
      .answer("L3", "L3.b", false)
      .answer("L3", "L3.b", false);
    s.answer("L3", "L3.b", true); // run 2 starts; L3.a was solved in run 1 only
    expect(s.events).toContainEqual(expect.objectContaining({ type: "encounter_started", run: 2 }));
    expect(s.events).not.toContainEqual(
      expect.objectContaining({ type: "encounter_won", levelId: "L3" }),
    );
    expect(s.progress.levels.L3!.completedAt).toBe(T); // learning completion is unaffected by encounters
    s.answer("L3", "L3.a", true);
    expect(s.events).toContainEqual({
      type: "encounter_won",
      levelId: "L3",
      encounterKind: "boss",
      run: 2,
      flawless: true,
    });
  });

  it("a hint during the winning run makes the victory non-flawless", () => {
    const s = atBoss().hint("L3").answer("L3", "L3.a", true).answer("L3", "L3.b", true);
    expect(s.events).toContainEqual(
      expect.objectContaining({ type: "encounter_won", flawless: false }),
    );
    expect(s.events).not.toContainEqual({
      type: "achievement_unlocked",
      achievementId: "flawless-boss",
    });
  });

  it("replays after victory start no new runs and change nothing", () => {
    const s = atBoss().answer("L3", "L3.a", true).answer("L3", "L3.b", true);
    const before = structuredClone(s.game);
    const n = s.events.length;
    s.answer("L3", "L3.a", false).answer("L3", "L3.b", true).hint("L3");
    expect(s.events.length).toBe(n);
    expect(s.game).toEqual(before);
  });
});

describe("idempotency and determinism", () => {
  it("reconcile is idempotent: re-running it awards nothing new", () => {
    const s = clearL2(clearL1(new Session()));
    const again = reconcile({ rules, pathRules, progress: s.progress }, s.game, T);
    expect(again.events).toEqual([]);
    expect(again.state).toBe(s.game);
  });

  it("reconcile self-heals: progress made without game updates is recognised later, once", () => {
    let progress = emptyProgress("p");
    for (const [l, c] of [
      ["L1", "L1.a"],
      ["L1", "L1.b"],
    ] as const) {
      const r = applyAttempt(pathRules, progress, {
        levelId: l,
        challengeId: c,
        correct: true,
        at: T,
      });
      if (r.ok) progress = r.progress;
    }
    const first = reconcile({ rules, pathRules, progress }, emptyGameState("p"), T);
    expect(first.events.filter((e) => e.type === "achievement_unlocked")).toHaveLength(2);
    expect(reconcile({ rules, pathRules, progress }, first.state, T).events).toEqual([]);
  });

  it("ignores attempts for unknown levels or challenges that do not belong to the level", () => {
    const g = emptyGameState("p");
    expect(
      applyVerifiedAttempt(rules, g, { levelId: "L9", challengeId: "x", correct: true, at: T }),
    ).toEqual({ state: g, events: [] });
    expect(
      applyVerifiedAttempt(rules, g, { levelId: "L2", challengeId: "L1.a", correct: true, at: T }),
    ).toEqual({ state: g, events: [] });
  });

  it("does not mutate its input state", () => {
    const g = emptyGameState("p");
    applyVerifiedAttempt(rules, g, { levelId: "L2", challengeId: "L2.a", correct: false, at: T });
    expect(g).toEqual(emptyGameState("p"));
  });
});

describe("achievement and quest eligibility", () => {
  it("reports progress toward each predicate", () => {
    const s = clearL1(new Session()).answer("L2", "L2.a", true);
    const view = s.view();
    expect(view.achievements.find((a) => a.id === "bug-hunter")).toMatchObject({
      unlocked: false,
      progress: { met: false, current: 1, target: 2 },
    });
    expect(view.quests.find((q) => q.id === "q.boss")).toMatchObject({ state: "locked" });
    expect(
      view.quests.find((q) => q.id === "q.camp")!.objectives.find((o) => o.id === "bonus"),
    ).toMatchObject({
      optional: true,
      met: false,
    });
  });

  it("does not unlock level_no_hints_first_try when a hint or a wrong first attempt was involved", () => {
    const s = new Session()
      .answer("L1", "L1.a", false)
      .answer("L1", "L1.a", true)
      .answer("L1", "L1.b", true);
    expect(s.events).not.toContainEqual({ type: "achievement_unlocked", achievementId: "clean" });
  });

  it("keeps tracking optional objectives after the quest is complete, announcing each once", () => {
    const optionalRules: GameRules = {
      ...rules,
      quests: [
        {
          id: "q.side",
          objectives: [
            { id: "one", predicate: { kind: "complete_level_count", count: 1 }, optional: false },
            { id: "two", predicate: { kind: "complete_level_count", count: 2 }, optional: true },
          ],
        },
      ],
      achievements: [],
    };
    let progress = emptyProgress("p");
    let game = emptyGameState("p");
    const events: GameEvent[] = [];
    for (const [l, c] of [
      ["L1", "L1.a"],
      ["L1", "L1.b"],
      ["L2", "L2.a"],
      ["L2", "L2.b"],
    ] as const) {
      const r = applyAttempt(pathRules, progress, {
        levelId: l,
        challengeId: c,
        correct: true,
        at: T,
      });
      if (!r.ok) throw new Error();
      progress = r.progress;
      const o = reconcile({ rules: optionalRules, pathRules, progress }, game, T);
      game = o.state;
      events.push(...o.events);
    }
    expect(events).toEqual([
      { type: "quest_activated", questId: "q.side" },
      { type: "quest_objective_met", questId: "q.side", objectiveId: "one" },
      { type: "quest_completed", questId: "q.side" },
      { type: "quest_objective_met", questId: "q.side", objectiveId: "two" },
    ]);
  });

  it("treats an empty zone as never complete", () => {
    expect(
      evaluatePredicate(
        { kind: "complete_zone", zone: "nowhere" },
        { rules, pathRules, progress: emptyProgress("p"), game: emptyGameState("p") },
      ),
    ).toEqual({ met: false, current: 0, target: 0 });
  });

  it("locked levels cannot be played, so their quests stay locked", () => {
    const learned = applyAttempt(pathRules, emptyProgress("p"), {
      levelId: "L3",
      challengeId: "L3.a",
      correct: true,
      at: T,
    });
    expect(learned).toMatchObject({ ok: false, error: { code: "level_locked" } });
    const v = gameView({ rules, pathRules, progress: emptyProgress("p") }, emptyGameState("p"));
    expect(v.quests.find((q) => q.id === "q.boss")!.state).toBe("locked");
  });
});
