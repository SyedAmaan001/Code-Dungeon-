/**
 * Game service: the server-side boundary for the game engine.
 *
 * It owns no learning logic. Every game event is derived from a result the
 * LearningService has already verified (an evaluated, counted answer, or a
 * revealed hint). Request bodies go to the LearningService unchanged, so the
 * same strict validation applies: clients cannot send XP, completion flags,
 * encounter outcomes, quest completions or achievement unlocks.
 *
 * Idempotency: each learning submission id is processed by the game engine at
 * most once; a resend returns the stored game events. Quests and achievements
 * are re-derived from verified progress, so they are awarded at most once and a
 * missed update is recovered on the next event.
 */
import "server-only";
import {
  applyHintRevealed,
  applyVerifiedAttempt,
  DEFAULT_GAME_POLICY,
  DEFAULT_POLICY,
  emptyGameState,
  gameView,
  isEncounterKind,
  leaderboardRecord,
  maxPathXp,
  rankLeaderboard,
  reconcile,
  type GameEvent,
  type GamePolicy,
  type GamePredicate,
  type GameRules,
  type GameView,
  type LearnerProgress,
  type Leaderboard,
  type ProgressionPolicy,
} from "@/domain";
import type { ContentPack, Predicate } from "@/learning/schema";
import {
  GameStateConflictError,
  type GameStateRecord,
  type GameStateStore,
  type PlayerDirectory,
} from "./game-store";
import {
  HintRequest,
  SubmitRequest,
  type HintResult,
  type LearningService,
  type LevelResult,
  type PathView,
  type SubmitResult,
} from "./learning-service";
import {
  emptyRecords,
  type LeaderboardSource,
  type TransactionalPlayerStore,
} from "./player-store";

/** Content predicates map 1:1 onto engine predicates (checked by the compiler). */
const toGamePredicate = (p: Predicate): GamePredicate => p;

/** Game rules from published content only. */
export function buildGameRules(pack: ContentPack): GameRules {
  return {
    pathId: pack.meta.path.id,
    levels: pack.levels
      .filter((l) => l.status === "published")
      .map((l) => ({
        id: l.id,
        number: l.number,
        zone: l.zone,
        kind: l.kind,
        challenges: l.challenges.map((c) => ({ id: c.id, type: c.type, required: c.required })),
      })),
    quests: pack.meta.quests
      .filter((q) => q.status === "published")
      .map((q) => ({
        id: q.id,
        ...(q.activation && { activation: toGamePredicate(q.activation) }),
        objectives: q.objectives.map((o) => ({
          id: o.id,
          predicate: toGamePredicate(o.predicate),
          optional: o.optional,
        })),
        ...(q.reward.item && { rewardItem: q.reward.item }),
      })),
    achievements: pack.meta.achievements
      .filter((a) => a.status === "published")
      .map((a) => ({
        id: a.id,
        predicate: toGamePredicate(a.predicate),
        ...(a.reward.item && { rewardItem: a.reward.item }),
      })),
  };
}

export type GameUpdate =
  | { status: "applied"; events: GameEvent[]; duplicate: boolean }
  /** No game effect: the learning result was not a counted answer (or not a revealed hint). */
  | { status: "none"; events: [] }
  /** Learning progress was saved but the game update hit a concurrent write; resend the same submission id. */
  | { status: "conflict"; events: [] };

export interface GameSubmitResult {
  learning: SubmitResult;
  game: GameUpdate;
}

export interface GameHintResult {
  learning: HintResult;
  game: GameUpdate;
}

export interface EncounterRoom {
  encounterKind: "checkpoint" | "major" | "boss";
  status: "not_started" | "active" | "defeated" | "won";
  runs: number;
  defeats: number;
  /** Number of the active run, if one is in progress. */
  run: number | null;
  /** Lives left in the active run (or a fresh run); null = this encounter cannot be lost. */
  livesRemaining: number | null;
  maxLives: number | null;
  /** Challenges answered correctly in the active run. */
  solvedThisRun: string[];
  flawless: boolean;
}

/** Everything the level room shows, for one learner. */
export type LevelRoomResult =
  | (Extract<LevelResult, { status: "ok" }> & { encounter?: EncounterRoom })
  | Exclude<LevelResult, { status: "ok" }>;

export interface PlayerGameView extends GameView {
  pathId: string;
  pathTitle: string;
  zones: PathView["zones"];
  /** Most XP the published path can award (2,455 for Python Fundamentals). */
  maxXp: number;
  /** False while in-memory stores are used: nothing here survives a restart. */
  persistent: boolean;
  totalXp: number;
  /** The level to continue with: the first unlocked, unfinished level. */
  resumeLevelId: string | null;
  levels: PathView["levels"];
  quests: (GameView["quests"][number] & { title: string; description: string })[];
  achievements: (GameView["achievements"][number] & { title: string; description: string })[];
}

export interface GameServiceOptions {
  pack: ContentPack;
  learning: LearningService;
  store: GameStateStore;
  players?: PlayerDirectory;
  policy?: GamePolicy;
  progressionPolicy?: ProgressionPolicy;
  now?: () => Date;
  /**
   * When set, submissions and hints save learning progress and game state in one
   * transaction (Phase 4). Without it, the two stores are written one after the other.
   */
  transactional?: TransactionalPlayerStore;
  /** When set, the leaderboard reads public records from it instead of per-player progress. */
  leaderboardSource?: LeaderboardSource;
}

export class GameService {
  readonly rules: GameRules;
  private readonly pack: ContentPack;
  private readonly learning: LearningService;
  private readonly store: GameStateStore;
  private readonly players?: PlayerDirectory;
  private readonly policy: GamePolicy;
  private readonly progressionPolicy: ProgressionPolicy;
  private readonly now: () => Date;
  private readonly transactional?: TransactionalPlayerStore;
  private readonly leaderboardSource?: LeaderboardSource;

  constructor(options: GameServiceOptions) {
    this.pack = options.pack;
    this.learning = options.learning;
    this.store = options.store;
    this.players = options.players;
    this.policy = options.policy ?? DEFAULT_GAME_POLICY;
    this.progressionPolicy = options.progressionPolicy ?? DEFAULT_POLICY;
    this.now = options.now ?? (() => new Date());
    this.rules = buildGameRules(options.pack);
    this.transactional = options.transactional;
    this.leaderboardSource = options.leaderboardSource;
  }

  private get pathId() {
    return this.pack.meta.path.id;
  }

  private async load(learnerId: string, submissionId?: string): Promise<GameStateRecord> {
    return (
      (await this.store.load(learnerId, this.pathId, submissionId ? { submissionId } : {})) ?? {
        state: emptyGameState(this.pathId),
        processed: {},
        revision: 0,
      }
    );
  }

  private async context(learnerId: string) {
    return {
      rules: this.rules,
      pathRules: this.learning.rules,
      progress: await this.learning.progressSnapshot(learnerId),
      progressionPolicy: this.progressionPolicy,
    };
  }

  private async save(learnerId: string, record: GameStateRecord): Promise<boolean> {
    try {
      await this.store.save(learnerId, this.pathId, record, record.revision);
      return true;
    } catch (err) {
      if (err instanceof GameStateConflictError) return false;
      throw err;
    }
  }

  /** Game consequences of one evaluated learning result, computed against a loaded record. */
  private planGame(
    current: GameStateRecord,
    learning: Extract<SubmitResult, { status: "evaluated" }>,
    progress: LearnerProgress,
  ): { update: GameUpdate; record?: GameStateRecord } {
    const prior = current.processed[learning.submissionId];
    if (prior) return { update: { status: "applied", events: prior, duplicate: true } };

    const record = structuredClone(current);
    const at = this.now().toISOString();
    const attempt = applyVerifiedAttempt(
      this.rules,
      record.state,
      {
        levelId: learning.levelId,
        challengeId: learning.challengeId,
        correct: learning.correct,
        at,
      },
      this.policy,
    );
    const settled = reconcile(
      {
        rules: this.rules,
        pathRules: this.learning.rules,
        progress,
        progressionPolicy: this.progressionPolicy,
      },
      attempt.state,
      at,
    );
    const events = [...attempt.events, ...settled.events];
    record.state = settled.state;
    record.processed[learning.submissionId] = events;
    return { update: { status: "applied", events, duplicate: false }, record };
  }

  async submit(learnerId: string, body: unknown): Promise<GameSubmitResult> {
    if (this.transactional) return this.submitInTransaction(this.transactional, learnerId, body);

    const learning = await this.learning.submit(learnerId, body);
    if (learning.status !== "evaluated") return { learning, game: { status: "none", events: [] } };
    const plan = this.planGame(
      await this.load(learnerId, learning.submissionId),
      learning,
      await this.learning.progressSnapshot(learnerId),
    );
    if (!plan.record) return { learning, game: plan.update };
    if (!(await this.save(learnerId, plan.record)))
      return { learning, game: { status: "conflict", events: [] } };
    return { learning, game: plan.update };
  }

  /** Learning result and game events are saved together, or not at all. */
  private async submitInTransaction(
    store: TransactionalPlayerStore,
    learnerId: string,
    body: unknown,
  ): Promise<GameSubmitResult> {
    if (!learnerId) throw new Error("learnerId must come from a verified session");
    const req = SubmitRequest.safeParse(body);
    if (!req.success) {
      const learning = this.learning.planSubmit(emptyRecords(this.pathId).progress, body).result;
      return { learning, game: { status: "none", events: [] } };
    }
    return store.transaction<GameSubmitResult>(
      learnerId,
      this.pathId,
      { submissionId: req.data.submissionId },
      (records) => {
        const learningPlan = this.learning.planSubmit(records.progress, body);
        const learning = learningPlan.result;
        if (learning.status !== "evaluated")
          return {
            value: { learning, game: { status: "none", events: [] } },
            progress: learningPlan.record,
          };
        const progress = (learningPlan.record ?? records.progress).progress;
        const gamePlan = this.planGame(records.game, learning, progress);
        return {
          value: { learning, game: gamePlan.update },
          progress: learningPlan.record,
          game: gamePlan.record,
        };
      },
    );
  }

  async requestHint(learnerId: string, body: unknown): Promise<GameHintResult> {
    if (this.transactional) {
      if (!learnerId) throw new Error("learnerId must come from a verified session");
      return this.transactional.transaction<GameHintResult>(
        learnerId,
        this.pathId,
        {},
        (records) => {
          const plan = this.learning.planHint(records.progress, body);
          const req = HintRequest.safeParse(body);
          if (plan.result.status !== "ok" || !req.success)
            return { value: { learning: plan.result, game: { status: "none", events: [] } } };
          const applied = this.hintEffect(records.game.state, req.data.levelId);
          return {
            value: {
              learning: plan.result,
              game: { status: "applied", events: applied.events, duplicate: false },
            },
            progress: plan.record,
            ...(applied.state !== records.game.state && {
              game: { ...records.game, state: applied.state },
            }),
          };
        },
      );
    }

    const learning = await this.learning.requestHint(learnerId, body);
    const req = HintRequest.safeParse(body);
    if (learning.status !== "ok" || !req.success)
      return { learning, game: { status: "none", events: [] } };

    const record = await this.load(learnerId);
    const applied = this.hintEffect(record.state, req.data.levelId);
    if (applied.state === record.state)
      return { learning, game: { status: "applied", events: [], duplicate: false } };
    record.state = applied.state;
    if (!(await this.save(learnerId, record)))
      return { learning, game: { status: "conflict", events: [] } };
    return { learning, game: { status: "applied", events: applied.events, duplicate: false } };
  }

  private hintEffect(state: GameStateRecord["state"], levelId: string) {
    return applyHintRevealed(
      this.rules,
      state,
      { levelId, at: this.now().toISOString() },
      this.policy,
    );
  }

  async getView(learnerId: string): Promise<PlayerGameView> {
    const [record, path, ctx] = await Promise.all([
      this.load(learnerId),
      this.learning.getPath(learnerId),
      this.context(learnerId),
    ]);
    const view = gameView(ctx, record.state, this.policy);
    const quests = new Map(this.pack.meta.quests.map((q) => [q.id, q]));
    const achievements = new Map(this.pack.meta.achievements.map((a) => [a.id, a]));
    const resume = [...path.levels]
      .sort((a, b) => a.number - b.number)
      .find((l) => l.status === "available" || l.status === "in_progress");
    return {
      ...view,
      pathId: this.pathId,
      pathTitle: path.title,
      zones: path.zones,
      maxXp: maxPathXp(this.learning.rules, this.progressionPolicy),
      persistent: this.store.durable && this.learning.progressIsDurable,
      totalXp: path.totalXp,
      resumeLevelId: resume?.levelId ?? null,
      levels: path.levels,
      quests: view.quests.map((q) => ({
        ...q,
        title: quests.get(q.id)!.title,
        description: quests.get(q.id)!.description,
      })),
      achievements: view.achievements.map((a) => ({
        ...a,
        title: achievements.get(a.id)!.title,
        description: achievements.get(a.id)!.description,
      })),
    };
  }

  /** A level with the learner's progress and, for encounter levels, the current run. */
  async levelRoom(learnerId: string, levelId: string): Promise<LevelRoomResult> {
    const result = await this.learning.getLevel(learnerId, levelId);
    if (result.status !== "ok") return result;
    const rule = this.rules.levels.find((l) => l.id === levelId);
    if (!rule || !isEncounterKind(rule.kind)) return result;
    const state = (await this.load(learnerId)).state.encounters[levelId];
    const maxLives = this.policy.encounters[rule.kind].lives;
    return {
      ...result,
      encounter: {
        encounterKind: rule.kind,
        status: state?.status ?? "not_started",
        runs: state?.runs ?? 0,
        defeats: state?.defeats ?? 0,
        run: state?.current?.run ?? null,
        livesRemaining: state?.current ? state.current.livesRemaining : maxLives,
        maxLives,
        solvedThisRun: [...(state?.current?.solved ?? [])],
        flawless: state?.flawless === true,
      },
    };
  }

  /**
   * Rank the players known to the player directory by verified lifetime XP.
   * With in-memory adapters this compares only players held in this process.
   */
  async leaderboard(
    viewerId: string | undefined,
    options: { limit?: number } = {},
  ): Promise<Leaderboard & { persistent: boolean }> {
    if (this.leaderboardSource) {
      const records = await this.leaderboardSource.records(this.pathId, viewerId);
      return {
        ...rankLeaderboard(
          records,
          {
            ...(viewerId && { viewerId }),
            ...(options.limit !== undefined && { limit: options.limit }),
          },
          this.policy,
        ),
        persistent: this.leaderboardSource.durable,
      };
    }
    const players = (await this.players?.list()) ?? [];
    const records = await Promise.all(
      players.map(async (p) =>
        leaderboardRecord(p, await this.learning.progressSnapshot(p.playerId)),
      ),
    );
    return {
      ...rankLeaderboard(
        records,
        {
          ...(viewerId && { viewerId }),
          ...(options.limit !== undefined && { limit: options.limit }),
        },
        this.policy,
      ),
      persistent: !!this.players?.durable && this.learning.progressIsDurable,
    };
  }
}
