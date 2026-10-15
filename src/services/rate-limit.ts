/**
 * Per-key sliding-window rate limit for submissions and hints (R-36).
 *
 * Process-local: it protects one server process from runaway clients and scripted
 * floods. A hosted deployment with several instances needs a shared limiter
 * (database or provider feature) in addition; see docs/PHASE_5_REPORT.md.
 */
export class RateLimiter {
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
