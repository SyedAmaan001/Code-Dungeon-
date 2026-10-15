/**
 * Game-engine policy: encounter lives, reward XP switch and leaderboard limits.
 *
 * Status: DEFAULT (docs/decision.md DEC-005). Encounters sit on top of learning
 * progress; they never change XP, completion or unlock rules (DEC-002).
 */
import type { LevelKind } from "../policy";

export type EncounterKind = Exclude<LevelKind, "standard">;

export interface GamePolicy {
  /**
   * Lives per encounter run. `null` = the run cannot be lost (checkpoints are
   * milestones, not tests of endurance). A lost run never removes learning progress.
   */
  encounters: Record<EncounterKind, { lives: number | null }>;
  rewards: {
    /**
     * Quest/achievement XP. Fixed to false: paying it would change the approved
     * XP totals (DEC-002). Rewards are cosmetic items only.
     */
    xpEnabled: false;
  };
  leaderboard: {
    defaultLimit: number;
    maxLimit: number;
    /** Players below this XP are not ranked (no score yet). */
    minXp: number;
  };
}

export const DEFAULT_GAME_POLICY: GamePolicy = {
  encounters: {
    checkpoint: { lives: null },
    major: { lives: 3 },
    boss: { lives: 3 },
  },
  rewards: { xpEnabled: false },
  leaderboard: { defaultLimit: 10, maxLimit: 100, minXp: 1 },
};

export function isEncounterKind(kind: LevelKind): kind is EncounterKind {
  return kind !== "standard";
}
