/**
 * Game engine: pure functions over plain data. No I/O, clock or framework.
 *
 * Inputs are verified facts produced by the learning service (an answer to a
 * challenge was judged correct or incorrect; a hint was revealed). The engine
 * never receives XP, completion flags or unlocks from a client.
 *
 * Encounters (checkpoint, major and boss levels) are played in runs:
 * - A run starts with the first counted answer (or revealed hint) on the level.
 * - A correct answer marks that challenge solved for this run.
 * - A wrong answer costs a life when the encounter kind has lives (major/boss).
 *   At zero lives the run is defeated; the next answer starts a fresh run.
 * - The encounter is won when every required challenge is solved within one run.
 *   Winning a checkpoint also records the checkpoint.
 * Encounters never change XP, level completion or unlocks (DEC-002, DEC-005):
 * a defeat removes nothing the learner has earned.
 *
 * Quests and achievements are re-derived from current progress by `reconcile`,
 * so applying it repeatedly is safe (idempotent) and a missed update self-heals.
 */
import { DEFAULT_GAME_POLICY, isEncounterKind, type GamePolicy } from "./policy";
import { evaluatePredicate, type PredicateContext, type PredicateResult } from "./predicates";
import type { EncounterState, GameEvent, GameRules, GameState } from "./types";

export interface GameOutcome {
  state: GameState;
  events: GameEvent[];
}

function newEncounter(): EncounterState {
  return { status: "not_started", runs: 0, defeats: 0 };
}

/** Start a run if the level is an unfinished encounter with no active run. */
function ensureRun(
  rules: GameRules,
  state: GameState,
  levelId: string,
  at: string,
  policy: GamePolicy,
  events: GameEvent[],
): EncounterState | undefined {
  const level = rules.levels.find((l) => l.id === levelId);
  if (!level || !isEncounterKind(level.kind)) return undefined;
  const enc = (state.encounters[levelId] ??= newEncounter());
  if (enc.status === "won") return undefined; // replays after victory are practice, not runs
  if (!enc.current) {
    const lives = policy.encounters[level.kind].lives;
    enc.runs += 1;
    enc.status = "active";
    enc.current = {
      run: enc.runs,
      livesRemaining: lives,
      solved: [],
      mistakes: 0,
      hints: 0,
      startedAt: at,
    };
    events.push({
      type: "encounter_started",
      levelId,
      encounterKind: level.kind,
      run: enc.runs,
      lives,
    });
  }
  return enc;
}

/** Apply one counted, server-judged answer. */
export function applyVerifiedAttempt(
  rules: GameRules,
  current: GameState,
  input: { levelId: string; challengeId: string; correct: boolean; at: string },
  policy: GamePolicy = DEFAULT_GAME_POLICY,
): GameOutcome {
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const level = rules.levels.find((l) => l.id === input.levelId);
  if (!level || !level.challenges.some((c) => c.id === input.challengeId))
    return { state: current, events };

  const enc = ensureRun(rules, state, input.levelId, input.at, policy, events);
  if (!enc?.current || !isEncounterKind(level.kind)) return { state, events };
  const run = enc.current;

  if (input.correct) {
    if (!run.solved.includes(input.challengeId)) run.solved.push(input.challengeId);
  } else {
    run.mistakes += 1;
    if (run.livesRemaining !== null) {
      run.livesRemaining -= 1;
      events.push({
        type: "encounter_life_lost",
        levelId: level.id,
        livesRemaining: run.livesRemaining,
      });
      if (run.livesRemaining <= 0) {
        enc.defeats += 1;
        enc.status = "defeated";
        delete enc.current;
        events.push({ type: "encounter_defeated", levelId: level.id, run: run.run });
        return { state, events };
      }
    }
  }

  const required = level.challenges.filter((c) => c.required).map((c) => c.id);
  if (required.every((id) => run.solved.includes(id))) {
    const flawless = run.mistakes === 0 && run.hints === 0;
    enc.status = "won";
    enc.wonAt = input.at;
    enc.flawless = flawless;
    delete enc.current;
    events.push({
      type: "encounter_won",
      levelId: level.id,
      encounterKind: level.kind,
      run: run.run,
      flawless,
    });
    if (level.kind === "checkpoint" && !state.checkpoints.some((c) => c.levelId === level.id)) {
      state.checkpoints.push({ levelId: level.id, at: input.at });
      events.push({ type: "checkpoint_reached", levelId: level.id });
    }
  }
  return { state, events };
}

/** Record a revealed hint (hints during a run make its victory non-flawless). */
export function applyHintRevealed(
  rules: GameRules,
  current: GameState,
  input: { levelId: string; at: string },
  policy: GamePolicy = DEFAULT_GAME_POLICY,
): GameOutcome {
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const enc = ensureRun(rules, state, input.levelId, input.at, policy, events);
  if (!enc?.current) return { state: events.length ? state : current, events };
  enc.current.hints += 1;
  return { state, events };
}

/** Activate/complete quests and unlock achievements that the current progress satisfies. */
export function reconcile(
  ctx: Omit<PredicateContext, "game">,
  current: GameState,
  at: string,
): GameOutcome {
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const evaluate = (p: Parameters<typeof evaluatePredicate>[0]) =>
    evaluatePredicate(p, { ...ctx, game: state });
  const award = (item: string | undefined, source: string) => {
    if (!item || state.items.some((i) => i.source === source)) return;
    state.items.push({ item, source, at });
    events.push({ type: "item_awarded", item, source });
  };

  for (const quest of ctx.rules.quests) {
    let entry = state.quests[quest.id];
    if (!entry) {
      if (quest.activation && !evaluate(quest.activation).met) continue;
      entry = state.quests[quest.id] = { state: "active", activatedAt: at, objectivesMet: [] };
      events.push({ type: "quest_activated", questId: quest.id });
    }
    // Optional objectives stay tracked after the quest is completed.
    for (const o of quest.objectives) {
      if (!entry.objectivesMet.includes(o.id) && evaluate(o.predicate).met) {
        entry.objectivesMet.push(o.id);
        events.push({ type: "quest_objective_met", questId: quest.id, objectiveId: o.id });
      }
    }
    if (entry.state === "completed") continue;
    if (
      quest.objectives.filter((o) => !o.optional).every((o) => entry.objectivesMet.includes(o.id))
    ) {
      entry.state = "completed";
      entry.completedAt = at;
      events.push({ type: "quest_completed", questId: quest.id });
      award(quest.rewardItem, `quest:${quest.id}`);
    }
  }

  for (const a of ctx.rules.achievements) {
    if (state.achievements[a.id] || !evaluate(a.predicate).met) continue;
    state.achievements[a.id] = { unlockedAt: at };
    events.push({ type: "achievement_unlocked", achievementId: a.id });
    award(a.rewardItem, `achievement:${a.id}`);
  }

  return events.length ? { state, events } : { state: current, events };
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export interface GameView {
  encounters: {
    levelId: string;
    encounterKind: string;
    status: EncounterState["status"];
    runs: number;
    defeats: number;
    livesRemaining: number | null;
    maxLives: number | null;
    flawless: boolean;
  }[];
  checkpoints: string[];
  lastCheckpoint: string | null;
  quests: {
    id: string;
    state: "locked" | "active" | "completed";
    objectives: { id: string; optional: boolean; met: boolean; progress: PredicateResult }[];
    rewardItem?: string;
  }[];
  achievements: {
    id: string;
    unlocked: boolean;
    unlockedAt?: string;
    progress: PredicateResult;
    rewardItem?: string;
  }[];
  items: string[];
}

export function gameView(
  ctx: Omit<PredicateContext, "game">,
  state: GameState,
  policy: GamePolicy = DEFAULT_GAME_POLICY,
): GameView {
  const evaluate = (p: Parameters<typeof evaluatePredicate>[0]) =>
    evaluatePredicate(p, { ...ctx, game: state });
  return {
    encounters: ctx.rules.levels.flatMap((l) => {
      if (!isEncounterKind(l.kind)) return [];
      const e = state.encounters[l.id] ?? newEncounter();
      const maxLives = policy.encounters[l.kind].lives;
      return [
        {
          levelId: l.id,
          encounterKind: l.kind,
          status: e.status,
          runs: e.runs,
          defeats: e.defeats,
          livesRemaining: e.current ? e.current.livesRemaining : maxLives,
          maxLives,
          flawless: e.flawless === true,
        },
      ];
    }),
    checkpoints: state.checkpoints.map((c) => c.levelId),
    lastCheckpoint: state.checkpoints.at(-1)?.levelId ?? null,
    quests: ctx.rules.quests.map((q) => {
      const entry = state.quests[q.id];
      return {
        id: q.id,
        state: entry?.state ?? "locked",
        objectives: q.objectives.map((o) => ({
          id: o.id,
          optional: o.optional,
          met: entry?.objectivesMet.includes(o.id) ?? false,
          progress: evaluate(o.predicate),
        })),
        ...(q.rewardItem && { rewardItem: q.rewardItem }),
      };
    }),
    achievements: ctx.rules.achievements.map((a) => ({
      id: a.id,
      unlocked: !!state.achievements[a.id],
      ...(state.achievements[a.id] && { unlockedAt: state.achievements[a.id]!.unlockedAt }),
      progress: evaluate(a.predicate),
      ...(a.rewardItem && { rewardItem: a.rewardItem }),
    })),
    items: state.items.map((i) => i.item),
  };
}
