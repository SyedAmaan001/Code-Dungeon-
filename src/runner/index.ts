/**
 * CodeRunner: the only path by which learner-submitted code could ever be executed.
 *
 * Live execution is DISABLED (docs/decision.md R-004, P-004; architecture-proposal.md §10).
 * Learner code must never run on the application server. A real implementation must be
 * an isolated, approved sandbox provider behind this interface, with the limits below.
 */
export interface RunRequest {
  language: "python";
  code: string;
  stdin?: string;
}

export type RunOutcome =
  | { status: "unavailable"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "timeout" }
  | { status: "completed"; stdout: string; stderr: string; exitCode: number };

export interface CodeRunner {
  readonly enabled: boolean;
  run(request: RunRequest): Promise<RunOutcome>;
}

/** Limits any future runner must enforce before and during execution. */
export const RUNNER_LIMITS = {
  maxCodeBytes: 16 * 1024,
  maxStdinBytes: 4 * 1024,
  maxOutputBytes: 64 * 1024,
  timeoutMs: 5_000,
} as const;

export class DisabledRunner implements CodeRunner {
  readonly enabled = false;

  async run(): Promise<RunOutcome> {
    return {
      status: "unavailable",
      reason: "Live code execution is not enabled in Code Dungeon yet.",
    };
  }
}

export const codeRunner: CodeRunner = new DisabledRunner();
