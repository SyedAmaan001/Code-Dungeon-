/**
 * Persistence port for learner progress.
 *
 * `InMemoryProgressStore` is a DEVELOPMENT/TEST adapter: progress lives in this process's
 * memory, is lost on restart and is not shared between server instances. The durable
 * adapter is `PostgresPlayerStore` (src/services/postgres-player-store.ts, Phase 4).
 */
import type { LearnerProgress } from "@/domain";
import type { SubmitResult } from "./learning-service";

export interface ProgressRecord {
  progress: LearnerProgress;
  /** Results of processed submissions, keyed by the client's idempotency key. */
  submissions: Record<string, SubmitResult>;
  /** Incremented on every save; used for optimistic concurrency. */
  revision: number;
}

export class ProgressConflictError extends Error {
  constructor() {
    super("progress was changed by another request; reload and retry");
  }
}

export interface LoadOptions {
  /**
   * The submission id the caller is about to check. Durable stores load only this entry
   * of `submissions` (the map is a partial view there); in-memory stores load everything.
   */
  submissionId?: string;
}

export interface ProgressStore {
  readonly durable: boolean;
  load(
    learnerId: string,
    pathId: string,
    options?: LoadOptions,
  ): Promise<ProgressRecord | undefined>;
  /** Saves only if the stored revision still equals `expectedRevision`. */
  save(
    learnerId: string,
    pathId: string,
    record: ProgressRecord,
    expectedRevision: number,
  ): Promise<void>;
}

export class InMemoryProgressStore implements ProgressStore {
  readonly durable = false;
  private readonly records = new Map<string, ProgressRecord>();

  async load(learnerId: string, pathId: string): Promise<ProgressRecord | undefined> {
    const r = this.records.get(`${learnerId}\u0000${pathId}`);
    return r && structuredClone(r);
  }

  async save(
    learnerId: string,
    pathId: string,
    record: ProgressRecord,
    expectedRevision: number,
  ): Promise<void> {
    const key = `${learnerId}\u0000${pathId}`;
    const current = this.records.get(key)?.revision ?? 0;
    if (current !== expectedRevision) throw new ProgressConflictError();
    this.records.set(key, structuredClone({ ...record, revision: expectedRevision + 1 }));
  }
}
