/**
 * Shared rate limit for account writes (migration 0005): per bucket, atomic, on the database
 * clock, unreadable by the application role, and a player bucket only chargeable by that
 * player's own session.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { APP_ROLE, PostgresPlayerAccounts, scoped } from "@/services/postgres-player-store";
import {
  identityBucket,
  playerBucket,
  PostgresBucketRateLimiter,
} from "@/services/postgres-rate-limit";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";

describeDb("account write rate limit (PostgreSQL)", () => {
  let db: TestDatabase;
  let a: string;
  let b: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    const accounts = new PostgresPlayerAccounts(db.sql);
    const ra = await accounts.create({ handle: "Ana", visible: true });
    const rb = await accounts.create({ handle: "Bea", visible: true });
    if (!ra.ok || !rb.ok) throw new Error("setup");
    a = ra.profile.playerId;
    b = rb.profile.playerId;
  });
  afterAll(() => db.drop());

  it("allows the budget, then refuses, per bucket", async () => {
    const limiter = new PostgresBucketRateLimiter(db.sql, 3, 86_400);
    const profileA = playerBucket(a, "profile");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await limiter.allow(profileA));
    expect(results).toEqual([true, true, true, false, false]);
    // Other actions and other players have their own budgets.
    expect(await limiter.allow(playerBucket(a, "delete"))).toBe(true);
    expect(await limiter.allow(playerBucket(b, "profile"))).toBe(true);
  });

  it("counts concurrent requests exactly once each", async () => {
    const limiter = new PostgresBucketRateLimiter(db.sql, 10, 86_400);
    const results = await Promise.all(
      Array.from({ length: 30 }, () => limiter.allow(playerBucket(b, "delete"))),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
  });

  it("limits a verified identity before it has a player, storing only a hash", async () => {
    const limiter = new PostgresBucketRateLimiter(db.sql, 2, 86_400);
    const bucket = identityBucket("supabase", "user-subject-123", "onboarding");
    expect(bucket).toMatch(/^identity:[0-9a-f]{64}:onboarding$/);
    expect([
      await limiter.allow(bucket),
      await limiter.allow(bucket),
      await limiter.allow(bucket),
    ]).toEqual([true, true, false]);
    const stored = await db.sql<{ bucket: string }[]>`SELECT bucket FROM account_rate_limits`;
    expect(JSON.stringify(stored)).not.toContain("user-subject-123");
    // A different identity is unaffected.
    expect(await limiter.allow(identityBucket("supabase", "someone-else", "onboarding"))).toBe(
      true,
    );
  });

  it("refuses to charge another player's bucket (cross-account)", async () => {
    await expect(
      scoped(
        db.sql,
        a,
        (tx) => tx`SELECT account_rate_limit_hit(${playerBucket(b, "delete")}, 600, 10)`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
        return tx`SELECT account_rate_limit_hit(${playerBucket(a, "delete")}, 600, 10)`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("is invisible and read-only to the application role", async () => {
    await expect(
      scoped(db.sql, a, (tx) => tx`SELECT * FROM account_rate_limits`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      scoped(db.sql, a, (tx) => tx`DELETE FROM account_rate_limits`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects malformed buckets and invalid limits", async () => {
    const limiter = new PostgresBucketRateLimiter(db.sql, 3, 600);
    await expect(limiter.allow("identity:not-a-hash:onboarding")).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      new PostgresBucketRateLimiter(db.sql, 0, 600).allow(playerBucket(a, "profile")),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("drops windows older than a day when a new window starts", async () => {
    const stale = identityBucket("dev", "stale", "onboarding");
    await db.sql`
      INSERT INTO account_rate_limits (bucket, window_start, hits)
      VALUES (${stale}, now() - interval '2 days', 5)`;
    // A new window for another bucket triggers the clean-up.
    await new PostgresBucketRateLimiter(db.sql, 3, 60).allow(
      identityBucket("dev", "fresh", "onboarding"),
    );
    expect((await db.sql`SELECT 1 FROM account_rate_limits WHERE bucket = ${stale}`).length).toBe(
      0,
    );
  });

  it("starts a new budget in the next window", async () => {
    const bucket = identityBucket("dev", "windowed", "onboarding");
    // Pretend the current window was exhausted a window ago (database clock).
    await db.sql`
      INSERT INTO account_rate_limits (bucket, window_start, hits)
      VALUES (${bucket}, to_timestamp(floor(extract(epoch FROM now()) / 60) * 60) - interval '60 seconds', 99)`;
    expect(await new PostgresBucketRateLimiter(db.sql, 3, 60).allow(bucket)).toBe(true);
  });
});
