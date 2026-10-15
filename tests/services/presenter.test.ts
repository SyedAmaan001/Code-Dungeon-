import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GameService } from "@/services/game-service";
import { InMemoryGameStateStore } from "@/services/game-store";
import { LearningService } from "@/services/learning-service";
import { Presenter } from "@/services/presenter";
import { InMemoryProgressStore } from "@/services/progress-store";
import { RateLimiter } from "@/services/rate-limit";
import { correctSubmission, wrongSubmission } from "../support/answers";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

const python = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));

function services() {
  const learning = new LearningService({ pack: python, store: new InMemoryProgressStore() });
  const game = new GameService({ pack: python, learning, store: new InMemoryGameStateStore() });
  return { learning, game, presenter: new Presenter(python) };
}

let n = 0;
const sub = (levelIndex: number, ci: number, correct = true) => {
  const level = python.levels[levelIndex]!;
  const c = level.challenges[ci]!;
  return {
    submissionId: `presenter-${n++}-xxxx`,
    levelId: level.id,
    challengeId: c.id,
    answer: correct ? correctSubmission(c) : wrongSubmission(c),
  };
};

describe("presenter", () => {
  it("names XP, completion, unlocks, quests and items from verified events", async () => {
    const { game, presenter } = services();
    const views = [];
    for (let i = 0; i < python.levels[0]!.challenges.length; i++)
      views.push(presenter.submit(await game.submit("p", sub(0, i))));
    const last = views.at(-1)!;
    expect(last).toMatchObject({ status: "evaluated", correct: true, levelStatus: "completed" });
    const texts = views.flatMap((v) => (v.status === "evaluated" ? v.notices : []));
    expect(texts.map((t) => t.kind)).toEqual(
      expect.arrayContaining(["xp", "level_completed", "level_unlocked", "quest_activated"]),
    );
    expect(texts.find((t) => t.kind === "level_unlocked")).toEqual({
      kind: "level_unlocked",
      text: "Level 2: Values and Expressions is now open.",
      href: "/play/level/py.L002",
    });
    // The browser receives feedback and names only: no answer keys, hints or player ids.
    expect(JSON.stringify(views)).not.toMatch(/answer|acceptedVariants|"p"/);
  });

  it("explains lost lives and defeat without implying lost progress", async () => {
    const { game, presenter } = services();
    // Complete levels 1–9 so the major encounter at level 10 is open.
    for (let li = 0; li < 9; li++)
      for (let ci = 0; ci < python.levels[li]!.challenges.length; ci++)
        await game.submit("p", sub(li, ci));
    const views = [];
    for (let i = 0; i < 3; i++)
      views.push(presenter.submit(await game.submit("p", sub(9, 0, false))));
    const kinds = views.flatMap((v) =>
      v.status === "evaluated" ? v.notices.map((x) => x.kind) : [],
    );
    expect(kinds).toEqual([
      "encounter_started",
      "life_lost",
      "life_lost",
      "life_lost",
      "encounter_defeated",
    ]);
    const defeat = views[2]!.status === "evaluated" ? views[2]!.notices.at(-1)!.text : "";
    expect(defeat).toMatch(/progress and XP are kept/);
  });

  it("passes rejections through and reports hints", async () => {
    const { game, presenter } = services();
    expect(presenter.submit(await game.submit("p", sub(4, 0)))).toMatchObject({
      status: "rejected",
      code: "level_locked",
    });
    const level = python.levels[0]!;
    const hint = presenter.hint(
      await game.requestHint("p", { levelId: level.id, challengeId: level.challenges[0]!.id }),
    );
    expect(hint).toEqual({
      status: "ok",
      revealed: [level.challenges[0]!.hints[0]],
      remaining: 2,
      notices: [],
    });
  });
});

describe("level room read model", () => {
  it("shows the active run, lives and challenges solved in this run", async () => {
    const { game } = services();
    for (let li = 0; li < 9; li++)
      for (let ci = 0; ci < python.levels[li]!.challenges.length; ci++)
        await game.submit("p", sub(li, ci));
    const before = await game.levelRoom("p", "py.L010");
    expect(before).toMatchObject({
      status: "ok",
      encounter: { encounterKind: "major", status: "not_started", livesRemaining: 3, maxLives: 3 },
    });
    await game.submit("p", sub(9, 0));
    await game.submit("p", sub(9, 1, false));
    const during = await game.levelRoom("p", "py.L010");
    expect(during).toMatchObject({
      status: "ok",
      encounter: {
        status: "active",
        run: 1,
        livesRemaining: 2,
        solvedThisRun: [python.levels[9]!.challenges[0]!.id],
      },
      challenges: {
        [python.levels[9]!.challenges[0]!.id]: { correct: true, explanation: expect.any(String) },
      },
    });
    // Unsolved challenges never carry an explanation.
    if (during.status === "ok")
      expect(during.challenges[python.levels[9]!.challenges[1]!.id]!.explanation).toBeUndefined();
    expect(await game.levelRoom("p", "py.L001")).not.toHaveProperty("encounter");
    expect(await game.levelRoom("p", "py.L012")).toMatchObject({ code: "level_locked" });
  });

  it("reports the path maximum XP and zones in the player view", async () => {
    const view = await services().game.getView("p");
    expect(view.maxXp).toBe(2455);
    expect(view.zones.map((z) => z.themeKey)).toEqual([
      "overgrown-gate",
      "ember-hall",
      "sigil-sanctum",
      "rootbound-deep",
      "world-tree-citadel",
    ]);
  });
});

describe("rate limiter", () => {
  it("allows a burst up to the limit, then recovers after the window", () => {
    const limiter = new RateLimiter(2, 1000);
    expect([limiter.allow("a", 0), limiter.allow("a", 10), limiter.allow("a", 20)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.allow("b", 20)).toBe(true);
    expect(limiter.allow("a", 1011)).toBe(true);
  });
});
