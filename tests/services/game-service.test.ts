import { describe, expect, it } from "vitest";
import type { ContentPack } from "@/learning/schema";
import { GameService } from "@/services/game-service";
import {
  GameStateConflictError,
  InMemoryGameStateStore,
  InMemoryPlayerDirectory,
  type GameStateRecord,
} from "@/services/game-store";
import { LearningService } from "@/services/learning-service";
import { InMemoryProgressStore } from "@/services/progress-store";
import { clonePack, loadOrThrow, VALID_SMALL } from "../support/packs";

/** Fixture pack with its quest and achievement published. L2 is a checkpoint. */
function fixturePack(): ContentPack {
  const pack = clonePack(loadOrThrow(VALID_SMALL));
  pack.meta.quests.forEach((q) => (q.status = "published"));
  pack.meta.achievements.forEach((a) => (a.status = "published"));
  return pack;
}

let clock = 0;
function setup(store = new InMemoryGameStateStore()) {
  const pack = fixturePack();
  const now = () => new Date(Date.UTC(2026, 9, 15, 12, 0, clock++));
  const learning = new LearningService({ pack, store: new InMemoryProgressStore(), now });
  const players = new InMemoryPlayerDirectory();
  const game = new GameService({ pack, learning, store, players, now });
  return { game, learning, players };
}

let n = 0;
const sid = () => `game-${String(n++).padStart(6, "0")}`;
const submit = (
  g: GameService,
  learner: string,
  levelId: string,
  challengeId: string,
  answer: unknown,
  submissionId = sid(),
) => g.submit(learner, { submissionId, levelId, challengeId, answer });

const L1_RIGHT: [string, unknown][] = [
  ["fx.L001.c1", { output: "23" }],
  ["fx.L001.c2", { selected: ["a"] }],
];
const L2_RIGHT: [string, unknown][] = [
  ["fx.L002.c1", { blanks: { b1: "print" } }],
  ["fx.L002.c2", { order: ["l1", "l2", "l3", "l4"] }],
  ["fx.L002.c3", { values: { x: "5", y: "10" } }],
  ["fx.L002.c4", { line: 3, fix: "f1" }],
];

async function play(g: GameService, learner: string, level: string, answers: [string, unknown][]) {
  const results = [];
  for (const [c, a] of answers) results.push(await submit(g, learner, level, c, a));
  return results;
}

describe("GameService — events come only from verified learning results", () => {
  it("passes learning results through unchanged and adds game events", async () => {
    const { game } = setup();
    const [first, second] = await play(game, "ari", "fx.L001", L1_RIGHT);
    expect(first!.learning).toMatchObject({ status: "evaluated", correct: true, xpAwarded: 15 });
    expect(first!.game).toEqual({
      status: "applied",
      duplicate: false,
      events: [{ type: "quest_activated", questId: "fx.quest.first-steps" }],
    });
    expect(second!.game.events).toEqual([
      { type: "quest_objective_met", questId: "fx.quest.first-steps", objectiveId: "o1" },
      { type: "achievement_unlocked", achievementId: "fx.ach.first-level" },
    ]);
  });

  it("does not change XP: the game engine adds no XP of its own (DEC-002, DEC-005)", async () => {
    const { game, learning } = setup();
    await play(game, "ari", "fx.L001", L1_RIGHT);
    await play(game, "ari", "fx.L002", L2_RIGHT);
    const view = await game.getView("ari");
    expect(view.totalXp).toBe((await learning.getPath("ari")).totalXp);
    expect(view.totalXp).toBe(15 + 15 + 25 + 15 + 25 + 15 + 25 + 50); // challenge XP + level completions only
  });

  it("produces no game effect for rejected, locked or malformed submissions", async () => {
    const { game } = setup();
    expect(
      (await submit(game, "ari", "fx.L002", "fx.L002.c1", { blanks: { b1: "print" } })).game,
    ).toEqual({ status: "none", events: [] }); // locked
    expect(
      (await submit(game, "ari", "fx.L001", "fx.L001.c2", { selected: ["zzz"] })).game,
    ).toEqual({ status: "none", events: [] }); // invalid
    const forged = await game.submit("ari", {
      submissionId: sid(),
      levelId: "fx.L001",
      challengeId: "fx.L001.c1",
      answer: { output: "5" },
      achievements: ["fx.ach.first-level"],
      xp: 9999,
    });
    expect(forged.learning).toMatchObject({ status: "rejected", code: "bad_request" });
    expect(forged.game.status).toBe("none");
    expect((await game.getView("ari")).achievements.every((a) => !a.unlocked)).toBe(true);
  });

  it("returns the stored game events for a resent submission and changes nothing", async () => {
    const { game } = setup();
    const first = await submit(
      game,
      "ari",
      "fx.L001",
      "fx.L001.c1",
      { output: "23" },
      "resend-0001",
    );
    const again = await submit(
      game,
      "ari",
      "fx.L001",
      "fx.L001.c1",
      { output: "23" },
      "resend-0001",
    );
    expect(again.learning).toMatchObject({ duplicate: true });
    expect(again.game).toEqual({ status: "applied", events: first.game.events, duplicate: true });
    const view = await game.getView("ari");
    expect(view.quests[0]!.state).toBe("active");
  });

  it("recovers when a game save conflicts: resending the same id applies the game update exactly once", async () => {
    class FlakyStore extends InMemoryGameStateStore {
      failNext = false;
      override async save(l: string, p: string, r: GameStateRecord, rev: number) {
        if (this.failNext) {
          this.failNext = false;
          throw new GameStateConflictError();
        }
        return super.save(l, p, r, rev);
      }
    }
    const store = new FlakyStore();
    const { game } = setup(store);
    await submit(game, "ari", "fx.L001", "fx.L001.c1", { output: "23" });
    store.failNext = true;
    const lost = await submit(
      game,
      "ari",
      "fx.L001",
      "fx.L001.c2",
      { selected: ["a"] },
      "flaky-0001",
    );
    expect(lost.learning).toMatchObject({ status: "evaluated", correct: true });
    expect(lost.game).toEqual({ status: "conflict", events: [] });
    const retry = await submit(
      game,
      "ari",
      "fx.L001",
      "fx.L001.c2",
      { selected: ["a"] },
      "flaky-0001",
    );
    expect(retry.learning).toMatchObject({ duplicate: true, xpAwarded: 40 }); // original learning result, not re-awarded
    expect(retry.game).toMatchObject({ status: "applied", duplicate: false });
    expect(retry.game.events).toContainEqual({
      type: "achievement_unlocked",
      achievementId: "fx.ach.first-level",
    });
    const third = await submit(
      game,
      "ari",
      "fx.L001",
      "fx.L001.c2",
      { selected: ["a"] },
      "flaky-0001",
    );
    expect(third.game).toMatchObject({ duplicate: true });
  });
});

describe("GameService — checkpoint encounter through the full stack", () => {
  it("reaches the checkpoint, completes the zone quest and awards the item", async () => {
    const { game } = setup();
    await play(game, "ari", "fx.L001", L1_RIGHT);
    const results = await play(game, "ari", "fx.L002", L2_RIGHT);
    const events = results.flatMap((r) => r.game.events);
    expect(events[0]).toEqual({
      type: "encounter_started",
      levelId: "fx.L002",
      encounterKind: "checkpoint",
      run: 1,
      lives: null,
    });
    expect(events).toContainEqual({
      type: "encounter_won",
      levelId: "fx.L002",
      encounterKind: "checkpoint",
      run: 1,
      flawless: true,
    });
    expect(events).toContainEqual({ type: "checkpoint_reached", levelId: "fx.L002" });
    expect(events).toContainEqual({ type: "quest_completed", questId: "fx.quest.first-steps" });
    expect(events).toContainEqual({
      type: "item_awarded",
      item: "gate-key",
      source: "quest:fx.quest.first-steps",
    });
    const view = await game.getView("ari");
    expect(view).toMatchObject({
      lastCheckpoint: "fx.L002",
      items: ["gate-key"],
      resumeLevelId: null,
      persistent: false,
    });
  });

  it("a hint during the checkpoint run makes the victory non-flawless", async () => {
    const { game } = setup();
    await play(game, "ari", "fx.L001", L1_RIGHT);
    const hint = await game.requestHint("ari", { levelId: "fx.L002", challengeId: "fx.L002.c1" });
    expect(hint.learning).toMatchObject({ status: "ok", tier: 1 });
    expect(hint.game.events).toEqual([
      {
        type: "encounter_started",
        levelId: "fx.L002",
        encounterKind: "checkpoint",
        run: 1,
        lives: null,
      },
    ]);
    const events = (await play(game, "ari", "fx.L002", L2_RIGHT)).flatMap((r) => r.game.events);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "encounter_won", flawless: false }),
    );
  });

  it("a refused hint has no game effect", async () => {
    const { game } = setup();
    expect(
      (await game.requestHint("ari", { levelId: "fx.L002", challengeId: "fx.L002.c1" })).game
        .status,
    ).toBe("none");
  });
});

describe("GameService — view", () => {
  it("shows review status, quest titles, locked quests and the resume level honestly", async () => {
    const { game } = setup();
    const view = await game.getView("new-player");
    expect(view.persistent).toBe(false);
    expect(view.resumeLevelId).toBe("fx.L001");
    expect(view.levels.map((l) => [l.levelId, l.status, l.review])).toEqual([
      ["fx.L001", "available", "human"],
      ["fx.L002", "locked", "human"],
    ]);
    expect(view.quests[0]).toMatchObject({
      id: "fx.quest.first-steps",
      title: "First Steps",
      state: "locked",
    });
    expect(view.encounters).toEqual([
      {
        levelId: "fx.L002",
        encounterKind: "checkpoint",
        status: "not_started",
        runs: 0,
        defeats: 0,
        livesRemaining: null,
        maxLives: null,
        flawless: false,
      },
    ]);
  });
});

describe("GameService — leaderboard (in-process players only, not persistent)", () => {
  it("ranks registered players by verified XP with documented ties and hides hidden players", async () => {
    const { game, players } = setup();
    for (const [id, handle, visible] of [
      ["ari", "Ari", true],
      ["bo", "Bob", true],
      ["cy", "Cyd", false],
      ["di", "Dia", true],
    ] as const)
      expect(players.register(id, handle, visible).ok).toBe(true);
    await play(game, "ari", "fx.L001", L1_RIGHT);
    await play(game, "bo", "fx.L001", L1_RIGHT);
    await play(game, "cy", "fx.L001", L1_RIGHT);
    const board = await game.leaderboard("bo");
    expect(board.persistent).toBe(false);
    expect(board.entries).toEqual([
      { rank: 1, handle: "Ari", xp: 55, isViewer: false }, // same XP, reached earlier
      { rank: 2, handle: "Bob", xp: 55, isViewer: true },
    ]);
    expect(board.viewer).toEqual({ ranked: true, rank: 2, xp: 55 });
    expect((await game.leaderboard("di")).viewer).toEqual({ ranked: false, reason: "no_xp" });
    expect((await game.leaderboard("cy")).viewer).toEqual({ ranked: false, reason: "hidden" });
    expect((await game.leaderboard(undefined)).totalRanked).toBe(2);
  });

  it("has no players (and invents none) without a player directory", async () => {
    const pack = fixturePack();
    const learning = new LearningService({ pack, store: new InMemoryProgressStore() });
    const game = new GameService({ pack, learning, store: new InMemoryGameStateStore() });
    expect(await game.leaderboard("x")).toMatchObject({
      entries: [],
      totalRanked: 0,
      persistent: false,
    });
  });

  it("validates handles and keeps them unique regardless of case", () => {
    const players = new InMemoryPlayerDirectory();
    expect(players.register("a", "Ari").ok).toBe(true);
    expect(players.register("b", "ARI")).toEqual({
      ok: false,
      reason: "that name is already taken",
    });
    expect(players.register("a", "Ari_2").ok).toBe(true); // renaming yourself is fine
    expect(players.register("c", "x")).toMatchObject({ ok: false });
  });
});
