/**
 * Game-engine domain (pure, deterministic). No I/O, no framework, no other layer
 * (enforced by eslint.config.mjs). Phase 2 provides progression: unlocks, attempts,
 * hints, completion, mastery and XP. Quests, achievements and leaderboard ranking
 * come in a later phase.
 */
export * from "./policy";
export * from "./progression";

export type QuestState = "locked" | "active" | "completed";
