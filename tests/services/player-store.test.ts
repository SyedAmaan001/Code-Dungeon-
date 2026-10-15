import { describe, expect, it } from "vitest";
import { GameService } from "@/services/game-service";
import { InMemoryGameStateStore } from "@/services/game-store";
import { LearningService } from "@/services/learning-service";
import { InMemoryPlayerStore } from "@/services/player-store";
import { InMemoryProgressStore } from "@/services/progress-store";
import { clonePack, loadOrThrow, VALID_SMALL } from "../support/packs";

const pack = clonePack(loadOrThrow(VALID_SMALL));
pack.meta.quests.forEach((q) => (q.status = "published"));
pack.meta.achievements.forEach((a) => (a.status = "published"));

const ANSWERS: [string, string, unknown][] = [
  ["fx.L001", "fx.L001.c1", { output: "5" }],
  ["fx.L001", "fx.L001.c1", { output: "23" }],
  ["fx.L001", "fx.L001.c2", { selected: ["a"] }],
  ["fx.L002", "fx.L002.c1", { blanks: { b1: "print" } }],
  ["fx.L002", "fx.L002.c2", { order: ["l1", "l2", "l3", "l4"] }],
  ["fx.L002", "fx.L002.c3", { values: { x: "5", y: "10" } }],
  ["fx.L002", "fx.L002.c4", { line: 3, fix: "f1" }],
];

function clock() {
  let t = 0;
  return () => new Date(Date.UTC(2026, 9, 15, 0, 0, t++));
}

function transactional() {
  const now = clock();
  const store = new InMemoryPlayerStore();
  const learning = new LearningService({ pack, store: store.progressStore, now });
  const game = new GameService({
    pack,
    learning,
    store: store.gameStore,
    transactional: store,
    now,
  });
  return { store, learning, game };
}

describe("InMemoryPlayerStore (transactional in-memory adapter)", () => {
  it("produces exactly the same results as the two-store path", async () => {
    const now = clock();
    const learning = new LearningService({ pack, store: new InMemoryProgressStore(), now });
    const legacy = new GameService({ pack, learning, store: new InMemoryGameStateStore(), now });
    const tx = transactional();
    for (const [i, [levelId, challengeId, answer]] of ANSWERS.entries()) {
      const body = {
        submissionId: `same-${String(i).padStart(4, "0")}`,
        levelId,
        challengeId,
        answer,
      };
      expect(await tx.game.submit("p", body)).toEqual(await legacy.submit("p", body));
    }
    expect(await tx.game.getView("p")).toEqual(await legacy.getView("p"));
  });

  it("commits nothing when the transaction callback throws", async () => {
    const { store, learning, game } = transactional();
    const body = {
      submissionId: "boom-000001",
      levelId: "fx.L001",
      challengeId: "fx.L001.c1",
      answer: { output: "23" },
    };
    await expect(
      store.transaction("p", "fixture-path", {}, (records) => {
        learning.planSubmit(records.progress, body);
        throw new Error("game step failed");
      }),
    ).rejects.toThrow("game step failed");
    expect((await learning.getPath("p")).totalXp).toBe(0);
    expect(await game.submit("p", body)).toMatchObject({
      learning: { correct: true, duplicate: false },
    });
  });

  it("serialises concurrent submissions and processes duplicates once", async () => {
    const { learning, game } = transactional();
    const body = {
      submissionId: "dup-0000001",
      levelId: "fx.L001",
      challengeId: "fx.L001.c1",
      answer: { output: "23" },
    };
    const results = await Promise.all(Array.from({ length: 5 }, () => game.submit("p", body)));
    expect(
      results.filter((r) => r.learning.status === "evaluated" && !r.learning.duplicate),
    ).toHaveLength(1);
    const level = await learning.getLevel("p", "fx.L001");
    expect(level.status === "ok" && level.challenges["fx.L001.c1"]!.attempts).toBe(1);
  });

  it("rejects stale writes through the store views", async () => {
    const { store } = transactional();
    const record = {
      progress: { pathId: "fixture-path", levels: {}, xp: [] },
      submissions: {},
      revision: 0,
    };
    await store.progressStore.save("p", "fixture-path", record, 0);
    await expect(store.progressStore.save("p", "fixture-path", record, 0)).rejects.toThrow(
      /changed by another request/,
    );
  });
});
