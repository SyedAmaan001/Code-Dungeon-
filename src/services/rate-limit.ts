/**
 * Rate limits for answers and hints (R-36, R-48).
 *
 * `ActionLimiter` is what server actions call. The runtime layers two limiters:
 * a process-local `RateLimiter` (cheap; stops floods before they reach the database)
 * and the shared `PostgresRateLimiter` (src/services/postgres-rate-limit.ts), which
 * holds the limit across every server instance.
 */
export interface ActionLimiter {
  /** Record one action for `key` and say whether it is within the limit. */
  allow(key: string): Promise<boolean> | boolean;
}

/** Every limiter must allow the action; stops at the first refusal. */
export function layeredLimiter(...limiters: ActionLimiter[]): ActionLimiter {
  return {
    async allow(key) {
      for (const limiter of limiters) if (!(await limiter.allow(key))) return false;
      return true;
    },
  };
}

/** Process-local sliding window (one server process only). */
export class RateLimiter implements ActionLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record a hit and say whether it is within the limit. */
  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(since);
    return true;
  }

  private prune(since: number) {
    for (const [key, times] of this.hits) if (!times.some((t) => t > since)) this.hits.delete(key);
  }
}
