/**
 * Deterministic evaluation of quest/achievement predicates against verified
 * learning progress and game state. Every predicate reports progress (current /
 * target) so a quest journal can show it, and `met` for unlocking.
 */
import { DEFAULT_POLICY, type ProgressionPolicy } from "../policy";
import { isUnlocked, totalXp, type LearnerProgress, type PathRules } from "../progression";
import type { GamePredicate, GameRules, GameState } from "./types";

export interface PredicateContext {
  rules: GameRules;
  pathRules: PathRules;
  progress: LearnerProgress;
  game: GameState;
  progressionPolicy?: ProgressionPolicy;
}

export interface PredicateResult {
  met: boolean;
  current: number;
  target: number;
}

const result = (current: number, target: number): PredicateResult => ({
  met: target > 0 && current >= target,
  current: Math.min(current, target),
  target,
});

export function evaluatePredicate(p: GamePredicate, ctx: PredicateContext): PredicateResult {
  const { rules, progress, game } = ctx;
  const completed = (id: string) => !!progress.levels[id]?.completedAt;
  const count = (xs: readonly unknown[]) => xs.length;

  switch (p.kind) {
    case "complete_levels":
      return result(count(p.levels.filter(completed)), p.levels.length);
    case "complete_level_count":
      return result(count(rules.levels.filter((l) => completed(l.id))), p.count);
    case "complete_zone": {
      const zone = rules.levels.filter((l) => l.zone === p.zone);
      return result(count(zone.filter((l) => completed(l.id))), zone.length);
    }
    case "master_level_count":
      return result(
        count(rules.levels.filter((l) => !!progress.levels[l.id]?.masteredAt)),
        p.count,
      );
    case "correct_challenges_of_type": {
      const solved = rules.levels.flatMap((l) =>
        l.challenges.filter(
          (c) => c.type === p.challengeType && progress.levels[l.id]?.challenges[c.id]?.correct,
        ),
      );
      return result(solved.length, p.count);
    }
    case "level_no_hints_first_try": {
      const clean = rules.levels.filter((l) => {
        const lp = progress.levels[l.id];
        if (!lp?.completedAt) return false;
        return l.challenges
          .filter((c) => c.required)
          .every((c) => lp.challenges[c.id]?.firstTryClean === true);
      });
      return result(clean.length, p.count);
    }
    case "earn_xp":
      return result(totalXp(progress), p.amount);
    case "level_unlocked":
      return result(
        isUnlocked(ctx.pathRules, progress, p.level, ctx.progressionPolicy ?? DEFAULT_POLICY)
          ? 1
          : 0,
        1,
      );
    case "encounter_won":
      return result(game.encounters[p.level]?.status === "won" ? 1 : 0, 1);
    case "encounters_won":
    case "flawless_encounters": {
      const won = rules.levels.filter((l) => {
        const e = game.encounters[l.id];
        if (e?.status !== "won") return false;
        if (p.encounterKind && l.kind !== p.encounterKind) return false;
        return p.kind === "encounters_won" || e.flawless === true;
      });
      return result(won.length, p.count);
    }
  }
}
