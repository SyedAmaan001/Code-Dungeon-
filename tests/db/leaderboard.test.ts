/**
 * Leaderboard scaling (migration 0004): maintained XP totals and SQL-ranked pages must give
 * exactly what the original design gave: the ledger summed per player (0001's
 * leaderboard_records) ranked by the reference implementation, rankLeaderboard().
 */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "@/db/migrate";
import {
  DEFAULT_GAME_POLICY,
  leaderboardLimit,
  rankLeaderboard,
  type GamePolicy,
  type LeaderboardRecord,
} from "@/domain";
import type { Sql } from "@/db/client";
import { GameService } from "@/services/game-service";
import { LearningService } from "@/services/learning-service";
import {
  PostgresLeaderboardSource,
  PostgresPlayerAccounts,
  PostgresPlayerStore,
  scoped,
} from "@/services/postgres-player-store";
import { createTestDatabase, describeDb, MIGRATIONS_DIR, type TestDatabase } from "../support/db";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

const PATH = "python-fundamentals";
const BASE = Date.UTC(2026, 9, 17, 9, 0, 0);

/** Small deterministic PRNG (mulberry32) so failures are reproducible. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Seeded {
  ids: string[];
  nextPosition: Map<string, number>;
}

/** Create players (as the owner, bypassing RLS) with handles in mixed case. */
async function seedPlayers(sql: Sql, count: number, rnd: () => number, prefix: string) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const letter = "abcdefghij"[Math.floor(rnd() * 10)]!;
    const handle = `${rnd() < 0.5 ? letter.toUpperCase() : letter}${prefix}${String(i).padStart(3, "0")}`;
    const [p] = await sql<{ id: string }[]>`
      INSERT INTO players (handle, leaderboard_visible) VALUES (${handle}, ${rnd() < 0.8})
      RETURNING id`;
    await sql`INSERT INTO player_paths (player_id, path_id) VALUES (${p!.id}, ${PATH})`;
    ids.push(p!.id);
  }
  return ids;
}

/** Random awards; few distinct amounts and instants so XP and reach-time ties are common. */
async function randomAwards(sql: Sql, seeded: Seeded, count: number, rnd: () => number) {
  for (let i = 0; i < count; i++) {
    const playerId = seeded.ids[Math.floor(rnd() * seeded.ids.length)]!;
    const position = seeded.nextPosition.get(playerId) ?? 0;
    seeded.nextPosition.set(playerId, position + 1);
    const amount = [5, 10, 20, 25][Math.floor(rnd() * 4)]!;
    const at = new Date(BASE + Math.floor(rnd() * 6) * 1000);
    await sql`
      INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
      VALUES (${playerId}, ${PATH}, ${`k${position}`}, ${amount}, 'challenge_solved', 'L001', ${at}, ${position})`;
  }
}

/** The original 0001 aggregation over the whole ledger, plus the viewer's own record. */
async function ledgerRecords(sql: Sql, viewerId?: string): Promise<LeaderboardRecord[]> {
  const rows = await sql<
    { id: string; handle: string; visible: boolean; xp: number | null; reached_at: Date | null }[]
  >`
    SELECT p.id, p.handle, p.leaderboard_visible AS visible,
           sum(x.amount)::integer AS xp, max(x.awarded_at) AS reached_at
    FROM players p LEFT JOIN xp_ledger x ON x.player_id = p.id AND x.path_id = ${PATH}
    GROUP BY p.id, p.handle, p.leaderboard_visible`;
  return rows
    .filter((r) => (r.visible && r.xp !== null) || r.id === viewerId)
    .map((r) => ({
      playerId: r.id,
      handle: r.handle,
      xp: r.xp ?? 0,
      reachedAt: r.reached_at ? r.reached_at.toISOString() : null,
      visible: r.visible,
    }));
}

async function expectTotalsMatchLedger(sql: Sql) {
  const mismatches = await sql`
    SELECT coalesce(l.player_id, t.player_id) AS player_id
    FROM (SELECT player_id, path_id, sum(amount)::integer AS xp, max(awarded_at) AS reached_at
          FROM xp_ledger GROUP BY player_id, path_id) l
    FULL JOIN player_path_xp t USING (player_id, path_id)
    WHERE l.xp IS DISTINCT FROM t.xp OR l.reached_at IS DISTINCT FROM t.reached_at`;
  expect(mismatches).toEqual([]);
}

/** New (SQL page) and reference (ledger + rankLeaderboard) boards must be identical. */
async function expectSameBoard(
  sql: Sql,
  viewerId: string | undefined,
  limit: number | undefined,
  policy: GamePolicy = DEFAULT_GAME_POLICY,
) {
  const page = await new PostgresLeaderboardSource(sql).page(PATH, viewerId, {
    limit: leaderboardLimit(limit, policy),
    minXp: policy.leaderboard.minXp,
  });
  const reference = rankLeaderboard(
    await ledgerRecords(sql, viewerId),
    { ...(viewerId && { viewerId }), ...(limit !== undefined && { limit }) },
    policy,
  );
  expect(page, `viewer ${viewerId ?? "none"}, limit ${limit ?? "default"}`).toEqual(reference);
}

const withMinXp = (minXp: number): GamePolicy => ({
  ...DEFAULT_GAME_POLICY,
  leaderboard: { ...DEFAULT_GAME_POLICY.leaderboard, minXp },
});

describeDb("leaderboard totals and SQL ranking (migration 0004)", () => {
  describe("backfill", () => {
    let db: TestDatabase;
    beforeAll(async () => {
      db = await createTestDatabase({ migrate: false });
    });
    afterAll(() => db.drop());

    it("backfills totals from a ledger written before 0004 and ranks it identically", async () => {
      const before = mkdtempSync(join(tmpdir(), "cd-migrations-"));
      try {
        cpSync(MIGRATIONS_DIR, before, { recursive: true });
        rmSync(join(before, "0004_player_path_xp.sql"));
        await migrate(db.sql, before);
      } finally {
        rmSync(before, { recursive: true, force: true });
      }
      const rnd = prng(4);
      const seeded = { ids: await seedPlayers(db.sql, 25, rnd, "bf"), nextPosition: new Map() };
      await randomAwards(db.sql, seeded, 200, rnd);

      const report = await migrate(db.sql, MIGRATIONS_DIR);
      expect(report.applied).toEqual(["0004_player_path_xp"]);
      const [row] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM player_path_xp`;
      expect(row!.n).toBeGreaterThan(15);
      await expectTotalsMatchLedger(db.sql);
      for (const viewer of [undefined, ...seeded.ids.slice(0, 6)])
        for (const limit of [1, 3, 10, undefined]) await expectSameBoard(db.sql, viewer, limit);
      // Awards after the migration keep the backfilled totals current.
      await randomAwards(db.sql, seeded, 50, rnd);
      await expectTotalsMatchLedger(db.sql);
      expect((await migrate(db.sql, MIGRATIONS_DIR)).applied).toEqual([]);
    });
  });

  describe("maintained totals", () => {
    let db: TestDatabase;
    let seeded: Seeded;
    beforeAll(async () => {
      db = await createTestDatabase();
      seeded = { ids: await seedPlayers(db.sql, 40, prng(7), "rn"), nextPosition: new Map() };
    });
    afterAll(() => db.drop());

    it("stay equal to the ledger and rank identically under random awards", async () => {
      const rnd = prng(11);
      for (let round = 0; round < 4; round++) {
        await randomAwards(db.sql, seeded, 120, rnd);
        await expectTotalsMatchLedger(db.sql);
        const hidden = (
          await db.sql<{ id: string }[]>`SELECT id FROM players WHERE NOT leaderboard_visible`
        ).map((r) => r.id);
        const withoutXp = seeded.ids.filter((id) => !seeded.nextPosition.has(id));
        const viewers = [
          undefined,
          seeded.ids[round]!,
          seeded.ids[seeded.ids.length - 1 - round]!,
          ...hidden.slice(0, 2),
          ...withoutXp.slice(0, 1),
          "00000000-0000-4000-8000-000000000000", // no such player
        ];
        for (const viewer of viewers)
          for (const limit of [1, 2, 5, 10, 100, 0, -3, undefined])
            await expectSameBoard(db.sql, viewer, limit);
        for (const minXp of [0, 30, 60])
          await expectSameBoard(db.sql, seeded.ids[round], 5, withMinXp(minXp));
      }
    });

    it("return at most limit + 1 rows and never a player id", async () => {
      const viewer = seeded.ids[seeded.ids.length - 1]!;
      const rows = await scoped(
        db.sql,
        viewer,
        (tx) => tx`SELECT * FROM leaderboard_page(${PATH}, ${3}, ${1})`,
      );
      expect(rows.length).toBeLessThanOrEqual(4);
      const [fn] = await db.sql`
        SELECT pg_get_function_result('leaderboard_page(text, integer, integer)'::regprocedure) AS result`;
      expect(fn!.result).toBe(
        "TABLE(handle text, xp integer, reached_at timestamp with time zone, rank bigint, is_viewer boolean, total_ranked bigint)",
      );
      // The viewer comes from the session only: another session never sees it as "viewer".
      const other = await scoped(
        db.sql,
        seeded.ids[0]!,
        (tx) => tx`SELECT is_viewer FROM leaderboard_page(${PATH}, ${100}, ${1}) WHERE is_viewer`,
      );
      expect(other.length).toBeLessThanOrEqual(1);
    });

    it("reject a duplicate award and leave the total unchanged", async () => {
      const id = seeded.ids[1]!;
      const [before] = await db.sql`SELECT xp FROM player_path_xp WHERE player_id = ${id}`;
      await expect(
        db.sql`
          INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
          VALUES (${id}, ${PATH}, 'k0', 25, 'challenge_solved', 'L001', now(), 9999)`,
      ).rejects.toMatchObject({ code: "23505" });
      const [after] = await db.sql`SELECT xp FROM player_path_xp WHERE player_id = ${id}`;
      expect(after).toEqual(before);
    });

    it("roll back with the transaction that awarded the XP", async () => {
      const id = seeded.ids[2]!;
      const [before] =
        await db.sql`SELECT xp, reached_at FROM player_path_xp WHERE player_id = ${id}`;
      await expect(
        db.sql.begin(async (tx) => {
          await tx`
            INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
            VALUES (${id}, ${PATH}, 'rolled-back', 500, 'challenge_solved', 'L001', now(), 8888)`;
          throw new Error("fail after the award");
        }),
      ).rejects.toThrow("fail after the award");
      const [after] =
        await db.sql`SELECT xp, reached_at FROM player_path_xp WHERE player_id = ${id}`;
      expect(after).toEqual(before);
      await expectTotalsMatchLedger(db.sql);
    });

    it("count concurrent awards to the same and different players exactly once", async () => {
      const targets = seeded.ids.slice(0, 4);
      await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          db.sql.begin(async (tx) => {
            const playerId = targets[i % targets.length]!;
            await tx`
              INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
              VALUES (${playerId}, ${PATH}, ${`c${i}`}, 10, 'challenge_solved', 'L001',
                      ${new Date(BASE + 60_000 + i)}, ${10_000 + i})`;
          }),
        ),
      );
      await expectTotalsMatchLedger(db.sql);
    });

    it("rank ties exactly like the domain: shared rank, case-insensitive handle order", async () => {
      const tie = new Date(BASE + 3_600_000);
      const ids: string[] = [];
      for (const handle of ["zeta", "Alpha", "beta", "Gamma"]) {
        const [p] = await db.sql<{ id: string }[]>`
          INSERT INTO players (handle, leaderboard_visible) VALUES (${handle}, true) RETURNING id`;
        await db.sql`INSERT INTO player_paths (player_id, path_id) VALUES (${p!.id}, ${PATH})`;
        ids.push(p!.id);
      }
      // Same XP (1,000,000) for all four; Gamma reached it one millisecond later.
      for (const [i, id] of ids.entries())
        await db.sql`
          INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
          VALUES (${id}, ${PATH}, 'big', 1000000, 'level_completed', 'L001',
                  ${i === 3 ? new Date(tie.getTime() + 1) : tie}, 0)`;
      const board = await new PostgresLeaderboardSource(db.sql).page(PATH, ids[3], {
        limit: 5,
        minXp: 1,
      });
      expect(board.entries.slice(0, 4).map((e) => [e.rank, e.handle])).toEqual([
        [1, "Alpha"],
        [1, "beta"],
        [1, "zeta"],
        [4, "Gamma"],
      ]);
      expect(board.viewer).toEqual({ ranked: true, rank: 4, xp: 1_000_000 });
      await expectSameBoard(db.sql, ids[3], 5);
      await expectSameBoard(db.sql, ids[0], 2);
    });

    it("disappear with the account (deletion cascade)", async () => {
      const id = seeded.ids[3]!;
      expect((await db.sql`SELECT 1 FROM player_path_xp WHERE player_id = ${id}`).length).toBe(1);
      expect(await new PostgresPlayerAccounts(db.sql).deleteAccount(id)).toBe(true);
      expect((await db.sql`SELECT 1 FROM player_path_xp WHERE player_id = ${id}`).length).toBe(0);
      await expectTotalsMatchLedger(db.sql);
      await expectSameBoard(db.sql, seeded.ids[4], 10);
    });
  });

  describe("through the services (application role, real submissions)", () => {
    let db: TestDatabase;
    let game: GameService;
    let accounts: PostgresPlayerAccounts;
    const pack = loadOrThrow(VALID_SMALL);
    const answers: [string, string, unknown][] = [
      ["fx.L001", "fx.L001.c1", { output: "23" }],
      ["fx.L001", "fx.L001.c2", { selected: ["a"] }],
      ["fx.L002", "fx.L002.c1", { blanks: { b1: "print" } }],
      ["fx.L002", "fx.L002.c2", { order: ["l1", "l2", "l3", "l4"] }],
    ];

    beforeAll(async () => {
      db = await createTestDatabase();
      let tick = 0;
      const now = () => new Date(BASE + tick++);
      const store = new PostgresPlayerStore(db.sql);
      const learning = new LearningService({ pack, store: store.progressStore, now });
      game = new GameService({
        pack,
        learning,
        store: store.gameStore,
        transactional: store,
        leaderboardSource: new PostgresLeaderboardSource(db.sql),
        now,
      });
      accounts = new PostgresPlayerAccounts(db.sql);
    });
    afterAll(() => db.drop());

    it("keeps totals exact for concurrent and duplicate submissions from several players", async () => {
      const players: string[] = [];
      for (const handle of ["Ada", "bob", "Cyd"]) {
        const r = await accounts.create({ handle, visible: true });
        if (!r.ok) throw new Error(r.reason);
        players.push(r.profile.playerId);
      }
      // Every answer is sent three times at once by every player.
      await Promise.all(
        players.flatMap((playerId) =>
          answers.flatMap(([levelId, challengeId, answer], i) =>
            Array.from({ length: 3 }, () =>
              game.submit(playerId, {
                submissionId: `sub-${i}-xxxx`,
                levelId,
                challengeId,
                answer,
              }),
            ),
          ),
        ),
      );
      await expectTotalsMatchLedger(db.sql);
      const totals = await db.sql<{ xp: number }[]>`SELECT xp FROM player_path_xp`;
      expect(totals).toHaveLength(3);
      // Same answers, same XP: every player's total is the single-award total.
      expect(new Set(totals.map((t) => t.xp)).size).toBe(1);
      const board = await game.leaderboard(players[0]);
      expect(board.totalRanked).toBe(3);
      expect(board.viewer).toMatchObject({ ranked: true });
    });
  });
});
