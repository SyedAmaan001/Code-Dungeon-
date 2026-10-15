/**
 * Server-action authorization boundary: the player id comes only from the verified
 * session; request bodies cannot name a player, award XP or skip the evaluators.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountProfile } from "@/services/postgres-player-store";
import { GameService } from "@/services/game-service";
import { InMemoryGameStateStore } from "@/services/game-store";
import { LearningService } from "@/services/learning-service";
import { Presenter } from "@/services/presenter";
import { InMemoryProgressStore } from "@/services/progress-store";
import { RateLimiter } from "@/services/rate-limit";
import { correctSubmission, wrongSubmission } from "../support/answers";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

const session: { player: AccountProfile | null } = { player: null };
vi.mock("@/auth/server", () => ({ playerForAction: async () => session.player }));

const pack = loadOrThrow(VALID_SMALL);
function makeRuntime() {
  const learning = new LearningService({ pack, store: new InMemoryProgressStore() });
  const game = new GameService({ pack, learning, store: new InMemoryGameStateStore() });
  return {
    pack,
    learning,
    game,
    presenter: new Presenter(pack),
    actionLimiter: new RateLimiter(5, 60_000),
  };
}
let runtime = makeRuntime();
vi.mock("@/services/runtime", () => ({ getRuntime: () => runtime }));

const { submitAnswer, revealHint } = await import("@/app/actions/game");

const level = pack.levels[0]!;
const challenge = level.challenges[0]!;
const body = (id: string, extra: Record<string, unknown> = {}) => ({
  submissionId: id,
  levelId: level.id,
  challengeId: challenge.id,
  answer: correctSubmission(challenge),
  ...extra,
});

beforeEach(() => {
  runtime = makeRuntime();
  session.player = null;
});

describe("game server actions", () => {
  it("refuse signed-out callers without touching any service", async () => {
    const spy = vi.spyOn(runtime.game, "submit");
    expect(await submitAnswer(body("anon-0001"))).toEqual({ status: "signed_out" });
    expect(await revealHint({ levelId: level.id, challengeId: challenge.id })).toEqual({
      status: "signed_out",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("act for the session's player only", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    const spy = vi.spyOn(runtime.game, "submit");
    const result = await submitAnswer(body("sub-a-0001"));
    expect(result).toMatchObject({ status: "evaluated", correct: true });
    expect(spy).toHaveBeenCalledWith("player-a", expect.anything());
    expect((await runtime.learning.getPath("player-a")).totalXp).toBeGreaterThan(0);
    expect((await runtime.learning.getPath("player-b")).totalXp).toBe(0);
  });

  it("reject bodies that try to name a player or award XP", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    for (const extra of [{ playerId: "player-b" }, { learnerId: "player-b" }, { xp: 1000 }])
      expect(await submitAnswer(body("sub-forge-01", extra))).toMatchObject({
        status: "rejected",
        code: "bad_request",
      });
    expect((await runtime.learning.getPath("player-b")).totalXp).toBe(0);
    expect((await runtime.learning.getPath("player-a")).totalXp).toBe(0);
  });

  it("judge answers on the server: a wrong answer earns nothing", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    const wrong = { ...body("sub-wrong-01"), answer: wrongSubmission(challenge) };
    expect(await submitAnswer(wrong)).toMatchObject({
      status: "evaluated",
      correct: false,
      xpAwarded: 0,
    });
    expect((await runtime.learning.getPath("player-a")).totalXp).toBe(0);
  });

  it("count a resent submission once and return the original result", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    const first = await submitAnswer(body("sub-dup-0001"));
    const again = await submitAnswer(body("sub-dup-0001"));
    expect(first).toMatchObject({ status: "evaluated", correct: true, duplicate: false });
    expect(again).toMatchObject({ status: "evaluated", correct: true, duplicate: true });
    if (first.status !== "evaluated" || again.status !== "evaluated") throw new Error();
    expect(again.totalXp).toBe(first.totalXp);
    expect((await runtime.learning.getPath("player-a")).totalXp).toBe(first.totalXp);
  });

  it("do not let one player replay another player's submission id", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    await submitAnswer(body("sub-shared-01"));
    session.player = { playerId: "player-b", handle: "Bryn", visible: true };
    const b = await submitAnswer(body("sub-shared-01"));
    // Ids are scoped per player: Bryn's submission is judged on its own and earns Bryn's XP.
    expect(b).toMatchObject({ status: "evaluated", duplicate: false });
    expect((await runtime.learning.getPath("player-a")).totalXp).toBeGreaterThan(0);
  });

  it("rate-limit each player", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await submitAnswer(body(`sub-rate-${i}000`)));
    expect(results.slice(0, 5).every((r) => r.status !== "rate_limited")).toBe(true);
    expect(results.slice(5)).toEqual([{ status: "rate_limited" }, { status: "rate_limited" }]);
  });

  it("hide internal errors from the browser", async () => {
    session.player = { playerId: "player-a", handle: "Alice", visible: true };
    vi.spyOn(runtime.game, "submit").mockRejectedValueOnce(new Error("db password=hunter2"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await submitAnswer(body("sub-err-0001"))).toEqual({ status: "error" });
    quiet.mockRestore();
  });
});
