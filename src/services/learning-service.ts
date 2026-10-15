/**
 * Learning service: the trusted server-side boundary between a future UI/API and the
 * learning engine (content + evaluators) and the progression domain (unlocks, XP).
 *
 * Trust model:
 * - `learnerId` must come from a verified server-side session (authentication is not
 *   built yet; callers today are tests and local tools). It is never read from a body.
 * - Request bodies are untrusted: they are validated strictly, carry only an answer and
 *   an idempotency key, and can never set correctness, XP, unlocks or progress.
 * - Answers are judged here by the evaluators; XP is computed by the domain policy.
 */
import "server-only";
import { z } from "zod";
import {
  applyAttempt,
  applyHintReveal,
  DEFAULT_POLICY,
  emptyProgress,
  levelView,
  totalXp,
  type DomainError,
  type LearnerProgress,
  type LevelView,
  type PathRules,
  type ProgressionEvent,
  type ProgressionPolicy,
} from "@/domain";
import {
  composeFeedback,
  createDefaultRegistry,
  type EvaluatorRegistry,
  type Feedback,
} from "@/learning/evaluation";
import { toPublicLevel, type PublicLevel } from "@/learning/projection";
import { Id, type ContentPack, type Level } from "@/learning/schema";
import {
  ProgressConflictError,
  type LoadOptions,
  type ProgressRecord,
  type ProgressStore,
} from "./progress-store";

// ---------------------------------------------------------------------------
// Request / response contracts
// ---------------------------------------------------------------------------

export const SubmitRequest = z.strictObject({
  /** Client-generated idempotency key; resending it returns the original result. */
  submissionId: z
    .string()
    .min(8)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
  levelId: Id,
  challengeId: Id,
  /** Format-specific answer; validated by the challenge's evaluator. */
  answer: z.unknown(),
});

export const HintRequest = z.strictObject({ levelId: Id, challengeId: Id });

export type RejectionCode =
  | "bad_request"
  | "unknown_level"
  | "unknown_challenge"
  | "level_locked"
  | "replay_disabled"
  | "no_more_hints"
  | "submission_id_reused"
  | "conflict";

export interface Rejection {
  status: "rejected";
  code: RejectionCode;
  message: string;
}

export type SubmitResult =
  | {
      status: "evaluated";
      submissionId: string;
      levelId: string;
      challengeId: string;
      correct: boolean;
      feedback: Feedback;
      /** XP newly awarded by this submission (computed by the domain policy). */
      xpAwarded: number;
      totalXp: number;
      events: ProgressionEvent[];
      level: LevelView;
      /** True when this is a resend of an already-processed submissionId. */
      duplicate: boolean;
    }
  | {
      /** Invalid submission or engine error: shown to the learner, not counted. */
      status: "not_counted";
      submissionId: string;
      levelId: string;
      challengeId: string;
      feedback: Feedback;
      duplicate: boolean;
    }
  | Rejection;

export type HintResult =
  { status: "ok"; tier: number; hint: string; revealed: string[]; remaining: number } | Rejection;

export interface PathView {
  pathId: string;
  title: string;
  /** False while only the in-memory store exists: progress is not saved permanently. */
  progressIsDurable: boolean;
  totalXp: number;
  zones: { id: string; title: string; order: number; themeKey: string }[];
  levels: (LevelView & {
    number: number;
    title: string;
    description?: string;
    zone: string;
    kind: Level["kind"];
    /** Who reviewed the content: an AI agent only, a human, or nobody yet. */
    review: "agent" | "human" | "none";
  })[];
}

export type LevelResult =
  | {
      status: "ok";
      level: PublicLevel;
      view: LevelView;
      challenges: Record<string, { attempts: number; correct: boolean; hints: string[] }>;
    }
  | Rejection;

// ---------------------------------------------------------------------------

/** Rules for the progression domain: published levels only. */
export function buildPathRules(pack: ContentPack): PathRules {
  return {
    pathId: pack.meta.path.id,
    levels: pack.levels
      .filter((l) => l.status === "published")
      .map((l) => ({
        id: l.id,
        number: l.number,
        kind: l.kind,
        prerequisites: [...l.prerequisites],
        challenges: l.challenges.map((c) => ({
          id: c.id,
          difficulty: c.difficulty,
          role: c.role,
          required: c.required,
          hintCount: c.hints.length,
        })),
      })),
  };
}

const MESSAGES: Record<RejectionCode, string> = {
  bad_request: "The request was not in the expected format.",
  unknown_level: "That level does not exist or is not available yet.",
  unknown_challenge: "That challenge does not belong to this level.",
  level_locked: "Complete the earlier levels first to unlock this one.",
  replay_disabled: "This level is already complete and replay is turned off.",
  no_more_hints: "There are no more hints for this challenge.",
  submission_id_reused: "That submission id was already used for a different challenge.",
  conflict: "Your progress changed in another request. Please try again.",
};

const reject = (code: RejectionCode): Rejection => ({
  status: "rejected",
  code,
  message: MESSAGES[code],
});
const fromDomain = (e: DomainError): Rejection => reject(e.code);

export interface LearningServiceOptions {
  pack: ContentPack;
  store: ProgressStore;
  registry?: EvaluatorRegistry;
  policy?: ProgressionPolicy;
  now?: () => Date;
  /** Receives engine failures (with internal cause) for server-side logging. */
  onEvaluationError?: (info: { challengeId: string; cause?: string }) => void;
}

export class LearningService {
  private readonly pack: ContentPack;
  private readonly store: ProgressStore;
  private readonly registry: EvaluatorRegistry;
  private readonly policy: ProgressionPolicy;
  private readonly now: () => Date;
  private readonly onEvaluationError?: LearningServiceOptions["onEvaluationError"];
  readonly rules: PathRules;
  private readonly published: Map<string, Level>;

  constructor(options: LearningServiceOptions) {
    this.pack = options.pack;
    this.store = options.store;
    this.registry = options.registry ?? createDefaultRegistry();
    this.policy = options.policy ?? DEFAULT_POLICY;
    this.now = options.now ?? (() => new Date());
    this.onEvaluationError = options.onEvaluationError;
    this.rules = buildPathRules(options.pack);
    this.published = new Map(
      options.pack.levels.filter((l) => l.status === "published").map((l) => [l.id, l]),
    );
  }

  private get pathId() {
    return this.pack.meta.path.id;
  }

  private async record(learnerId: string, options: LoadOptions = {}): Promise<ProgressRecord> {
    if (!learnerId) throw new Error("learnerId must come from a verified session");
    return (
      (await this.store.load(learnerId, this.pathId, options)) ?? {
        progress: emptyProgress(this.pathId),
        submissions: {},
        revision: 0,
      }
    );
  }

  async getPath(learnerId: string): Promise<PathView> {
    const { progress } = await this.record(learnerId);
    return {
      pathId: this.pathId,
      title: this.pack.meta.path.title,
      progressIsDurable: this.store.durable,
      totalXp: totalXp(progress),
      zones: this.pack.meta.zones.map((z) => ({
        id: z.id,
        title: z.title,
        order: z.order,
        themeKey: z.themeKey,
      })),
      levels: [...this.published.values()].map((l) => ({
        ...levelView(this.rules, progress, l.id, this.policy),
        number: l.number,
        title: l.title,
        ...(l.description !== undefined && { description: l.description }),
        zone: l.zone,
        kind: l.kind,
        review: l.review?.kind ?? "none",
      })),
    };
  }

  /**
   * Read-only snapshot of a learner's verified progress, for other server-side
   * engines (the game engine evaluates quests and achievements from it).
   */
  async progressSnapshot(learnerId: string): Promise<LearnerProgress> {
    return (await this.record(learnerId)).progress;
  }

  /** Whether progress survives a restart (false for the in-memory store). */
  get progressIsDurable(): boolean {
    return this.store.durable;
  }

  async getLevel(learnerId: string, levelId: string): Promise<LevelResult> {
    const level = this.published.get(levelId);
    if (!level) return reject("unknown_level");
    const { progress } = await this.record(learnerId);
    const view = levelView(this.rules, progress, levelId, this.policy);
    if (view.status === "locked") return reject("level_locked");
    const lp = progress.levels[levelId];
    return {
      status: "ok",
      level: toPublicLevel(level),
      view,
      challenges: Object.fromEntries(
        level.challenges.map((c) => {
          const cp = lp?.challenges[c.id];
          return [
            c.id,
            {
              attempts: cp?.attempts ?? 0,
              correct: cp?.correct ?? false,
              hints: c.hints.slice(0, cp?.hintsRevealed ?? 0),
            },
          ];
        }),
      ),
    };
  }

  /**
   * Decide the outcome of a submission against a loaded record, without touching storage.
   * Returns the updated record when it must be persisted (evaluated or not-counted results);
   * rejections and duplicate resends change nothing.
   */
  planSubmit(
    current: ProgressRecord,
    body: unknown,
  ): { result: SubmitResult; record?: ProgressRecord } {
    const req = SubmitRequest.safeParse(body);
    if (!req.success) return { result: reject("bad_request") };
    const { submissionId, levelId, challengeId, answer } = req.data;

    const record = structuredClone(current);
    const prior = record.submissions[submissionId];
    if (prior) {
      if (
        prior.status !== "rejected" &&
        (prior.levelId !== levelId || prior.challengeId !== challengeId)
      )
        return { result: reject("submission_id_reused") };
      return { result: prior.status === "rejected" ? prior : { ...prior, duplicate: true } };
    }

    const level = this.published.get(levelId);
    if (!level) return { result: reject("unknown_level") };
    const challenge = level.challenges.find((c) => c.id === challengeId);
    if (!challenge) return { result: reject("unknown_challenge") };
    if (levelView(this.rules, record.progress, levelId, this.policy).status === "locked")
      return { result: reject("level_locked") };

    const evaluation = this.registry.evaluate(challenge, answer);
    const feedback = composeFeedback(challenge, evaluation);
    let result: SubmitResult;

    if (evaluation.status === "correct" || evaluation.status === "incorrect") {
      const applied = applyAttempt(
        this.rules,
        record.progress,
        {
          levelId,
          challengeId,
          correct: evaluation.status === "correct",
          at: this.now().toISOString(),
        },
        this.policy,
      );
      if (!applied.ok) return { result: fromDomain(applied.error) };
      record.progress = applied.progress;
      result = {
        status: "evaluated",
        submissionId,
        levelId,
        challengeId,
        correct: evaluation.status === "correct",
        feedback,
        xpAwarded: applied.events.reduce((s, e) => (e.type === "xp_awarded" ? s + e.amount : s), 0),
        totalXp: totalXp(applied.progress),
        events: applied.events,
        level: levelView(this.rules, applied.progress, levelId, this.policy),
        duplicate: false,
      };
    } else {
      if (evaluation.status === "evaluation_error")
        this.onEvaluationError?.({
          challengeId,
          ...(evaluation.cause !== undefined && { cause: evaluation.cause }),
        });
      result = {
        status: "not_counted",
        submissionId,
        levelId,
        challengeId,
        feedback,
        duplicate: false,
      };
    }

    record.submissions[submissionId] = result;
    return { result, record };
  }

  async submit(learnerId: string, body: unknown): Promise<SubmitResult> {
    const req = SubmitRequest.safeParse(body);
    const record = await this.record(
      learnerId,
      req.success ? { submissionId: req.data.submissionId } : {},
    );
    const plan = this.planSubmit(record, body);
    if (!plan.record) return plan.result;
    return (await this.persist(learnerId, plan.record)) ?? plan.result;
  }

  /** Decide a hint request against a loaded record, without touching storage. */
  planHint(
    current: ProgressRecord,
    body: unknown,
  ): { result: HintResult; record?: ProgressRecord } {
    const req = HintRequest.safeParse(body);
    if (!req.success) return { result: reject("bad_request") };
    const { levelId, challengeId } = req.data;
    const level = this.published.get(levelId);
    if (!level) return { result: reject("unknown_level") };
    const challenge = level.challenges.find((c) => c.id === challengeId);
    if (!challenge) return { result: reject("unknown_challenge") };

    const record = structuredClone(current);
    const applied = applyHintReveal(
      this.rules,
      record.progress,
      { levelId, challengeId },
      this.policy,
    );
    if (!applied.ok) return { result: fromDomain(applied.error) };
    record.progress = applied.progress;
    return {
      record,
      result: {
        status: "ok",
        tier: applied.tier,
        hint: challenge.hints[applied.tier - 1]!,
        revealed: challenge.hints.slice(0, applied.tier),
        remaining: challenge.hints.length - applied.tier,
      },
    };
  }

  async requestHint(learnerId: string, body: unknown): Promise<HintResult> {
    const plan = this.planHint(await this.record(learnerId), body);
    if (!plan.record) return plan.result;
    return (await this.persist(learnerId, plan.record)) ?? plan.result;
  }

  private async persist(learnerId: string, record: ProgressRecord): Promise<Rejection | undefined> {
    try {
      await this.store.save(learnerId, this.pathId, record, record.revision);
      return undefined;
    } catch (err) {
      if (err instanceof ProgressConflictError) return reject("conflict");
      throw err;
    }
  }
}
