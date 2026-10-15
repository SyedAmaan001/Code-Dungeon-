/**
 * Presenter: turns verified service results into the small, display-ready objects a
 * browser receives from server actions. It decides nothing (no XP, unlocks or awards);
 * it only names what the learning and game engines already decided, using content titles.
 */
import type { GameEvent, ProgressionEvent } from "@/domain";
import type { Feedback } from "@/learning/evaluation";
import type { ContentPack } from "@/learning/schema";
import { itemInfo } from "@/world/catalog";
import type { GameHintResult, GameSubmitResult } from "./game-service";
import type { RejectionCode } from "./learning-service";

export type NoticeKind =
  | "xp"
  | "level_completed"
  | "level_mastered"
  | "level_unlocked"
  | "encounter_started"
  | "life_lost"
  | "encounter_defeated"
  | "encounter_won"
  | "checkpoint"
  | "quest_activated"
  | "objective_met"
  | "quest_completed"
  | "achievement"
  | "item"
  | "sync";

export interface Notice {
  kind: NoticeKind;
  text: string;
  /** In-app link for the next useful step (e.g. a newly unlocked level). */
  href?: string;
}

export type SubmitView =
  | {
      status: "evaluated";
      correct: boolean;
      duplicate: boolean;
      feedback: Feedback;
      xpAwarded: number;
      totalXp: number;
      levelStatus: "locked" | "available" | "in_progress" | "completed";
      mastered: boolean;
      notices: Notice[];
    }
  | { status: "not_counted"; feedback: Feedback }
  | { status: "rejected"; code: RejectionCode; message: string }
  | { status: "signed_out" }
  | { status: "rate_limited" }
  | { status: "error" };

export type HintView =
  | { status: "ok"; revealed: string[]; remaining: number; notices: Notice[] }
  | { status: "rejected"; code: RejectionCode; message: string }
  | { status: "signed_out" }
  | { status: "rate_limited" }
  | { status: "error" };

export class Presenter {
  private readonly levels: Map<string, { number: number; title: string }>;
  private readonly quests: Map<string, { title: string; objectives: Map<string, string> }>;
  private readonly achievements: Map<string, string>;

  constructor(pack: ContentPack) {
    this.levels = new Map(pack.levels.map((l) => [l.id, { number: l.number, title: l.title }]));
    this.quests = new Map(
      pack.meta.quests.map((q) => [
        q.id,
        { title: q.title, objectives: new Map(q.objectives.map((o) => [o.id, o.title])) },
      ]),
    );
    this.achievements = new Map(pack.meta.achievements.map((a) => [a.id, a.title]));
  }

  private level(id: string): string {
    const l = this.levels.get(id);
    return l ? `Level ${l.number}: ${l.title}` : "a level";
  }

  private progression(e: ProgressionEvent): Notice | undefined {
    switch (e.type) {
      case "level_completed":
        return { kind: "level_completed", text: `${this.level(e.levelId)} complete.` };
      case "level_mastered":
        return { kind: "level_mastered", text: `${this.level(e.levelId)} mastered.` };
      case "level_unlocked":
        return {
          kind: "level_unlocked",
          text: `${this.level(e.levelId)} is now open.`,
          href: `/play/level/${encodeURIComponent(e.levelId)}`,
        };
      default:
        return undefined; // attempts, solves, hints and XP lines are shown elsewhere
    }
  }

  private game(e: GameEvent): Notice | undefined {
    switch (e.type) {
      case "encounter_started":
        return {
          kind: "encounter_started",
          text:
            e.lives === null
              ? `Run ${e.run} begins. This checkpoint cannot be lost.`
              : `Run ${e.run} begins with ${e.lives} lives.`,
        };
      case "encounter_life_lost":
        return {
          kind: "life_lost",
          text:
            e.livesRemaining === 1
              ? "You lost a life. 1 life left in this run."
              : `You lost a life. ${e.livesRemaining} lives left in this run.`,
        };
      case "encounter_defeated":
        return {
          kind: "encounter_defeated",
          text: `Run ${e.run} is over. Your learning progress and XP are kept; answer again to start a new run.`,
        };
      case "encounter_won":
        return {
          kind: "encounter_won",
          text: `${e.encounterKind === "boss" ? "Boss" : e.encounterKind === "major" ? "Encounter" : "Checkpoint"} cleared on run ${e.run}${e.flawless ? ", flawless" : ""}.`,
        };
      case "checkpoint_reached":
        return { kind: "checkpoint", text: `Checkpoint reached at ${this.level(e.levelId)}.` };
      case "quest_activated":
        return {
          kind: "quest_activated",
          text: `New quest: ${this.quests.get(e.questId)?.title ?? "a quest"}.`,
          href: "/play/journal",
        };
      case "quest_objective_met": {
        const q = this.quests.get(e.questId);
        return {
          kind: "objective_met",
          text: `Objective done: ${q?.objectives.get(e.objectiveId) ?? "an objective"} (${q?.title ?? "quest"}).`,
          href: "/play/journal",
        };
      }
      case "quest_completed":
        return {
          kind: "quest_completed",
          text: `Quest complete: ${this.quests.get(e.questId)?.title ?? "a quest"}.`,
          href: "/play/journal",
        };
      case "achievement_unlocked":
        return {
          kind: "achievement",
          text: `Achievement unlocked: ${this.achievements.get(e.achievementId) ?? "an achievement"}.`,
          href: "/play/collection",
        };
      case "item_awarded":
        return {
          kind: "item",
          text: `Found: ${itemInfo(e.item).name}.`,
          href: "/play/collection",
        };
    }
  }

  submit(result: GameSubmitResult): SubmitView {
    const { learning, game } = result;
    if (learning.status === "rejected")
      return { status: "rejected", code: learning.code, message: learning.message };
    if (learning.status === "not_counted")
      return { status: "not_counted", feedback: learning.feedback };

    const notices: Notice[] = [];
    if (learning.xpAwarded > 0)
      notices.push({ kind: "xp", text: `+${learning.xpAwarded} XP (total ${learning.totalXp}).` });
    for (const e of learning.events) {
      const n = this.progression(e);
      if (n) notices.push(n);
    }
    for (const e of game.events) {
      const n = this.game(e);
      if (n) notices.push(n);
    }
    if (game.status === "conflict")
      notices.push({
        kind: "sync",
        text: "Your answer was saved. Quest and encounter updates will catch up on your next answer.",
      });
    return {
      status: "evaluated",
      correct: learning.correct,
      duplicate: learning.duplicate,
      feedback: learning.feedback,
      xpAwarded: learning.xpAwarded,
      totalXp: learning.totalXp,
      levelStatus: learning.level.status,
      mastered: learning.level.mastered,
      notices,
    };
  }

  hint(result: GameHintResult): HintView {
    const { learning, game } = result;
    if (learning.status === "rejected")
      return { status: "rejected", code: learning.code, message: learning.message };
    return {
      status: "ok",
      revealed: learning.revealed,
      remaining: learning.remaining,
      notices: game.events.flatMap((e) => {
        const n = this.game(e);
        return n ? [n] : [];
      }),
    };
  }
}
