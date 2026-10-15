/**
 * Turns an evaluation into learner-facing feedback.
 *
 * Correct answers get the confirmation and the full explanation. Incorrect answers get
 * targeted misconception feedback (if the author wrote one for that answer) or the
 * default nudge, plus a non-revealing progress sentence — never the answer itself.
 */
import type { Challenge } from "../schema";
import type { EvaluationDetail, EvaluationResult } from "./types";

export interface Feedback {
  tone: "correct" | "incorrect" | "invalid" | "error";
  message: string;
  /** Optional extra sentence derived from the evaluation detail. */
  detail?: string;
  /** Only present for correct answers. */
  explanation?: string;
  /** Whether this submission counted as an attempt. */
  counted: boolean;
}

const DEFAULT_CORRECT = "Correct!";
const DEFAULT_INCORRECT =
  "Not quite. Read the feedback, use a hint if you need one, and try again.";

export function composeFeedback(challenge: Challenge, result: EvaluationResult): Feedback {
  switch (result.status) {
    case "correct":
      return {
        tone: "correct",
        message: challenge.feedback?.correct ?? DEFAULT_CORRECT,
        ...(challenge.explanation !== undefined && { explanation: challenge.explanation }),
        counted: true,
      };
    case "incorrect": {
      const targeted =
        result.misconceptionKey !== undefined
          ? challenge.feedback?.byAnswer?.[result.misconceptionKey]
          : undefined;
      const detail = result.detail && describeDetail(result.detail);
      return {
        tone: "incorrect",
        message: targeted ?? challenge.feedback?.incorrect ?? DEFAULT_INCORRECT,
        ...(detail && { detail }),
        counted: true,
      };
    }
    case "invalid_submission":
      return {
        tone: "invalid",
        message: `Your answer could not be read: ${result.reason}. It was not counted.`,
        counted: false,
      };
    case "evaluation_error":
      return {
        tone: "error",
        message: "Something went wrong while checking your answer. It was not counted.",
        counted: false,
      };
  }
}

function describeDetail(d: EvaluationDetail): string | undefined {
  switch (d.kind) {
    case "positions":
      return `${d.inPlace} of ${d.total} lines are already in the right place.`;
    case "fields":
      return d.total > 1 ? `Check again: ${d.incorrect.join(", ")}.` : undefined;
    case "selection":
      if (d.wrongSelected > 0 && d.missed > 0)
        return "Some of your choices don't fit, and at least one correct option is missing.";
      if (d.wrongSelected > 0) return "At least one of your choices doesn't fit.";
      return d.missed > 0
        ? "You're on track, but at least one correct option is missing."
        : undefined;
    case "bug":
      return d.lineCorrect
        ? "You found the right line. Now choose a fix that makes the program do what was intended."
        : "The bug is on a different line. Trace the program line by line.";
  }
}
