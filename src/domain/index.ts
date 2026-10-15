/**
 * Game engine (Phase 2 — not implemented yet).
 *
 * Pure, deterministic functions: unlocks, attempt evaluation, XP events, quests,
 * achievements and leaderboard ranking. No I/O, no framework, no other layer
 * (enforced by eslint.config.mjs). Only the shared vocabulary exists so far.
 */

/** Learner-facing level state. `available` is derived from prerequisites, not stored. */
export type LevelProgressState = "locked" | "available" | "in_progress" | "completed";

export type QuestState = "locked" | "active" | "completed";
