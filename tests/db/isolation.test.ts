/**
 * Cross-account isolation: one account must never read or modify another account's data.
 * Checked at the SQL level (row-level security, grants) and through the services.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, expect, it } from "vitest";
import { GameService } from "@/services/game-service";
import { LearningService } from "@/services/learning-service";
import {
  APP_ROLE,
  PostgresLeaderboardSource,
  PostgresPlayerAccounts,
  PostgresPlayerStore,
  scoped,
} from "@/services/postgres-player-store";
import { PostgresRateLimiter } from "@/services/postgres-rate-limit";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

type Tx = postgres.TransactionSql;

const TABLES = [
  "player_paths",
  "level_progress",
  "challenge_progress",
  "xp_ledger",
  "player_path_xp",
  "submissions",
  "encounters",
  "checkpoints",
  "quest_progress",
  "player_achievements",
  "reward_items",
  "action_rate_limits",
];

describeDb("cross-account isolation", () => {
  let db: TestDatabase;
  let a: string;
  let b: string;
  let game: GameService;
  let learning: LearningService;

  beforeAll(async () => {
    db = await createTestDatabase();
    const accounts = new PostgresPlayerAccounts(db.sql);
    const ra = await accounts.create({ handle: "Alice" });
    const rb = await accounts.create({ handle: "Bryn" });
    if (!ra.ok || !rb.ok) throw new Error("setup failed");
    a = ra.profile.playerId;
    b = rb.profile.playerId;

    const pack = loadOrThrow(VALID_SMALL);
    pack.meta.quests.forEach((q) => (q.status = "published"));
    pack.meta.achievements.forEach((x) => (x.status = "published"));
    const store = new PostgresPlayerStore(db.sql);
    learning = new LearningService({ pack, store: store.progressStore });
    game = new GameService({
      pack,
      learning,
      store: store.gameStore,
      transactional: store,
      leaderboardSource: new PostgresLeaderboardSource(db.sql),
    });
    // Give Bryn data in every table: complete both fixture levels (quest, achievement, checkpoint, items).
    const answers: [string, string, unknown][] = [
      ["fx.L001", "fx.L001.c1", { output: "23" }],
      ["fx.L001", "fx.L001.c2", { selected: ["a"] }],
      ["fx.L002", "fx.L002.c1", { blanks: { b1: "print" } }],
      ["fx.L002", "fx.L002.c2", { order: ["l1", "l2", "l3", "l4"] }],
      ["fx.L002", "fx.L002.c3", { values: { x: "5", y: "10" } }],
      ["fx.L002", "fx.L002.c4", { line: 3, fix: "f1" }],
    ];
    let n = 0;
    for (const [levelId, challengeId, answer] of answers)
      await game.submit(b, {
        submissionId: `bryn-${String(n++).padStart(4, "0")}`,
        levelId,
        challengeId,
        answer,
      });
    await new PostgresRateLimiter(db.sql, 40).allow(b);
  });
  afterAll(() => db.drop());

  it("gives the second account data in every player table (precondition)", async () => {
    for (const t of TABLES) {
      const [row] = await db.sql.unsafe(
        `SELECT count(*)::int AS n FROM ${t} WHERE player_id = $1`,
        [b],
      );
      expect(row!.n, t).toBeGreaterThan(0);
    }
  });

  it("hides every row of another account from reads", async () => {
    await scoped(db.sql, a, async (tx) => {
      for (const t of TABLES) {
        const [row] = await tx.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
        expect(row!.n, t).toBe(0);
      }
      const players = await tx`SELECT id FROM players`;
      expect(players.map((p) => p.id)).toEqual([a]);
    });
  });

  it("silently matches no rows when updating another account's data", async () => {
    await scoped(db.sql, a, async (tx) => {
      expect((await tx`UPDATE players SET handle = 'Hacked' WHERE id = ${b}`).count).toBe(0);
      expect(
        (await tx`UPDATE challenge_progress SET attempts = 0 WHERE player_id = ${b}`).count,
      ).toBe(0);
      expect(
        (await tx`UPDATE submissions SET game_events = NULL WHERE player_id = ${b}`).count,
      ).toBe(0);
      expect((await tx`DELETE FROM players WHERE id = ${b}`).count).toBe(0);
    });
    const [bryn] = await db.sql`SELECT handle FROM players WHERE id = ${b}`;
    expect(bryn!.handle).toBe("Bryn");
  });

  it("rejects inserting rows for another account", async () => {
    await expect(
      scoped(
        db.sql,
        a,
        (tx) => tx`INSERT INTO player_paths (player_id, path_id) VALUES (${b}, 'other')`,
      ),
    ).rejects.toMatchObject({ code: "42501" }); // row-level security violation
    await expect(
      scoped(
        db.sql,
        a,
        (tx) => tx`
        INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
        VALUES (${b}, 'fixture-path', 'forged', 999, 'challenge_solved', 'fx.L001', now(), 99)`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("cannot rewrite or delete XP, even its own", async () => {
    await expect(
      scoped(db.sql, b, (tx) => tx`UPDATE xp_ledger SET amount = 9999`),
    ).rejects.toMatchObject({
      code: "42501",
    });
    await expect(scoped(db.sql, b, (tx) => tx`DELETE FROM xp_ledger`)).rejects.toMatchObject({
      code: "42501",
    });
    // The maintained totals are read-only too; only the ledger trigger writes them.
    for (const write of [
      (tx: Tx) => tx`UPDATE player_path_xp SET xp = 9999`,
      (tx: Tx) => tx`DELETE FROM player_path_xp`,
      (tx: Tx) => tx`
        INSERT INTO player_path_xp (player_id, path_id, xp, reached_at)
        VALUES (${b}, 'forged-path', 9999, now())`,
    ])
      await expect(scoped(db.sql, b, write)).rejects.toMatchObject({ code: "42501" });
  });

  it("sees nothing at all without a verified player id", async () => {
    await db.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${APP_ROLE}`);
      for (const t of [...TABLES, "players"]) {
        const [row] = await tx.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
        expect(row!.n, t).toBe(0);
      }
    });
  });

  it("keeps service results per account", async () => {
    expect((await learning.getPath(a)).totalXp).toBe(0);
    expect((await learning.getPath(b)).totalXp).toBeGreaterThan(0);
    const view = await game.getView(a);
    expect(view.items).toEqual([]);
    expect(view.persistent).toBe(true);
    // Reusing another account's submission id is just a new submission for this account.
    const r = await game.submit(a, {
      submissionId: "bryn-0000",
      levelId: "fx.L001",
      challengeId: "fx.L001.c1",
      answer: { output: "5" },
    });
    expect(r.learning).toMatchObject({ status: "evaluated", correct: false, duplicate: false });
    expect((await learning.getPath(b)).levels.every((l) => l.status === "completed")).toBe(true);
  });

  it("exposes only handle, XP and rank across accounts on the leaderboard", async () => {
    const board = await game.leaderboard(a);
    expect(board.persistent).toBe(true);
    expect(board.entries).toEqual([
      { rank: 1, handle: "Bryn", xp: expect.any(Number), isViewer: false },
    ]);
    expect(board.viewer).toEqual({ ranked: false, reason: "no_xp" });
    expect(JSON.stringify(board)).not.toContain(b);
    // The function itself returns only these columns.
    const [fn] =
      await db.sql`SELECT pg_get_function_result('leaderboard_records(text)'::regprocedure) AS result`;
    expect(fn!.result).toBe(
      "TABLE(player_id uuid, handle text, xp integer, reached_at timestamp with time zone)",
    );
  });

  it("hides a player who opts out of the leaderboard", async () => {
    await new PostgresPlayerAccounts(db.sql).update(b, { visible: false });
    const board = await game.leaderboard(b);
    expect(board.entries).toEqual([]);
    expect(board.viewer).toEqual({ ranked: false, reason: "hidden" });
    await new PostgresPlayerAccounts(db.sql).update(b, { visible: true });
  });
});
