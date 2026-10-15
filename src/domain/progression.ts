/**
 * Progression engine: pure functions over plain data. No I/O, no clock, no framework.
 *
 * Inputs are already-trusted facts (a challenge was answered correctly or not, as judged
 * by the server-side learning engine). Outputs are a new progress value and progression
 * events. Presentation effects (sounds, animations) are the UI's job and are derived
 * from these events; they are never part of this module.
 *
 * State vocabulary (per level):
 * - attempted: at least one counted answer or revealed hint
 * - completed: every required challenge has been answered correctly at least once
 * - mastered:  completed, and every mastery challenge was *demonstrated* — answered
 *              correctly without a hint either on its first counted attempt or in a
 *              replay after the level was completed (an immediate retry right after
 *              seeing feedback does not count as demonstration)
 * Per challenge: unattempted → attempted → correct.
 */
import { DEFAULT_POLICY, type LevelKind, type ProgressionPolicy } from "./policy";

// ---------------------------------------------------------------------------
// Rules (derived from published content by the service layer)
// ---------------------------------------------------------------------------

export interface ChallengeRule {
  id: string;
  difficulty: number;
  role: "exercise" | "check";
  required: boolean;
  hintCount: number;
}

export interface LevelRule {
  id: string;
  number: number;
  kind: LevelKind;
  prerequisites: string[];
  challenges: ChallengeRule[];
}

export interface PathRules {
  pathId: string;
  /** Only playable (published) levels. */
  levels: LevelRule[];
}

// ---------------------------------------------------------------------------
// Progress (what a store persists per learner and path)
// ---------------------------------------------------------------------------

export interface ChallengeProgress {
  /** Counted attempts (invalid submissions and engine errors never count). */
  attempts: number;
  correct: boolean;
  /** Hint tiers revealed so far (0–3); hints are revealed strictly in order. */
  hintsRevealed: number;
  /** Hints revealed since the last counted attempt. */
  hintsSinceLastAttempt: number;
  /** Set on the first counted attempt: correct with no hint. */
  firstTryClean?: boolean;
  demonstrated: boolean;
}

export interface LevelProgress {
  challenges: Record<string, ChallengeProgress>;
  completedAt?: string;
  masteredAt?: string;
}

export type XpReason =
  "challenge_solved" | "first_try_bonus" | "level_completed" | "level_mastered";

export interface XpEntry {
  /** Unique per learner and path; the award-once guarantee. */
  sourceKey: string;
  amount: number;
  reason: XpReason;
  levelId: string;
  challengeId?: string;
  at: string;
}

export interface LearnerProgress {
  pathId: string;
  levels: Record<string, LevelProgress>;
  xp: XpEntry[];
}

export function emptyProgress(pathId: string): LearnerProgress {
  return { pathId, levels: {}, xp: [] };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ProgressionEvent =
  | {
      type: "challenge_attempted";
      levelId: string;
      challengeId: string;
      correct: boolean;
      attempt: number;
    }
  | { type: "challenge_solved"; levelId: string; challengeId: string; firstTime: boolean }
  | { type: "hint_revealed"; levelId: string; challengeId: string; tier: number }
  | { type: "level_completed"; levelId: string }
  | { type: "level_mastered"; levelId: string }
  | { type: "level_unlocked"; levelId: string }
  | { type: "xp_awarded"; sourceKey: string; amount: number; reason: XpReason };

export type DomainError =
  | { code: "unknown_level"; levelId: string }
  | { code: "unknown_challenge"; challengeId: string }
  | { code: "level_locked"; levelId: string }
  | { code: "replay_disabled"; levelId: string }
  | { code: "no_more_hints"; challengeId: string };

export type Outcome<T> = ({ ok: true } & T) | { ok: false; error: DomainError };

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type LevelStatus = "locked" | "available" | "in_progress" | "completed";

export interface LevelView {
  levelId: string;
  status: LevelStatus;
  mastered: boolean;
  attempted: boolean;
}

const levelRule = (rules: PathRules, id: string) => rules.levels.find((l) => l.id === id);

function prerequisiteMet(
  progress: LearnerProgress,
  id: string,
  policy: ProgressionPolicy,
): boolean {
  const lp = progress.levels[id];
  return policy.unlockRequires === "mastered" ? !!lp?.masteredAt : !!lp?.completedAt;
}

export function isUnlocked(
  rules: PathRules,
  progress: LearnerProgress,
  levelId: string,
  policy: ProgressionPolicy = DEFAULT_POLICY,
): boolean {
  const rule = levelRule(rules, levelId);
  return !!rule && rule.prerequisites.every((p) => prerequisiteMet(progress, p, policy));
}

export function levelView(
  rules: PathRules,
  progress: LearnerProgress,
  levelId: string,
  policy: ProgressionPolicy = DEFAULT_POLICY,
): LevelView {
  const lp = progress.levels[levelId];
  const attempted = Object.values(lp?.challenges ?? {}).some(
    (c) => c.attempts > 0 || c.hintsRevealed > 0,
  );
  const status: LevelStatus = lp?.completedAt
    ? "completed"
    : !isUnlocked(rules, progress, levelId, policy)
      ? "locked"
      : attempted
        ? "in_progress"
        : "available";
  return { levelId, status, mastered: !!lp?.masteredAt, attempted };
}

export function totalXp(progress: LearnerProgress): number {
  return progress.xp.reduce((sum, e) => sum + e.amount, 0);
}

/** The most XP a path can award under a policy (used to sanity-check content and rules). */
export function maxPathXp(rules: PathRules, policy: ProgressionPolicy = DEFAULT_POLICY): number {
  return rules.levels.reduce(
    (sum, l) =>
      sum +
      policy.xp.levelCompletion[l.kind] +
      policy.xp.masteryBonus +
      l.challenges.reduce(
        (s, c) => s + policy.xp.perDifficulty * c.difficulty + policy.xp.firstTryBonus,
        0,
      ),
    0,
  );
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function newChallengeProgress(): ChallengeProgress {
  return {
    attempts: 0,
    correct: false,
    hintsRevealed: 0,
    hintsSinceLastAttempt: 0,
    demonstrated: false,
  };
}

function locate(
  rules: PathRules,
  progress: LearnerProgress,
  levelId: string,
  challengeId: string,
  policy: ProgressionPolicy,
): Outcome<{ level: LevelRule; challenge: ChallengeRule }> {
  const level = levelRule(rules, levelId);
  if (!level) return { ok: false, error: { code: "unknown_level", levelId } };
  const challenge = level.challenges.find((c) => c.id === challengeId);
  if (!challenge) return { ok: false, error: { code: "unknown_challenge", challengeId } };
  if (!isUnlocked(rules, progress, levelId, policy))
    return { ok: false, error: { code: "level_locked", levelId } };
  return { ok: true, level, challenge };
}

function award(
  progress: LearnerProgress,
  events: ProgressionEvent[],
  entry: Omit<XpEntry, "amount"> & { amount: number },
) {
  if (entry.amount <= 0 || progress.xp.some((e) => e.sourceKey === entry.sourceKey)) return;
  progress.xp.push(entry);
  events.push({
    type: "xp_awarded",
    sourceKey: entry.sourceKey,
    amount: entry.amount,
    reason: entry.reason,
  });
}

function unlockedSet(
  rules: PathRules,
  progress: LearnerProgress,
  policy: ProgressionPolicy,
): Set<string> {
  return new Set(
    rules.levels.filter((l) => isUnlocked(rules, progress, l.id, policy)).map((l) => l.id),
  );
}

/** Record a counted, already-judged attempt. */
export function applyAttempt(
  rules: PathRules,
  current: LearnerProgress,
  input: { levelId: string; challengeId: string; correct: boolean; at: string },
  policy: ProgressionPolicy = DEFAULT_POLICY,
): Outcome<{ progress: LearnerProgress; events: ProgressionEvent[] }> {
  const found = locate(rules, current, input.levelId, input.challengeId, policy);
  if (!found.ok) return found;
  const { level, challenge } = found;

  const progress = structuredClone(current);
  const lp = (progress.levels[level.id] ??= { challenges: {} });
  if (lp.completedAt && !policy.replay.allowed)
    return { ok: false, error: { code: "replay_disabled", levelId: level.id } };

  const unlockedBefore = unlockedSet(rules, progress, policy);
  const cp = (lp.challenges[challenge.id] ??= newChallengeProgress());
  const events: ProgressionEvent[] = [];
  const wasCompleted = !!lp.completedAt;
  const firstAttempt = cp.attempts === 0;
  const clean = policy.mastery.allowHints || cp.hintsSinceLastAttempt === 0;
  const noHintsEver = cp.hintsRevealed === 0;

  cp.attempts += 1;
  cp.hintsSinceLastAttempt = 0;
  if (firstAttempt) cp.firstTryClean = input.correct && noHintsEver;
  events.push({
    type: "challenge_attempted",
    levelId: level.id,
    challengeId: challenge.id,
    correct: input.correct,
    attempt: cp.attempts,
  });

  if (input.correct) {
    const firstTime = !cp.correct;
    cp.correct = true;
    if (clean && (firstAttempt || wasCompleted)) cp.demonstrated = true;
    events.push({
      type: "challenge_solved",
      levelId: level.id,
      challengeId: challenge.id,
      firstTime,
    });
    award(progress, events, {
      sourceKey: `challenge:${challenge.id}`,
      amount: policy.xp.perDifficulty * challenge.difficulty,
      reason: "challenge_solved",
      levelId: level.id,
      challengeId: challenge.id,
      at: input.at,
    });
    if (firstAttempt && noHintsEver)
      award(progress, events, {
        sourceKey: `challenge-first-try:${challenge.id}`,
        amount: policy.xp.firstTryBonus,
        reason: "first_try_bonus",
        levelId: level.id,
        challengeId: challenge.id,
        at: input.at,
      });
  }

  const solved = (id: string) => !!lp.challenges[id]?.correct;
  if (!lp.completedAt && level.challenges.filter((c) => c.required).every((c) => solved(c.id))) {
    lp.completedAt = input.at;
    events.push({ type: "level_completed", levelId: level.id });
    award(progress, events, {
      sourceKey: `level:${level.id}`,
      amount: policy.xp.levelCompletion[level.kind],
      reason: "level_completed",
      levelId: level.id,
      at: input.at,
    });
  }

  if (lp.completedAt && !lp.masteredAt) {
    const byRole = level.challenges.filter((c) => c.role === policy.mastery.challengeRole);
    const targets = byRole.length > 0 ? byRole : level.challenges.filter((c) => c.required);
    if (targets.every((c) => lp.challenges[c.id]?.demonstrated)) {
      lp.masteredAt = input.at;
      events.push({ type: "level_mastered", levelId: level.id });
      award(progress, events, {
        sourceKey: `mastery:${level.id}`,
        amount: policy.xp.masteryBonus,
        reason: "level_mastered",
        levelId: level.id,
        at: input.at,
      });
    }
  }

  for (const id of unlockedSet(rules, progress, policy))
    if (!unlockedBefore.has(id)) events.push({ type: "level_unlocked", levelId: id });

  return { ok: true, progress, events };
}

/** Reveal the next hint tier (strictly in order). */
export function applyHintReveal(
  rules: PathRules,
  current: LearnerProgress,
  input: { levelId: string; challengeId: string },
  policy: ProgressionPolicy = DEFAULT_POLICY,
): Outcome<{ progress: LearnerProgress; events: ProgressionEvent[]; tier: number }> {
  const found = locate(rules, current, input.levelId, input.challengeId, policy);
  if (!found.ok) return found;
  const { level, challenge } = found;

  const progress = structuredClone(current);
  const lp = (progress.levels[level.id] ??= { challenges: {} });
  const cp = (lp.challenges[challenge.id] ??= newChallengeProgress());
  if (cp.hintsRevealed >= challenge.hintCount)
    return { ok: false, error: { code: "no_more_hints", challengeId: challenge.id } };

  cp.hintsRevealed += 1;
  cp.hintsSinceLastAttempt += 1;
  const tier = cp.hintsRevealed;
  return {
    ok: true,
    progress,
    tier,
    events: [{ type: "hint_revealed", levelId: level.id, challengeId: challenge.id, tier }],
  };
}
