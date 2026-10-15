/**
 * Game-engine data: rules (derived from published content by the service layer),
 * per-learner game state, and game events. Plain data only.
 */
import type { LevelKind } from "../policy";
import type { EncounterKind } from "./policy";

/** Mirrors the content predicate vocabulary (src/learning/schema.ts `Predicate`). */
export type GamePredicate =
  | { kind: "complete_levels"; levels: string[] }
  | { kind: "complete_level_count"; count: number }
  | { kind: "complete_zone"; zone: string }
  | { kind: "correct_challenges_of_type"; challengeType: string; count: number }
  | { kind: "level_no_hints_first_try"; count: number }
  | { kind: "earn_xp"; amount: number }
  | { kind: "level_unlocked"; level: string }
  | { kind: "master_level_count"; count: number }
  | { kind: "encounter_won"; level: string }
  | { kind: "encounters_won"; encounterKind?: EncounterKind; count: number }
  | { kind: "flawless_encounters"; encounterKind?: EncounterKind; count: number };

export interface GameLevelRule {
  id: string;
  number: number;
  zone: string;
  kind: LevelKind;
  challenges: { id: string; type: string; required: boolean }[];
}

export interface QuestRule {
  id: string;
  activation?: GamePredicate;
  objectives: { id: string; predicate: GamePredicate; optional: boolean }[];
  rewardItem?: string;
}

export interface AchievementRule {
  id: string;
  predicate: GamePredicate;
  rewardItem?: string;
}

export interface GameRules {
  pathId: string;
  /** Playable (published) levels only. */
  levels: GameLevelRule[];
  /** Published quests and achievements only. */
  quests: QuestRule[];
  achievements: AchievementRule[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface EncounterRun {
  run: number;
  /** null = this kind of encounter cannot be lost. */
  livesRemaining: number | null;
  /** Challenges answered correctly during this run. */
  solved: string[];
  mistakes: number;
  hints: number;
  startedAt: string;
}

export type EncounterStatus = "not_started" | "active" | "defeated" | "won";

export interface EncounterState {
  status: EncounterStatus;
  runs: number;
  defeats: number;
  current?: EncounterRun;
  wonAt?: string;
  /** The winning run had no lost lives (no mistakes) and no revealed hints. */
  flawless?: boolean;
}

export interface QuestState {
  state: "active" | "completed";
  activatedAt: string;
  completedAt?: string;
  /** Objective ids already reported as met (each is announced once). */
  objectivesMet: string[];
}

export interface GameState {
  pathId: string;
  encounters: Record<string, EncounterState>;
  /** Checkpoints reached, in order. */
  checkpoints: { levelId: string; at: string }[];
  quests: Record<string, QuestState>;
  achievements: Record<string, { unlockedAt: string }>;
  /** Cosmetic reward items (no gameplay effect). */
  items: { item: string; source: string; at: string }[];
}

export function emptyGameState(pathId: string): GameState {
  return { pathId, encounters: {}, checkpoints: [], quests: {}, achievements: {}, items: [] };
}

// ---------------------------------------------------------------------------
// Events (facts for the interface to present; never presentation effects)
// ---------------------------------------------------------------------------

export type GameEvent =
  | {
      type: "encounter_started";
      levelId: string;
      encounterKind: EncounterKind;
      run: number;
      lives: number | null;
    }
  | { type: "encounter_life_lost"; levelId: string; livesRemaining: number }
  | { type: "encounter_defeated"; levelId: string; run: number }
  | {
      type: "encounter_won";
      levelId: string;
      encounterKind: EncounterKind;
      run: number;
      flawless: boolean;
    }
  | { type: "checkpoint_reached"; levelId: string }
  | { type: "quest_activated"; questId: string }
  | { type: "quest_objective_met"; questId: string; objectiveId: string }
  | { type: "quest_completed"; questId: string }
  | { type: "achievement_unlocked"; achievementId: string }
  | { type: "item_awarded"; item: string; source: string };
