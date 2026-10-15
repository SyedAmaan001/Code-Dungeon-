/**
 * PostgreSQL persistence for learning progress and game state (Phase 4).
 *
 * Isolation: every operation runs in a transaction that switches to the non-owner role
 * `code_dungeon_app` and sets `app.player_id` to the player's id, so the row-level-security
 * policies in db/migrations/0001_initial.sql limit it to that player's rows. The player id
 * must come from a verified session (docs/auth-design.md); request bodies never supply it.
 *
 * Atomicity: `transaction()` locks the player's `player_paths` row, loads both records,
 * runs the caller's pure computation and writes all changes before COMMIT. If the callback
 * throws or any write violates a constraint, the whole transaction rolls back.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  emptyGameState,
  emptyProgress,
  validateHandle,
  type ChallengeProgress,
  type EncounterState,
  type GameEvent,
  type LeaderboardRecord,
  type LearnerProgress,
} from "@/domain";
import type { Sql } from "@/db/client";
import { GameStateConflictError, type GameStateRecord, type GameStateStore } from "./game-store";
import type { SubmitResult } from "./learning-service";
import {
  type LeaderboardSource,
  type PlayerRecords,
  type TransactionalPlayerStore,
  type TransactionResult,
} from "./player-store";
import {
  ProgressConflictError,
  type LoadOptions,
  type ProgressRecord,
  type ProgressStore,
} from "./progress-store";

export const APP_ROLE = "code_dungeon_app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = postgres.TransactionSql;

export class UnknownPlayerError extends Error {
  constructor() {
    super("no such player");
  }
}

function assertPlayerId(playerId: string) {
  if (!UUID.test(playerId)) throw new Error("playerId must be a UUID from a verified session");
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
const pgCode = (err: unknown) => (err as { code?: string } | null)?.code;

/** Run `fn` in one transaction restricted to `playerId` by row-level security. */
export async function scoped<T>(
  sql: Sql,
  playerId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertPlayerId(playerId);
  return (await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.player_id', ${playerId}, true)`;
    await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
    return fn(tx);
  })) as T;
}

interface Revisions {
  progress: number;
  game: number;
}

export class PostgresPlayerStore implements TransactionalPlayerStore {
  readonly durable = true;

  constructor(private readonly sql: Sql) {}

  // -------------------------------------------------------------------------
  // Transactional API (used by GameService for submissions and hints)
  // -------------------------------------------------------------------------

  async transaction<T>(
    playerId: string,
    pathId: string,
    options: LoadOptions,
    fn: (records: PlayerRecords) => TransactionResult<T> | Promise<TransactionResult<T>>,
  ): Promise<T> {
    return scoped(this.sql, playerId, async (tx) => {
      const revisions = await this.lockPath(tx, playerId, pathId);
      const before = await this.loadRecords(tx, playerId, pathId, revisions, options);
      const result = await fn(structuredClone(before));
      await this.write(tx, playerId, pathId, before, result.progress, result.game);
      return result.value;
    });
  }

  // -------------------------------------------------------------------------
  // Store views (used by the services' read paths and the non-transactional save path)
  // -------------------------------------------------------------------------

  readonly progressStore: ProgressStore = {
    durable: true,
    load: async (playerId, pathId, options = {}) =>
      scoped(this.sql, playerId, async (tx) => {
        const revisions = await this.readRevisions(tx, playerId, pathId);
        return (
          revisions && (await this.loadRecords(tx, playerId, pathId, revisions, options)).progress
        );
      }),
    save: (playerId, pathId, record, expectedRevision) =>
      scoped(this.sql, playerId, async (tx) => {
        const revisions = await this.lockPath(tx, playerId, pathId);
        if (revisions.progress !== expectedRevision) throw new ProgressConflictError();
        const before = await this.loadRecords(tx, playerId, pathId, revisions, {});
        await this.write(tx, playerId, pathId, before, record, undefined);
      }),
  };

  readonly gameStore: GameStateStore = {
    durable: true,
    load: async (playerId, pathId, options = {}) =>
      scoped(this.sql, playerId, async (tx) => {
        const revisions = await this.readRevisions(tx, playerId, pathId);
        return revisions && (await this.loadRecords(tx, playerId, pathId, revisions, options)).game;
      }),
    save: (playerId, pathId, record, expectedRevision) =>
      scoped(this.sql, playerId, async (tx) => {
        const revisions = await this.lockPath(tx, playerId, pathId);
        if (revisions.game !== expectedRevision) throw new GameStateConflictError();
        const before = await this.loadRecords(tx, playerId, pathId, revisions, {});
        await this.write(tx, playerId, pathId, before, undefined, record);
      }),
  };

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async readRevisions(
    tx: Tx,
    playerId: string,
    pathId: string,
  ): Promise<Revisions | undefined> {
    const [row] = await tx<{ progress_revision: number; game_revision: number }[]>`
      SELECT progress_revision, game_revision FROM player_paths
      WHERE player_id = ${playerId} AND path_id = ${pathId}`;
    return row && { progress: row.progress_revision, game: row.game_revision };
  }

  /** Create the player's path row if needed and lock it for the rest of the transaction. */
  private async lockPath(tx: Tx, playerId: string, pathId: string): Promise<Revisions> {
    try {
      await tx`INSERT INTO player_paths (player_id, path_id) VALUES (${playerId}, ${pathId}) ON CONFLICT DO NOTHING`;
    } catch (err) {
      if (pgCode(err) === "23503") throw new UnknownPlayerError(); // foreign key: no such player
      throw err;
    }
    const [row] = await tx<{ progress_revision: number; game_revision: number }[]>`
      SELECT progress_revision, game_revision FROM player_paths
      WHERE player_id = ${playerId} AND path_id = ${pathId} FOR UPDATE`;
    if (!row) throw new UnknownPlayerError();
    return { progress: row.progress_revision, game: row.game_revision };
  }

  private async loadRecords(
    tx: Tx,
    playerId: string,
    pathId: string,
    revisions: Revisions,
    options: LoadOptions,
  ): Promise<PlayerRecords> {
    const where = tx`player_id = ${playerId} AND path_id = ${pathId}`;
    const [
      levels,
      challenges,
      xp,
      encounters,
      checkpoints,
      quests,
      achievements,
      items,
      submissions,
    ] = await Promise.all([
      tx`SELECT level_id, completed_at, mastered_at FROM level_progress WHERE ${where}`,
      tx`SELECT * FROM challenge_progress WHERE ${where}`,
      tx`SELECT * FROM xp_ledger WHERE ${where} ORDER BY position`,
      tx`SELECT * FROM encounters WHERE ${where}`,
      tx`SELECT level_id, reached_at FROM checkpoints WHERE ${where} ORDER BY position`,
      tx`SELECT * FROM quest_progress WHERE ${where}`,
      tx`SELECT achievement_id, unlocked_at FROM player_achievements WHERE ${where}`,
      tx`SELECT source, item, awarded_at FROM reward_items WHERE ${where} ORDER BY position`,
      options.submissionId
        ? tx`SELECT submission_id, learning_result, game_events FROM submissions
               WHERE ${where} AND submission_id = ${options.submissionId}`
        : Promise.resolve([]),
    ]);

    const progress: LearnerProgress = emptyProgress(pathId);
    for (const l of levels)
      progress.levels[l.level_id] = {
        challenges: {},
        ...(l.completed_at && { completedAt: iso(l.completed_at) }),
        ...(l.mastered_at && { masteredAt: iso(l.mastered_at) }),
      };
    for (const c of challenges) {
      const cp: ChallengeProgress = {
        attempts: c.attempts,
        correct: c.correct,
        hintsRevealed: c.hints_revealed,
        hintsSinceLastAttempt: c.hints_since_last_attempt,
        demonstrated: c.demonstrated,
        ...(c.first_try_clean !== null && { firstTryClean: c.first_try_clean }),
      };
      (progress.levels[c.level_id] ??= { challenges: {} }).challenges[c.challenge_id] = cp;
    }
    progress.xp = xp.map((e) => ({
      sourceKey: e.source_key,
      amount: e.amount,
      reason: e.reason,
      levelId: e.level_id,
      ...(e.challenge_id !== null && { challengeId: e.challenge_id }),
      at: iso(e.awarded_at)!,
    }));

    const game = emptyGameState(pathId);
    for (const e of encounters) {
      const state: EncounterState = {
        status: e.status,
        runs: e.runs,
        defeats: e.defeats,
        ...(e.current_run && { current: e.current_run }),
        ...(e.won_at && { wonAt: iso(e.won_at) }),
        ...(e.flawless !== null && { flawless: e.flawless }),
      };
      game.encounters[e.level_id] = state;
    }
    game.checkpoints = checkpoints.map((c) => ({ levelId: c.level_id, at: iso(c.reached_at)! }));
    for (const q of quests)
      game.quests[q.quest_id] = {
        state: q.state,
        activatedAt: iso(q.activated_at)!,
        ...(q.completed_at && { completedAt: iso(q.completed_at) }),
        objectivesMet: [...q.objectives_met],
      };
    for (const a of achievements)
      game.achievements[a.achievement_id] = { unlockedAt: iso(a.unlocked_at)! };
    game.items = items.map((i) => ({ item: i.item, source: i.source, at: iso(i.awarded_at)! }));

    const learningResults: Record<string, SubmitResult> = {};
    const processed: Record<string, GameEvent[]> = {};
    for (const s of submissions) {
      learningResults[s.submission_id] = s.learning_result as SubmitResult;
      if (s.game_events) processed[s.submission_id] = s.game_events as GameEvent[];
    }

    return {
      progress: { progress, submissions: learningResults, revision: revisions.progress },
      game: { state: game, processed, revision: revisions.game },
    };
  }

  /** Write only rows that changed; insert-only tables are never updated. */
  private async write(
    tx: Tx,
    playerId: string,
    pathId: string,
    before: PlayerRecords,
    progress: ProgressRecord | undefined,
    game: GameStateRecord | undefined,
  ) {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const json = (v: unknown) => tx.json(v as postgres.JSONValue);

    if (progress) {
      for (const [levelId, lp] of Object.entries(progress.progress.levels)) {
        const old = before.progress.progress.levels[levelId];
        if (!old || old.completedAt !== lp.completedAt || old.masteredAt !== lp.masteredAt)
          await tx`
            INSERT INTO level_progress (player_id, path_id, level_id, completed_at, mastered_at)
            VALUES (${playerId}, ${pathId}, ${levelId}, ${lp.completedAt ?? null}, ${lp.masteredAt ?? null})
            ON CONFLICT (player_id, path_id, level_id)
            DO UPDATE SET completed_at = EXCLUDED.completed_at, mastered_at = EXCLUDED.mastered_at`;
        for (const [challengeId, cp] of Object.entries(lp.challenges)) {
          if (same(old?.challenges[challengeId], cp)) continue;
          await tx`
            INSERT INTO challenge_progress (player_id, path_id, level_id, challenge_id, attempts, correct,
              hints_revealed, hints_since_last_attempt, first_try_clean, demonstrated)
            VALUES (${playerId}, ${pathId}, ${levelId}, ${challengeId}, ${cp.attempts}, ${cp.correct},
              ${cp.hintsRevealed}, ${cp.hintsSinceLastAttempt}, ${cp.firstTryClean ?? null}, ${cp.demonstrated})
            ON CONFLICT (player_id, path_id, level_id, challenge_id) DO UPDATE SET
              attempts = EXCLUDED.attempts, correct = EXCLUDED.correct, hints_revealed = EXCLUDED.hints_revealed,
              hints_since_last_attempt = EXCLUDED.hints_since_last_attempt,
              first_try_clean = EXCLUDED.first_try_clean, demonstrated = EXCLUDED.demonstrated`;
        }
      }

      const known = new Set(before.progress.progress.xp.map((e) => e.sourceKey));
      for (const [position, e] of progress.progress.xp.entries()) {
        if (known.has(e.sourceKey)) continue;
        await tx`
          INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, challenge_id, awarded_at, position)
          VALUES (${playerId}, ${pathId}, ${e.sourceKey}, ${e.amount}, ${e.reason}, ${e.levelId},
            ${e.challengeId ?? null}, ${e.at}, ${position})`;
      }

      const candidates = Object.keys(progress.submissions);
      const existing = candidates.length
        ? new Set(
            (
              await tx<{ submission_id: string }[]>`
                SELECT submission_id FROM submissions
                WHERE player_id = ${playerId} AND path_id = ${pathId} AND submission_id IN ${tx(candidates)}`
            ).map((r) => r.submission_id),
          )
        : new Set<string>();
      for (const id of candidates) {
        if (existing.has(id)) continue;
        const result = progress.submissions[id]!;
        if (result.status === "rejected") continue; // rejections are never stored
        try {
          await tx`
            INSERT INTO submissions (player_id, path_id, submission_id, level_id, challenge_id, learning_result, game_events)
            VALUES (${playerId}, ${pathId}, ${id}, ${result.levelId}, ${result.challengeId}, ${json(result)},
              ${game?.processed[id] ? json(game.processed[id]) : null})`;
        } catch (err) {
          if (pgCode(err) === "23505") throw new ProgressConflictError(); // concurrent duplicate
          throw err;
        }
      }
      await tx`UPDATE player_paths SET progress_revision = progress_revision + 1, updated_at = now()
               WHERE player_id = ${playerId} AND path_id = ${pathId}`;
    }

    if (game) {
      const s = game.state;
      for (const [levelId, e] of Object.entries(s.encounters)) {
        if (same(before.game.state.encounters[levelId], e)) continue;
        await tx`
          INSERT INTO encounters (player_id, path_id, level_id, status, runs, defeats, current_run, won_at, flawless)
          VALUES (${playerId}, ${pathId}, ${levelId}, ${e.status}, ${e.runs}, ${e.defeats},
            ${e.current ? json(e.current) : null}, ${e.wonAt ?? null}, ${e.flawless ?? null})
          ON CONFLICT (player_id, path_id, level_id) DO UPDATE SET status = EXCLUDED.status, runs = EXCLUDED.runs,
            defeats = EXCLUDED.defeats, current_run = EXCLUDED.current_run, won_at = EXCLUDED.won_at,
            flawless = EXCLUDED.flawless`;
      }
      const reached = new Set(before.game.state.checkpoints.map((c) => c.levelId));
      for (const [position, c] of s.checkpoints.entries())
        if (!reached.has(c.levelId))
          await tx`INSERT INTO checkpoints (player_id, path_id, level_id, reached_at, position)
                   VALUES (${playerId}, ${pathId}, ${c.levelId}, ${c.at}, ${position})`;
      for (const [questId, q] of Object.entries(s.quests)) {
        if (same(before.game.state.quests[questId], q)) continue;
        await tx`
          INSERT INTO quest_progress (player_id, path_id, quest_id, state, activated_at, completed_at, objectives_met)
          VALUES (${playerId}, ${pathId}, ${questId}, ${q.state}, ${q.activatedAt}, ${q.completedAt ?? null},
            ${tx.array(q.objectivesMet)}::text[])
          ON CONFLICT (player_id, path_id, quest_id) DO UPDATE SET state = EXCLUDED.state,
            completed_at = EXCLUDED.completed_at, objectives_met = EXCLUDED.objectives_met`;
      }
      for (const [achievementId, a] of Object.entries(s.achievements))
        if (!before.game.state.achievements[achievementId])
          await tx`INSERT INTO player_achievements (player_id, path_id, achievement_id, unlocked_at)
                   VALUES (${playerId}, ${pathId}, ${achievementId}, ${a.unlockedAt})`;
      const sources = new Set(before.game.state.items.map((i) => i.source));
      for (const [position, i] of s.items.entries())
        if (!sources.has(i.source))
          await tx`INSERT INTO reward_items (player_id, path_id, source, item, awarded_at, position)
                   VALUES (${playerId}, ${pathId}, ${i.source}, ${i.item}, ${i.at}, ${position})`;

      for (const [id, events] of Object.entries(game.processed)) {
        if (before.game.processed[id] || progress?.submissions[id]) continue; // unchanged, or inserted above
        const updated = await tx`
          UPDATE submissions SET game_events = ${json(events)}
          WHERE player_id = ${playerId} AND path_id = ${pathId} AND submission_id = ${id} AND game_events IS NULL`;
        if (updated.count === 0) {
          const [row] = await tx`SELECT 1 FROM submissions
                                 WHERE player_id = ${playerId} AND path_id = ${pathId} AND submission_id = ${id}`;
          if (!row) throw new Error(`game events for unknown submission ${id}`);
        }
      }
      await tx`UPDATE player_paths SET game_revision = game_revision + 1, updated_at = now()
               WHERE player_id = ${playerId} AND path_id = ${pathId}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Leaderboard (public fields only; DEC-006)
// ---------------------------------------------------------------------------

export class PostgresLeaderboardSource implements LeaderboardSource {
  readonly durable = true;

  constructor(private readonly sql: Sql) {}

  async records(pathId: string, viewerId?: string): Promise<LeaderboardRecord[]> {
    const rows = await this.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
      return tx<{ player_id: string; handle: string; xp: number; reached_at: Date }[]>`
        SELECT player_id, handle, xp, reached_at FROM leaderboard_records(${pathId})`;
    });
    const records: LeaderboardRecord[] = rows.map((r) => ({
      playerId: r.player_id,
      handle: r.handle,
      xp: r.xp,
      reachedAt: iso(r.reached_at)!,
      visible: true,
    }));
    // The viewer's own record, read under their own row-level security, so the board can
    // explain why they are unranked (hidden or no XP yet).
    if (viewerId && UUID.test(viewerId) && !records.some((r) => r.playerId === viewerId)) {
      const own = await scoped(this.sql, viewerId, async (tx) => {
        const [p] = await tx<{ handle: string; leaderboard_visible: boolean }[]>`
          SELECT handle, leaderboard_visible FROM players WHERE id = ${viewerId}`;
        if (!p) return undefined;
        const [x] = await tx<{ xp: number | null; reached_at: Date | null }[]>`
          SELECT sum(amount)::integer AS xp, max(awarded_at) AS reached_at FROM xp_ledger
          WHERE player_id = ${viewerId} AND path_id = ${pathId}`;
        const xp = x?.xp ?? 0;
        return {
          playerId: viewerId,
          handle: p.handle,
          xp,
          reachedAt: xp > 0 ? iso(x?.reached_at)! : null,
          visible: p.leaderboard_visible,
        };
      });
      if (own) records.push(own);
    }
    return records;
  }
}

// ---------------------------------------------------------------------------
// Player accounts (profiles; linked to an identity provider once one is approved)
// ---------------------------------------------------------------------------

export interface AccountProfile {
  playerId: string;
  handle: string;
  visible: boolean;
}

export type AccountResult = { ok: true; profile: AccountProfile } | { ok: false; reason: string };

export class PostgresPlayerAccounts {
  constructor(private readonly sql: Sql) {}

  /**
   * Create a player. In production this runs only after an approved identity provider has
   * verified the sign-in; `identity` links the account to that provider's subject id.
   */
  async create(input: {
    handle: string;
    visible?: boolean;
    identity?: { provider: string; subject: string };
    /** Outcome of the onboarding age check (DEC-010); required with an identity. */
    ageCheck?: { policy: string; at: Date };
  }): Promise<AccountResult> {
    const check = validateHandle(input.handle);
    if (!check.ok) return { ok: false, reason: check.reason };
    if (input.identity && !input.ageCheck)
      return { ok: false, reason: "the age check must be completed first" };
    const playerId = randomUUID();
    try {
      await scoped(
        this.sql,
        playerId,
        (tx) => tx`
        INSERT INTO players (id, handle, leaderboard_visible, auth_provider, auth_subject,
          age_check_policy, age_checked_at)
        VALUES (${playerId}, ${check.handle}, ${input.visible ?? true},
          ${input.identity?.provider ?? null}, ${input.identity?.subject ?? null},
          ${input.ageCheck?.policy ?? null}, ${input.ageCheck?.at ?? null})`,
      );
    } catch (err) {
      if (pgCode(err) === "23505") {
        const constraint = (err as { constraint_name?: string }).constraint_name ?? "";
        return {
          ok: false,
          reason: constraint.includes("handle")
            ? "that name is already taken"
            : "that sign-in is already linked to a player",
        };
      }
      throw err;
    }
    return {
      ok: true,
      profile: { playerId, handle: check.handle, visible: input.visible ?? true },
    };
  }

  async get(playerId: string): Promise<AccountProfile | undefined> {
    const [row] = await scoped(
      this.sql,
      playerId,
      (tx) => tx<{ handle: string; leaderboard_visible: boolean }[]>`
      SELECT handle, leaderboard_visible FROM players WHERE id = ${playerId}`,
    );
    return row && { playerId, handle: row.handle, visible: row.leaderboard_visible };
  }

  async update(
    playerId: string,
    changes: { handle?: string; visible?: boolean },
  ): Promise<AccountResult> {
    const current = await this.get(playerId);
    if (!current) return { ok: false, reason: "no such player" };
    let handle = current.handle;
    if (changes.handle !== undefined) {
      const check = validateHandle(changes.handle);
      if (!check.ok) return { ok: false, reason: check.reason };
      handle = check.handle;
    }
    const visible = changes.visible ?? current.visible;
    try {
      await scoped(
        this.sql,
        playerId,
        (tx) => tx`
        UPDATE players SET handle = ${handle}, leaderboard_visible = ${visible}, updated_at = now()
        WHERE id = ${playerId}`,
      );
    } catch (err) {
      if (pgCode(err) === "23505") return { ok: false, reason: "that name is already taken" };
      throw err;
    }
    return { ok: true, profile: { playerId, handle, visible } };
  }

  /** Delete a player and, by cascade, all of their progress and game data. */
  async delete(playerId: string): Promise<boolean> {
    const result = await scoped(
      this.sql,
      playerId,
      (tx) => tx`DELETE FROM players WHERE id = ${playerId}`,
    );
    return result.count === 1;
  }

  /** Resolve a provider-verified identity to a player id (docs/auth-design.md). */
  async playerIdForIdentity(provider: string, subject: string): Promise<string | undefined> {
    const [row] = await this.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
      return tx<
        { id: string | null }[]
      >`SELECT player_id_for_identity(${provider}, ${subject}) AS id`;
    });
    return row?.id ?? undefined;
  }
}
