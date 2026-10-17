/**
 * Transactional persistence for one player's learning progress and game state.
 *
 * Phase 4 requirement: a submission's learning result and its game events are saved in a
 * single transaction. A TransactionalPlayerStore loads both records for one player and path
 * under a lock, lets the caller compute the new records, and persists them together — or
 * persists nothing if anything fails (the callback throws or a write is rejected).
 */
import type { Leaderboard, LeaderboardRecord } from "@/domain";
import { emptyGameState, emptyProgress } from "@/domain";
import { GameStateConflictError, type GameStateRecord, type GameStateStore } from "./game-store";
import {
  ProgressConflictError,
  type LoadOptions,
  type ProgressRecord,
  type ProgressStore,
} from "./progress-store";

export interface PlayerRecords {
  progress: ProgressRecord;
  game: GameStateRecord;
}

/** What a transaction callback returns: a value, plus the records to persist (omit = unchanged). */
export interface TransactionResult<T> {
  value: T;
  progress?: ProgressRecord;
  game?: GameStateRecord;
}

export interface TransactionalPlayerStore {
  readonly durable: boolean;
  transaction<T>(
    playerId: string,
    pathId: string,
    options: LoadOptions,
    fn: (records: PlayerRecords) => TransactionResult<T> | Promise<TransactionResult<T>>,
  ): Promise<T>;
}

/** Cross-player leaderboard input, limited to public fields (DEC-006). */
export interface LeaderboardSource {
  readonly durable: boolean;
  /** Visible players with XP on the path, plus the viewer's own record (even if hidden). */
  records(pathId: string, viewerId?: string): Promise<LeaderboardRecord[]>;
  /**
   * Optional: one page ranked by the store itself, by the same rules as `rankLeaderboard`
   * (`limit` already clamped by the policy). Used instead of `records` when present.
   */
  page?(
    pathId: string,
    viewerId: string | undefined,
    options: { limit: number; minXp: number },
  ): Promise<Leaderboard>;
}

export function emptyRecords(pathId: string): PlayerRecords {
  return {
    progress: { progress: emptyProgress(pathId), submissions: {}, revision: 0 },
    game: { state: emptyGameState(pathId), processed: {}, revision: 0 },
  };
}

/**
 * In-memory implementation with the same all-or-nothing semantics as the database:
 * transactions for one player run one at a time and commit by swapping in copies only
 * after the callback succeeds. `progressStore` and `gameStore` are views over the same
 * records for the services' read paths. Development/test only: not durable.
 */
export class InMemoryPlayerStore implements TransactionalPlayerStore {
  readonly durable = false;
  private readonly records = new Map<string, PlayerRecords>();
  private readonly locks = new Map<string, Promise<unknown>>();

  readonly progressStore: ProgressStore = {
    durable: false,
    load: async (learnerId, pathId) => this.snapshot(learnerId, pathId)?.progress,
    save: (learnerId, pathId, record, expectedRevision) =>
      this.transaction(learnerId, pathId, {}, ({ progress }) => {
        if (progress.revision !== expectedRevision) throw new ProgressConflictError();
        return { value: undefined, progress: record };
      }),
  };

  readonly gameStore: GameStateStore = {
    durable: false,
    load: async (learnerId, pathId) => this.snapshot(learnerId, pathId)?.game,
    save: (learnerId, pathId, record, expectedRevision) =>
      this.transaction(learnerId, pathId, {}, ({ game }) => {
        if (game.revision !== expectedRevision) throw new GameStateConflictError();
        return { value: undefined, game: record };
      }),
  };

  private key(playerId: string, pathId: string) {
    return `${playerId}\u0000${pathId}`;
  }

  private snapshot(playerId: string, pathId: string): PlayerRecords | undefined {
    const r = this.records.get(this.key(playerId, pathId));
    return r && structuredClone(r);
  }

  async transaction<T>(
    playerId: string,
    pathId: string,
    _options: LoadOptions,
    fn: (records: PlayerRecords) => TransactionResult<T> | Promise<TransactionResult<T>>,
  ): Promise<T> {
    const key = this.key(playerId, pathId);
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => {})
      .then(async () => {
        const before = this.snapshot(playerId, pathId) ?? emptyRecords(pathId);
        const result = await fn(structuredClone(before));
        this.records.set(key, {
          progress: result.progress
            ? { ...structuredClone(result.progress), revision: before.progress.revision + 1 }
            : before.progress,
          game: result.game
            ? { ...structuredClone(result.game), revision: before.game.revision + 1 }
            : before.game,
        });
        return result.value;
      });
    this.locks.set(key, run);
    return run;
  }
}
