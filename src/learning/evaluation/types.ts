/**
 * Evaluation contract shared by every challenge format and every subject.
 *
 * Four outcomes are deliberately distinct:
 * - `correct` / `incorrect`: a well-formed answer was judged. Counts as an attempt.
 * - `invalid_submission`: the answer could not be read (wrong shape, unknown option,
 *   missing field, too long). Not an attempt; the learner is told what to fix.
 * - `evaluation_error`: the engine failed (no evaluator, bug). Not an attempt and
 *   never the learner's fault. `cause` is for server logs only, never for clients.
 */
import type { Challenge } from "../schema";

/** Partial, non-revealing information an evaluator may return to make feedback actionable. */
export type EvaluationDetail =
  | { kind: "selection"; missed: number; wrongSelected: number }
  | { kind: "positions"; inPlace: number; total: number }
  | { kind: "fields"; incorrect: string[]; total: number }
  | { kind: "bug"; lineCorrect: boolean };

export type EvaluationResult =
  | { status: "correct"; detail?: EvaluationDetail }
  | {
      status: "incorrect";
      /** Key into the challenge's `feedback.byAnswer` for targeted misconception feedback. */
      misconceptionKey?: string;
      detail?: EvaluationDetail;
    }
  | { status: "invalid_submission"; reason: string }
  | { status: "evaluation_error"; reason: string; cause?: string };

export type Judged = Extract<EvaluationResult, { status: "correct" | "incorrect" }>;

/**
 * An evaluator for one challenge format. `type` is a plain string so that future
 * subject packs can register formats this module has never heard of.
 */
export interface Evaluator {
  readonly type: string;
  evaluate(challenge: Challenge, rawSubmission: unknown): EvaluationResult;
}
