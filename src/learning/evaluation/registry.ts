import type { Challenge } from "../schema";
import { BUILT_IN_EVALUATORS } from "./evaluators";
import type { EvaluationResult, Evaluator } from "./types";

/**
 * Maps a challenge format to its evaluator. A new subject adds formats by registering
 * evaluators here (plus a schema variant and projection) — no other engine code changes.
 */
export class EvaluatorRegistry {
  private readonly evaluators = new Map<string, Evaluator>();

  constructor(evaluators: readonly Evaluator[] = []) {
    evaluators.forEach((e) => this.register(e));
  }

  register(evaluator: Evaluator): this {
    if (this.evaluators.has(evaluator.type))
      throw new Error(`an evaluator for "${evaluator.type}" is already registered`);
    this.evaluators.set(evaluator.type, evaluator);
    return this;
  }

  has(type: string): boolean {
    return this.evaluators.has(type);
  }

  types(): string[] {
    return [...this.evaluators.keys()].sort();
  }

  /** Never throws: engine failures become `evaluation_error`. */
  evaluate(challenge: Challenge, rawSubmission: unknown): EvaluationResult {
    const evaluator = this.evaluators.get(challenge.type);
    if (!evaluator)
      return {
        status: "evaluation_error",
        reason: "this kind of challenge cannot be checked yet",
        cause: `no evaluator registered for "${challenge.type}"`,
      };
    try {
      return evaluator.evaluate(challenge, rawSubmission);
    } catch (err) {
      return {
        status: "evaluation_error",
        reason: "the answer could not be checked",
        cause: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export function createDefaultRegistry(): EvaluatorRegistry {
  return new EvaluatorRegistry(BUILT_IN_EVALUATORS);
}
