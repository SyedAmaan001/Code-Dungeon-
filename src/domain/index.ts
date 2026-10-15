/**
 * Game-engine domain (pure, deterministic). No I/O, no framework, no other layer
 * (enforced by eslint.config.mjs). Phase 2: progression (unlocks, attempts, hints,
 * completion, mastery, XP). Phase 3: game engine (encounters, checkpoints, quests,
 * achievements, items, leaderboard ranking) in ./game.
 */
export * from "./policy";
export * from "./progression";
export * from "./game";
