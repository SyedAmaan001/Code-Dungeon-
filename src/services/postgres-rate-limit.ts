/**
 * Shared per-player rate limit in PostgreSQL (migration 0003). Fixed one-minute windows,
 * incremented atomically with an upsert, under the player's row-level security. Works
 * across any number of server instances with no extra service.
 */
import "server-only";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import type { Sql } from "@/db/client";
import { APP_ROLE, scoped } from "./postgres-player-store";
import type { ActionLimiter } from "./rate-limit";

export class PostgresRateLimiter implements ActionLimiter {
  constructor(
    private readonly sql: Sql,
    /** Actions allowed per player per minute. */
    private readonly perMinute: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async allow(playerId: string): Promise<boolean> {
    const windowStart = new Date(Math.floor(this.now().getTime() / 60_000) * 60_000);
    const expired = new Date(windowStart.getTime() - 10 * 60_000);
    return scoped(this.sql, playerId, async (tx) => {
      const [row] = await tx<{ hits: number }[]>`
        INSERT INTO action_rate_limits (player_id, window_start, hits)
        VALUES (${playerId}, ${windowStart}, 1)
        ON CONFLICT (player_id, window_start)
        DO UPDATE SET hits = action_rate_limits.hits + 1
        RETURNING hits`;
      // A new window: clear this player's old windows (keeps the table small).
      if (row!.hits === 1)
        await tx`
          DELETE FROM action_rate_limits
          WHERE player_id = ${playerId} AND window_start < ${expired}`;
      return row!.hits <= this.perMinute;
    });
  }
}

/** Account writes that have their own budget (migration 0005). */
export type AccountAction = "profile" | "onboarding" | "delete";

/** Bucket for a signed-in player's account write (the id comes from the verified session). */
export function playerBucket(playerId: string, action: AccountAction): string {
  return `player:${playerId}:${action}`;
}

/** Bucket for a verified identity that has no player yet (onboarding). Stores only a hash. */
export function identityBucket(provider: string, subject: string, action: AccountAction): string {
  const hash = createHash("sha256").update(`${provider}\u0000${subject}`).digest("hex");
  return `identity:${hash}:${action}`;
}

/**
 * Shared limit for account writes: fixed windows on the database clock, counted atomically
 * by `account_rate_limit_hit()` (migration 0005). A `player:` bucket is charged inside that
 * player's own session, which the database checks; the table itself is not readable by the
 * application role.
 */
export class PostgresBucketRateLimiter implements ActionLimiter {
  constructor(
    private readonly sql: Sql,
    /** Hits allowed per bucket per window. */
    private readonly limit: number,
    private readonly windowSeconds: number,
  ) {}

  async allow(bucket: string): Promise<boolean> {
    const hit = (tx: postgres.TransactionSql) => tx<{ ok: boolean }[]>`
      SELECT account_rate_limit_hit(${bucket}, ${this.windowSeconds}, ${this.limit}) AS ok`;
    const player = /^player:([0-9a-f-]{36}):/.exec(bucket)?.[1];
    const [row] = player
      ? await scoped(this.sql, player, hit)
      : await this.sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
          return hit(tx);
        });
    return row!.ok;
  }
}
