/**
 * Persistence ports for game state and public player identities.
 *
 * Only in-memory adapters exist. They are DEVELOPMENT/TEST adapters: data lives in
 * this process, is lost on restart, and is not shared between servers or devices.
 * A leaderboard built on them ranks only the players held in this process — it is
 * not a persistent leaderboard. Durable adapters arrive with storage and auth.
 */
import { validateHandle, type GameEvent, type GameState } from "@/domain";
import type { LoadOptions } from "./progress-store";

export interface GameStateRecord {
  state: GameState;
  /** Game events produced for each processed learning submission id (idempotency). */
  processed: Record<string, GameEvent[]>;
  revision: number;
}

export class GameStateConflictError extends Error {
  constructor() {
    super("game state was changed by another request; retry with the same submission id");
  }
}

export interface GameStateStore {
  readonly durable: boolean;
  load(
    learnerId: string,
    pathId: string,
    options?: LoadOptions,
  ): Promise<GameStateRecord | undefined>;
  save(
    learnerId: string,
    pathId: string,
    record: GameStateRecord,
    expectedRevision: number,
  ): Promise<void>;
}

export class InMemoryGameStateStore implements GameStateStore {
  readonly durable = false;
  private readonly records = new Map<string, GameStateRecord>();

  async load(learnerId: string, pathId: string): Promise<GameStateRecord | undefined> {
    const r = this.records.get(`${learnerId}\u0000${pathId}`);
    return r && structuredClone(r);
  }

  async save(
    learnerId: string,
    pathId: string,
    record: GameStateRecord,
    expectedRevision: number,
  ): Promise<void> {
    const key = `${learnerId}\u0000${pathId}`;
    if ((this.records.get(key)?.revision ?? 0) !== expectedRevision)
      throw new GameStateConflictError();
    this.records.set(key, structuredClone({ ...record, revision: expectedRevision + 1 }));
  }
}

export interface PlayerProfile {
  playerId: string;
  handle: string;
  /** Whether the player appears on the leaderboard. */
  visible: boolean;
}

export interface PlayerDirectory {
  readonly durable: boolean;
  list(): Promise<PlayerProfile[]>;
}

export type RegisterResult = { ok: true; profile: PlayerProfile } | { ok: false; reason: string };

export class InMemoryPlayerDirectory implements PlayerDirectory {
  readonly durable = false;
  private readonly players = new Map<string, PlayerProfile>();

  /** `playerId` must come from a verified session; the handle is validated and unique (case-insensitive). */
  register(playerId: string, handle: string, visible = true): RegisterResult {
    const check = validateHandle(handle);
    if (!check.ok) return { ok: false, reason: check.reason };
    const taken = [...this.players.values()].some(
      (p) => p.playerId !== playerId && p.handle.toLowerCase() === check.handle.toLowerCase(),
    );
    if (taken) return { ok: false, reason: "that name is already taken" };
    const profile = { playerId, handle: check.handle, visible };
    this.players.set(playerId, profile);
    return { ok: true, profile };
  }

  async list(): Promise<PlayerProfile[]> {
    return [...this.players.values()].map((p) => ({ ...p }));
  }
}
