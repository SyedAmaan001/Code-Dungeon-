/**
 * Central progression policy: XP values, unlock rule, mastery rule and replay rule.
 *
 * Status: DEFAULT (docs/decision.md DEC-002), not an owner-confirmed product decision.
 * Values follow docs/architecture-proposal.md §5.2. Change them here (or pass a policy
 * to the service); never compute XP anywhere else.
 */
export type LevelKind = "standard" | "checkpoint" | "major" | "boss";

export interface ProgressionPolicy {
  xp: {
    /** First correct answer to a challenge: perDifficulty × difficulty (1–3). */
    perDifficulty: number;
    /** Extra XP when the first counted attempt is correct and no hint was revealed. */
    firstTryBonus: number;
    /** One-time XP for completing a level, by level kind. */
    levelCompletion: Record<LevelKind, number>;
    /** One-time XP for mastering a level (0 = mastery is recognised but not paid). */
    masteryBonus: number;
  };
  /** What a prerequisite level must reach before the next level unlocks. */
  unlockRequires: "completed" | "mastered";
  mastery: {
    /** Which challenges must be demonstrated for mastery. Falls back to required challenges if a level has none of this role. */
    challengeRole: "check" | "exercise";
    /** Whether a correct answer still demonstrates mastery after a hint was revealed for it. */
    allowHints: boolean;
  };
  replay: {
    /** Completed levels can be played again (to practise and to earn mastery). */
    allowed: boolean;
  };
}

export const DEFAULT_POLICY: ProgressionPolicy = {
  xp: {
    perDifficulty: 10,
    firstTryBonus: 5,
    levelCompletion: { standard: 25, checkpoint: 50, major: 75, boss: 150 },
    masteryBonus: 0,
  },
  unlockRequires: "completed",
  mastery: { challengeRole: "check", allowHints: false },
  replay: { allowed: true },
};
