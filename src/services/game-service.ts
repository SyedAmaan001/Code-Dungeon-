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
  leaderboardRecord,
  rankLeaderboard,
  reconcile,
  type GameEvent,
  type GamePolicy,
  type GamePredicate,
  type GameRules,
  type GameView,
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
  type HintResult,
  type LearningService,
  type PathView,
  type SubmitResult,
} from "./learning-service";

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

export interface PlayerGameView extends GameView {
  pathId: string;
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

  constructor(options: GameServiceOptions) {
    this.pack = options.pack;
    this.learning = options.learning;
    this.store = options.store;
    this.players = options.players;
    this.policy = options.policy ?? DEFAULT_GAME_POLICY;
    this.progressionPolicy = options.progressionPolicy ?? DEFAULT_POLICY;
    this.now = options.now ?? (() => new Date());
    this.rules = buildGameRules(options.pack);
  }

  private get pathId() {
    return this.pack.meta.path.id;
  }

  private async load(learnerId: string): Promise<GameStateRecord> {
    return (
      (await this.store.load(learnerId, this.pathId)) ?? {
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

  async submit(learnerId: string, body: unknown): Promise<GameSubmitResult> {
    const learning = await this.learning.submit(learnerId, body);
    if (learning.status !== "evaluated") return { learning, game: { status: "none", events: [] } };

    const record = await this.load(learnerId);
    const prior = record.processed[learning.submissionId];
    if (prior) return { learning, game: { status: "applied", events: prior, duplicate: true } };

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
    const settled = reconcile(await this.context(learnerId), attempt.state, at);
    const events = [...attempt.events, ...settled.events];
    record.state = settled.state;
    record.processed[learning.submissionId] = events;

    if (!(await this.save(learnerId, record)))
      return { learning, game: { status: "conflict", events: [] } };
    return { learning, game: { status: "applied", events, duplicate: false } };
  }

  async requestHint(learnerId: string, body: unknown): Promise<GameHintResult> {
    const learning = await this.learning.requestHint(learnerId, body);
    const req = HintRequest.safeParse(body);
    if (learning.status !== "ok" || !req.success)
      return { learning, game: { status: "none", events: [] } };

    const record = await this.load(learnerId);
    const applied = applyHintRevealed(
      this.rules,
      record.state,
      { levelId: req.data.levelId, at: this.now().toISOString() },
      this.policy,
    );
    if (applied.state === record.state)
      return { learning, game: { status: "applied", events: [], duplicate: false } };
    record.state = applied.state;
    if (!(await this.save(learnerId, record)))
      return { learning, game: { status: "conflict", events: [] } };
    return { learning, game: { status: "applied", events: applied.events, duplicate: false } };
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

  /**
   * Rank the players known to the player directory by verified lifetime XP.
   * With in-memory adapters this compares only players held in this process.
   */
  async leaderboard(
    viewerId: string | undefined,
    options: { limit?: number } = {},
  ): Promise<Leaderboard & { persistent: boolean }> {
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
