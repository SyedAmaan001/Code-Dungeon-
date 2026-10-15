/**
 * Shared per-player rate limit in PostgreSQL (migration 0003). Fixed one-minute windows,
 * incremented atomically with an upsert, under the player's row-level security. Works
 * across any number of server instances with no extra service.
 */
import "server-only";
import type { Sql } from "@/db/client";
import { scoped } from "./postgres-player-store";
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
