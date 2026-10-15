import { describe, expect, it } from "vitest";
import { InMemoryProgressStore, ProgressConflictError } from "@/services/progress-store";
import { LearningService } from "@/services/learning-service";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

const pack = loadOrThrow(VALID_SMALL);
const FIXED = new Date("2026-10-15T12:00:00Z");

function setup() {
  const store = new InMemoryProgressStore();
  const errors: unknown[] = [];
  const service = new LearningService({
    pack,
    store,
    now: () => FIXED,
    onEvaluationError: (e) => errors.push(e),
  });
  return { service, store, errors };
}

let n = 0;
const id = () => `sub-${(n++).toString().padStart(6, "0")}`;
const submit = (
  s: LearningService,
  levelId: string,
  challengeId: string,
  answer: unknown,
  submissionId = id(),
) => s.submit("learner-a", { submissionId, levelId, challengeId, answer });

describe("LearningService — path and level views", () => {
  it("lists only published levels, honestly flags non-durable storage, and locks by prerequisites", async () => {
    const { service } = setup();
    const path = await service.getPath("learner-a");
    expect(path.progressIsDurable).toBe(false);
    expect(path.levels.map((l) => [l.levelId, l.status])).toEqual([
      ["fx.L001", "available"],
      ["fx.L002", "locked"],
    ]);
    expect(await service.getLevel("learner-a", "fx.L002")).toMatchObject({
      status: "rejected",
      code: "level_locked",
    });
    expect(await service.getLevel("learner-a", "fx.L003")).toMatchObject({ code: "unknown_level" }); // draft
  });

  it("serves level content without answer keys, hint text or explanations", async () => {
    const { service } = setup();
    const r = await service.getLevel("learner-a", "fx.L001");
    if (r.status !== "ok") throw new Error();
    const json = JSON.stringify(r);
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain("Look at the quotation marks."); // hint 1, not yet requested
    expect(json).not.toContain("concatenates"); // explanation
    expect(r.challenges["fx.L001.c1"]).toEqual({ attempts: 0, correct: false, hints: [] });
  });
});

describe("LearningService — submissions", () => {
  it("judges answers server-side, awards policy XP and reports progression events", async () => {
    const { service } = setup();
    const wrong = await submit(service, "fx.L001", "fx.L001.c1", { output: "5" });
    expect(wrong).toMatchObject({ status: "evaluated", correct: false, xpAwarded: 0, totalXp: 0 });
    if (wrong.status === "evaluated") expect(wrong.feedback.message).toContain("these are strings");

    const right = await submit(service, "fx.L001", "fx.L001.c1", { output: "23" });
    expect(right).toMatchObject({ status: "evaluated", correct: true, xpAwarded: 10, totalXp: 10 });
    if (right.status === "evaluated") expect(right.feedback.explanation).toBeTruthy();

    const check = await submit(service, "fx.L001", "fx.L001.c2", { selected: ["a"] });
    expect(check).toMatchObject({ correct: true, xpAwarded: 10 + 5 + 25, totalXp: 50 });
    if (check.status !== "evaluated") throw new Error();
    expect(check.level).toMatchObject({ status: "completed", mastered: true });
    expect(check.events).toContainEqual({ type: "level_unlocked", levelId: "fx.L002" });
    expect((await service.getPath("learner-a")).levels[1]!.status).toBe("available");
  });

  it("returns the original result for a resent submissionId and never double-awards", async () => {
    const { service } = setup();
    const first = await submit(service, "fx.L001", "fx.L001.c1", { output: "23" }, "dup-000001");
    const again = await submit(service, "fx.L001", "fx.L001.c1", { output: "23" }, "dup-000001");
    expect(again).toEqual({ ...first, duplicate: true });
    const fresh = await submit(service, "fx.L001", "fx.L001.c1", { output: "23" });
    expect(fresh).toMatchObject({ correct: true, xpAwarded: 0, totalXp: 15 });
  });

  it("refuses to reuse a submissionId for a different challenge", async () => {
    const { service } = setup();
    await submit(service, "fx.L001", "fx.L001.c1", { output: "23" }, "dup-000002");
    expect(
      await submit(service, "fx.L001", "fx.L001.c2", { selected: ["a"] }, "dup-000002"),
    ).toMatchObject({
      code: "submission_id_reused",
    });
  });

  it("ignores any attempt to supply XP, correctness or a learner id in the request", async () => {
    const { service } = setup();
    for (const extra of [{ xp: 500 }, { correct: true }, { learnerId: "learner-b" }]) {
      expect(
        await service.submit("learner-a", {
          submissionId: id(),
          levelId: "fx.L001",
          challengeId: "fx.L001.c1",
          answer: { output: "5" },
          ...extra,
        }),
      ).toMatchObject({ status: "rejected", code: "bad_request" });
    }
    expect((await service.getPath("learner-a")).totalXp).toBe(0);
  });

  it("does not count malformed answers or engine failures as attempts", async () => {
    const { service, errors } = setup();
    const malformed = await submit(service, "fx.L001", "fx.L001.c2", { selected: ["zzz"] });
    expect(malformed).toMatchObject({
      status: "not_counted",
      feedback: { tone: "invalid", counted: false },
    });
    const level = await service.getLevel("learner-a", "fx.L001");
    expect(level.status === "ok" && level.challenges["fx.L001.c2"]!.attempts).toBe(0);
    expect(errors).toEqual([]);
  });

  it("enforces prerequisites and challenge ownership authoritatively", async () => {
    const { service } = setup();
    expect(
      await submit(service, "fx.L002", "fx.L002.c1", { blanks: { b1: "print" } }),
    ).toMatchObject({
      code: "level_locked",
    });
    expect(
      await submit(service, "fx.L001", "fx.L002.c1", { blanks: { b1: "print" } }),
    ).toMatchObject({
      code: "unknown_challenge",
    });
    expect(await submit(service, "fx.L003", "fx.L003.c1", { code: "print(1)" })).toMatchObject({
      code: "unknown_level",
    });
    expect(await service.submit("learner-a", { nonsense: true })).toMatchObject({
      code: "bad_request",
    });
  });

  it("keeps learners isolated from each other", async () => {
    const { service } = setup();
    await submit(service, "fx.L001", "fx.L001.c1", { output: "23" });
    expect((await service.getPath("learner-b")).totalXp).toBe(0);
  });

  it("allows replay without repeat XP", async () => {
    const { service } = setup();
    await submit(service, "fx.L001", "fx.L001.c1", { output: "23" });
    await submit(service, "fx.L001", "fx.L001.c2", { selected: ["a"] });
    const replay = await submit(service, "fx.L001", "fx.L001.c1", { output: "23" });
    expect(replay).toMatchObject({
      status: "evaluated",
      correct: true,
      xpAwarded: 0,
      level: { status: "completed" },
    });
  });
});

describe("LearningService — hints", () => {
  it("reveals hints one tier at a time and never the answer", async () => {
    const { service } = setup();
    const tiers = [];
    for (let i = 0; i < 3; i++)
      tiers.push(
        await service.requestHint("learner-a", { levelId: "fx.L001", challengeId: "fx.L001.c1" }),
      );
    expect(tiers.map((t) => t.status === "ok" && [t.tier, t.remaining])).toEqual([
      [1, 2],
      [2, 1],
      [3, 0],
    ]);
    expect(tiers.every((t) => t.status === "ok" && !t.hint.includes("23"))).toBe(true);
    expect(
      await service.requestHint("learner-a", { levelId: "fx.L001", challengeId: "fx.L001.c1" }),
    ).toMatchObject({
      code: "no_more_hints",
    });
    const level = await service.getLevel("learner-a", "fx.L001");
    expect(level.status === "ok" && level.challenges["fx.L001.c1"]!.hints).toHaveLength(3);
  });

  it("refuses hints for locked levels and malformed requests", async () => {
    const { service } = setup();
    expect(
      await service.requestHint("learner-a", { levelId: "fx.L002", challengeId: "fx.L002.c1" }),
    ).toMatchObject({
      code: "level_locked",
    });
    expect(await service.requestHint("learner-a", { levelId: "fx.L001" })).toMatchObject({
      code: "bad_request",
    });
  });

  it("removes the first-try bonus after a hint", async () => {
    const { service } = setup();
    await service.requestHint("learner-a", { levelId: "fx.L001", challengeId: "fx.L001.c1" });
    expect(await submit(service, "fx.L001", "fx.L001.c1", { output: "23" })).toMatchObject({
      xpAwarded: 10,
    });
  });
});

describe("InMemoryProgressStore", () => {
  it("is explicitly non-durable and rejects stale writes", async () => {
    const store = new InMemoryProgressStore();
    expect(store.durable).toBe(false);
    const record = { progress: { pathId: "p", levels: {}, xp: [] }, submissions: {}, revision: 0 };
    await store.save("a", "p", record, 0);
    await expect(store.save("a", "p", record, 0)).rejects.toBeInstanceOf(ProgressConflictError);
    expect((await store.load("a", "p"))?.revision).toBe(1);
  });

  it("returns copies so callers cannot mutate stored progress", async () => {
    const store = new InMemoryProgressStore();
    await store.save(
      "a",
      "p",
      { progress: { pathId: "p", levels: {}, xp: [] }, submissions: {}, revision: 0 },
      0,
    );
    const loaded = (await store.load("a", "p"))!;
    loaded.progress.xp.push({
      sourceKey: "x",
      amount: 1000,
      reason: "challenge_solved",
      levelId: "L",
      at: "t",
    });
    expect((await store.load("a", "p"))!.progress.xp).toEqual([]);
  });
});
