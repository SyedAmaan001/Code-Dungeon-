/**
 * Deterministic evaluators for the built-in formats. None of them executes learner
 * code. They are subject-neutral: multiple choice, fill-in, ordering and tracing work
 * for any subject; `language` on a challenge only affects display and verification.
 */
import { z } from "zod";
import type { Challenge, ChallengeType } from "../schema";
import { normalizeOutput, normalizeToken } from "./normalize";
import type { EvaluationResult, Evaluator } from "./types";

/** Hard limits on submission size (abuse protection; generous for real answers). */
export const SUBMISSION_LIMITS = {
  maxTextLength: 2_000,
  maxItems: 50,
  maxIdLength: 100,
} as const;

const SubmittedText = z.string().max(SUBMISSION_LIMITS.maxTextLength);
const SubmittedId = z.string().min(1).max(SUBMISSION_LIMITS.maxIdLength);

type ChallengeOf<T extends ChallengeType> = Extract<Challenge, { type: T }>;

/** Wraps parsing and type narrowing so each evaluator only handles well-formed input. */
export function defineEvaluator<T extends ChallengeType, S>(
  type: T,
  submission: z.ZodType<S>,
  judge: (challenge: ChallengeOf<T>, submission: S) => EvaluationResult,
): Evaluator {
  return {
    type,
    evaluate(challenge, raw) {
      if (challenge.type !== type) {
        return {
          status: "evaluation_error",
          reason: "evaluator does not match challenge type",
          cause: `${type} evaluator received ${challenge.type}`,
        };
      }
      const parsed = submission.safeParse(raw);
      if (!parsed.success) {
        return { status: "invalid_submission", reason: describeShapeError(parsed.error) };
      }
      return judge(challenge as ChallengeOf<T>, parsed.data);
    },
  };
}

function describeShapeError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "the answer is not in the expected format";
  const where = first.path.length ? ` (${first.path.join(".")})` : "";
  return `the answer is not in the expected format${where}: ${first.message}`;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export const multipleChoiceEvaluator = defineEvaluator(
  "multiple_choice",
  z.strictObject({ selected: z.array(SubmittedId).min(1).max(SUBMISSION_LIMITS.maxItems) }),
  (c, s) => {
    const selected = [...new Set(s.selected)];
    const known = new Set(c.options.map((o) => o.id));
    const unknown = selected.find((id) => !known.has(id));
    if (unknown) return { status: "invalid_submission", reason: "an unknown option was selected" };
    if (!c.allowMultiple && selected.length > 1)
      return { status: "invalid_submission", reason: "choose exactly one option" };

    const correct = c.answer.correct;
    if (sameSet(selected, correct)) return { status: "correct" };
    return {
      status: "incorrect",
      misconceptionKey: [...selected].sort().join(","),
      ...(c.allowMultiple && {
        detail: {
          kind: "selection" as const,
          missed: correct.filter((id) => !selected.includes(id)).length,
          wrongSelected: selected.filter((id) => !correct.includes(id)).length,
        },
      }),
    };
  },
);

export const predictOutputEvaluator = defineEvaluator(
  "predict_output",
  z.strictObject({ output: SubmittedText }),
  (c, s) => {
    const given = normalizeOutput(s.output);
    const accepted = [c.answer.output, ...c.answer.acceptedVariants].map(normalizeOutput);
    if (accepted.includes(given)) return { status: "correct" };
    return { status: "incorrect", misconceptionKey: given };
  },
);

const ValueMap = z
  .record(SubmittedId, SubmittedText)
  .refine((m) => Object.keys(m).length <= SUBMISSION_LIMITS.maxItems, "too many values");

/** Shared by fill_blank and trace: every expected key must be answered, nothing extra. */
function judgeValueMap(
  expected: { id: string; label?: string }[],
  accepted: Record<string, string[]>,
  given: Record<string, string>,
): EvaluationResult {
  const ids = expected.map((e) => e.id);
  const extra = Object.keys(given).find((k) => !ids.includes(k));
  if (extra) return { status: "invalid_submission", reason: `unexpected answer field "${extra}"` };
  const missing = ids.find((id) => normalizeToken(given[id] ?? "") === "");
  if (missing)
    return { status: "invalid_submission", reason: "answer every box before submitting" };

  const incorrect = expected
    .filter(
      (e) => !(accepted[e.id] ?? []).map(normalizeToken).includes(normalizeToken(given[e.id]!)),
    )
    .map((e) => e.label ?? e.id);
  if (incorrect.length === 0) return { status: "correct" };
  const key =
    ids.length === 1
      ? normalizeToken(given[ids[0]!]!)
      : ids.map((id) => `${id}=${normalizeToken(given[id]!)}`).join(";");
  return {
    status: "incorrect",
    misconceptionKey: key,
    detail: { kind: "fields", incorrect, total: ids.length },
  };
}

export const fillBlankEvaluator = defineEvaluator(
  "fill_blank",
  z.strictObject({ blanks: ValueMap }),
  (c, s) => judgeValueMap(c.blanks, c.answer.accepted, s.blanks),
);

export const traceEvaluator = defineEvaluator(
  "trace",
  z.strictObject({ values: ValueMap }),
  (c, s) => judgeValueMap(c.fields, c.answer.values, s.values),
);

export const orderLinesEvaluator = defineEvaluator(
  "order_lines",
  z.strictObject({ order: z.array(SubmittedId).min(1).max(SUBMISSION_LIMITS.maxItems) }),
  (c, s) => {
    const ids = c.lines.map((l) => l.id);
    if (
      s.order.length !== ids.length ||
      !sameSet(s.order, ids) ||
      new Set(s.order).size !== ids.length
    )
      return { status: "invalid_submission", reason: "use every line exactly once" };
    if (c.answer.orders.some((o) => o.join("|") === s.order.join("|")))
      return { status: "correct" };
    // Report progress against the closest accepted order without revealing which lines are wrong.
    const inPlace = Math.max(
      ...c.answer.orders.map((o) => o.filter((id, i) => s.order[i] === id).length),
    );
    return { status: "incorrect", detail: { kind: "positions", inPlace, total: ids.length } };
  },
);

export const findFixBugEvaluator = defineEvaluator(
  "find_fix_bug",
  z.strictObject({ line: z.int().min(1).max(10_000), fix: SubmittedId }),
  (c, s) => {
    const lineCount = c.code.split("\n").length;
    if (s.line > lineCount)
      return { status: "invalid_submission", reason: "that line does not exist" };
    if (!c.fixes.some((f) => f.id === s.fix))
      return { status: "invalid_submission", reason: "an unknown fix was selected" };
    const lineCorrect = s.line === c.answer.line;
    if (lineCorrect && s.fix === c.answer.fix) return { status: "correct" };
    return {
      status: "incorrect",
      misconceptionKey: lineCorrect ? `fix:${s.fix}` : `line:${s.line}`,
      detail: { kind: "bug", lineCorrect },
    };
  },
);

/**
 * Built-in evaluators. `code_write` is intentionally absent: it would need a sandboxed
 * CodeRunner, which is disabled (decision R-004 / P-004).
 */
export const BUILT_IN_EVALUATORS: readonly Evaluator[] = [
  multipleChoiceEvaluator,
  predictOutputEvaluator,
  fillBlankEvaluator,
  traceEvaluator,
  orderLinesEvaluator,
  findFixBugEvaluator,
];
