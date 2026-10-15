import { afterAll, beforeAll, expect, it } from "vitest";
import { PostgresPlayerAccounts, scoped } from "@/services/postgres-player-store";
import { PostgresRateLimiter } from "@/services/postgres-rate-limit";
import { layeredLimiter, RateLimiter } from "@/services/rate-limit";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";

// A fixed clock keeps every call in the same one-minute window.
const at = (iso: string) => () => new Date(iso);
const now = at("2026-10-15T10:00:30Z");

describeDb("shared rate limit (PostgreSQL)", () => {
  let db: TestDatabase;
  let a: string;
  let b: string;
  beforeAll(async () => {
    db = await createTestDatabase();
    const accounts = new PostgresPlayerAccounts(db.sql);
    const ra = await accounts.create({ handle: "Limited" });
    const rb = await accounts.create({ handle: "Other" });
    if (!ra.ok || !rb.ok) throw new Error("setup failed");
    a = ra.profile.playerId;
    b = rb.profile.playerId;
  });
  afterAll(() => db.drop());

  it("allows up to the limit per player per minute, then refuses", async () => {
    const limiter = new PostgresRateLimiter(db.sql, 3, now);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await limiter.allow(a));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await limiter.allow(b)).toBe(true);
  });

  it("is shared between independent limiter instances (as separate servers would be)", async () => {
    const [server1, server2] = [
      new PostgresRateLimiter(db.sql, 4, now),
      new PostgresRateLimiter(db.sql, 4, now),
    ];
    // Player b already used 1 of this minute's window above.
    expect(await server1.allow(b)).toBe(true);
    expect(await server2.allow(b)).toBe(true);
    expect(await server1.allow(b)).toBe(true);
    expect(await server2.allow(b)).toBe(false);
  });

  it("counts concurrent requests exactly once each", async () => {
    const accounts = new PostgresPlayerAccounts(db.sql);
    const r = await accounts.create({ handle: "Burst" });
    if (!r.ok) throw new Error();
    const limiter = new PostgresRateLimiter(db.sql, 10, now);
    const results = await Promise.all(
      Array.from({ length: 16 }, () => limiter.allow(r.profile.playerId)),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
  });

  it("starts a fresh window each minute and removes windows older than ten minutes", async () => {
    const later = new PostgresRateLimiter(db.sql, 3, at("2026-10-15T10:01:05Z"));
    expect(await later.allow(a)).toBe(true); // new minute: the limit resets
    const much = new PostgresRateLimiter(db.sql, 3, at("2026-10-15T10:30:00Z"));
    expect(await much.allow(a)).toBe(true);
    const windows = await db.sql`
      SELECT window_start FROM action_rate_limits WHERE player_id = ${a} ORDER BY window_start`;
    expect(windows.map((w) => (w.window_start as Date).toISOString())).toEqual([
      "2026-10-15T10:30:00.000Z",
    ]);
  });

  it("keeps counters private to their player", async () => {
    await scoped(db.sql, a, async (tx) => {
      const rows = await tx`SELECT player_id FROM action_rate_limits`;
      expect(rows.every((row) => row.player_id === a)).toBe(true);
      const updated = await tx`UPDATE action_rate_limits SET hits = 1 WHERE player_id = ${b}`;
      expect(updated.count).toBe(0);
    });
  });

  it("layers a local flood guard in front of the shared limit", async () => {
    const accounts = new PostgresPlayerAccounts(db.sql);
    const r = await accounts.create({ handle: "Layered" });
    if (!r.ok) throw new Error();
    const limiter = layeredLimiter(
      new RateLimiter(2, 60_000),
      new PostgresRateLimiter(db.sql, 10, now),
    );
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await limiter.allow(r.profile.playerId));
    expect(results).toEqual([true, true, false]);
    const [row] = await db.sql`
      SELECT sum(hits)::int AS hits FROM action_rate_limits WHERE player_id = ${r.profile.playerId}`;
    expect(row!.hits).toBe(2); // the refused call never reached the database
  });
});
