import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createSql } from "@/db/client";
import type { ContentPack } from "@/learning/schema";
import { GameService } from "@/services/game-service";
import { InMemoryGameStateStore } from "@/services/game-store";
import { LearningService } from "@/services/learning-service";
import {
  PostgresLeaderboardSource,
  PostgresPlayerAccounts,
  PostgresPlayerStore,
  UnknownPlayerError,
} from "@/services/postgres-player-store";
import { InMemoryProgressStore } from "@/services/progress-store";
import { correctSubmission, wrongSubmission } from "../support/answers";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";
import { CONTENT_ROOT, loadOrThrow } from "../support/packs";

const python = loadOrThrow(join(CONTENT_ROOT, "python-fundamentals"));

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 15, 9, 0, 0, tick++));
}

function postgresServices(db: TestDatabase, pack: ContentPack, now = clock(), sql = db.sql) {
  const store = new PostgresPlayerStore(sql);
  const learning = new LearningService({ pack, store: store.progressStore, now });
  const game = new GameService({
    pack,
    learning,
    store: store.gameStore,
    transactional: store,
    leaderboardSource: new PostgresLeaderboardSource(sql),
    now,
  });
  return { store, learning, game };
}

function memoryServices(pack: ContentPack, now = clock()) {
  const learning = new LearningService({ pack, store: new InMemoryProgressStore(), now });
  const game = new GameService({ pack, learning, store: new InMemoryGameStateStore(), now });
  return { learning, game };
}

async function playAll(game: GameService, playerId: string, prefix: string) {
  let n = 0;
  for (const level of python.levels)
    for (const c of level.challenges)
      await game.submit(playerId, {
        submissionId: `${prefix}-${String(n++).padStart(4, "0")}`,
        levelId: level.id,
        challengeId: c.id,
        answer: correctSubmission(c),
      });
}

describeDb("PostgreSQL persistence", () => {
  let db: TestDatabase;
  let accounts: PostgresPlayerAccounts;
  const player = async (handle: string) => {
    const r = await accounts.create({ handle });
    if (!r.ok) throw new Error(r.reason);
    return r.profile.playerId;
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    accounts = new PostgresPlayerAccounts(db.sql);
  });
  afterAll(() => db.drop());

  it("saves a full 25-level playthrough and reloads it identically after a restart", async () => {
    const id = await player("Persistent");
    const pg = postgresServices(db, python);
    await playAll(pg.game, id, "run");

    const mem = memoryServices(python);
    await playAll(mem.game, "memory-player", "run");
    const expectedView = await mem.game.getView("memory-player");
    const expectedPath = await mem.learning.getPath("memory-player");

    // "Restart": a brand-new connection pool and fresh service instances.
    const sql = createSql({ url: db.url, max: 2 });
    try {
      const fresh = postgresServices(db, python, clock(), sql);
      const view = await fresh.game.getView(id);
      expect(view).toEqual({ ...expectedView, persistent: true });
      expect(await fresh.learning.getPath(id)).toEqual({
        ...expectedPath,
        progressIsDurable: true,
      });
      expect(view.totalXp).toBe(2455);
      expect(view.quests.every((q) => q.state === "completed")).toBe(true);
      expect(view.achievements.every((a) => a.unlocked)).toBe(true);
      // The raw progress (attempt counts, mastery flags, ledger order and timestamps) round-trips exactly.
      expect(await fresh.learning.progressSnapshot(id)).toEqual(
        await mem.learning.progressSnapshot("memory-player"),
      );
    } finally {
      await sql.end();
    }
  }, 60_000);

  it("returns the original result for a resent submission id, even after a restart", async () => {
    const id = await player("Resender");
    const pg = postgresServices(db, python);
    const body = {
      submissionId: "resend-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "Torch lit\nDoor open" },
    };
    const first = await pg.game.submit(id, body);
    const sql = createSql({ url: db.url, max: 2 });
    try {
      const again = await postgresServices(db, python, clock(), sql).game.submit(id, body);
      expect(again.learning).toEqual({ ...first.learning, duplicate: true });
      expect(again.game).toEqual({ ...first.game, duplicate: true });
    } finally {
      await sql.end();
    }
    const [row] =
      await db.sql`SELECT attempts FROM challenge_progress WHERE player_id = ${id} AND challenge_id = 'py.L001.c1'`;
    expect(row!.attempts).toBe(1);
  });

  it("processes concurrent copies of one submission exactly once", async () => {
    const id = await player("Racer");
    const pg = postgresServices(db, python);
    const body = {
      submissionId: "race-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "Torch lit\nDoor open" },
    };
    const results = await Promise.all(Array.from({ length: 6 }, () => pg.game.submit(id, body)));
    const fresh = results.filter((r) => r.learning.status === "evaluated" && !r.learning.duplicate);
    expect(fresh).toHaveLength(1);
    expect(
      results.filter((r) => r.learning.status === "evaluated" && r.learning.duplicate),
    ).toHaveLength(5);
    const ledger =
      await db.sql`SELECT source_key FROM xp_ledger WHERE player_id = ${id} ORDER BY position`;
    expect(ledger.map((r) => r.source_key)).toEqual([
      "challenge:py.L001.c1",
      "challenge-first-try:py.L001.c1",
    ]);
  });

  it("serialises concurrent different submissions without losing updates", async () => {
    const id = await player("Busy");
    const pg = postgresServices(db, python);
    const c = python.levels[0]!.challenges[0]!;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        pg.game.submit(id, {
          submissionId: `busy-${String(i).padStart(6, "0")}`,
          levelId: "py.L001",
          challengeId: c.id,
          answer: wrongSubmission(c),
        }),
      ),
    );
    const [row] =
      await db.sql`SELECT attempts FROM challenge_progress WHERE player_id = ${id} AND challenge_id = ${c.id}`;
    expect(row!.attempts).toBe(8);
    const [count] =
      await db.sql`SELECT count(*)::int AS n FROM submissions WHERE player_id = ${id}`;
    expect(count!.n).toBe(8);
  });

  it("rolls back learning progress when the game step fails in the same transaction", async () => {
    const id = await player("Rollback");
    const pg = postgresServices(db, python);
    const body = {
      submissionId: "boom-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "Torch lit\nDoor open" },
    };
    await expect(
      pg.store.transaction(
        id,
        "python-fundamentals",
        { submissionId: body.submissionId },
        (records) => {
          const plan = pg.learning.planSubmit(records.progress, body);
          expect(plan.result.status).toBe("evaluated"); // learning succeeded…
          throw new Error("game engine failed"); // …but the game step failed
        },
      ),
    ).rejects.toThrow("game engine failed");
    for (const t of [
      "level_progress",
      "challenge_progress",
      "xp_ledger",
      "submissions",
      "encounters",
      "quest_progress",
    ]) {
      const [row] = await db.sql.unsafe(
        `SELECT count(*)::int AS n FROM ${t} WHERE player_id = $1`,
        [id],
      );
      expect(row!.n, t).toBe(0);
    }
    // The same submission then succeeds normally: nothing was half-saved.
    const ok = await pg.game.submit(id, body);
    expect(ok.learning).toMatchObject({
      status: "evaluated",
      correct: true,
      duplicate: false,
      xpAwarded: 15,
    });
  });

  it("rolls back everything when any write violates a database rule", async () => {
    const id = await player("Constraint");
    const pg = postgresServices(db, python);
    await expect(
      pg.store.transaction(id, "python-fundamentals", {}, (records) => {
        const progress = structuredClone(records.progress);
        progress.progress.levels["py.L001"] = {
          challenges: {},
          completedAt: "2026-10-15T00:00:00.000Z",
        };
        progress.progress.xp.push({
          sourceKey: "bad",
          amount: 0,
          reason: "challenge_solved",
          levelId: "py.L001",
          at: "2026-10-15T00:00:00.000Z",
        });
        return { value: null, progress };
      }),
    ).rejects.toMatchObject({ code: "23514" }); // check constraint: amount > 0
    const [row] =
      await db.sql`SELECT count(*)::int AS n FROM level_progress WHERE player_id = ${id}`;
    expect(row!.n).toBe(0);
  });

  it("enforces award-once in the database itself", async () => {
    const id = await player("Ledger");
    await postgresServices(db, python).game.submit(id, {
      submissionId: "ledger-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "Torch lit\nDoor open" },
    });
    await expect(db.sql`
      INSERT INTO xp_ledger (player_id, path_id, source_key, amount, reason, level_id, awarded_at, position)
      VALUES (${id}, 'python-fundamentals', 'challenge:py.L001.c1', 10, 'challenge_solved', 'py.L001', now(), 50)`).rejects.toMatchObject(
      {
        code: "23505",
      },
    );
  });

  it("keeps working through the non-transactional store path", async () => {
    const id = await player("Direct");
    const { learning } = postgresServices(db, python);
    const body = {
      submissionId: "direct-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "x" },
    };
    expect(await learning.submit(id, body)).toMatchObject({
      status: "evaluated",
      correct: false,
      duplicate: false,
    });
    expect(await learning.submit(id, body)).toMatchObject({ status: "evaluated", duplicate: true });
    expect(
      await learning.requestHint(id, { levelId: "py.L001", challengeId: "py.L001.c1" }),
    ).toMatchObject({ status: "ok", tier: 1 });
    const level = await learning.getLevel(id, "py.L001");
    expect(level.status === "ok" && level.challenges["py.L001.c1"]).toMatchObject({
      attempts: 1,
      hints: [expect.any(String)],
    });
  });

  it("saves hints and encounter runs in the same transaction", async () => {
    const pg = postgresServices(db, python);
    const id2 = await player("Hinter");
    for (const level of python.levels.slice(0, 4))
      for (const c of level.challenges)
        await pg.game.submit(id2, {
          submissionId: `h2-${c.id.replace(/\./g, "-")}`,
          levelId: level.id,
          challengeId: c.id,
          answer: correctSubmission(c),
        });
    const hint = await pg.game.requestHint(id2, {
      levelId: "py.L005",
      challengeId: python.levels[4]!.challenges[0]!.id,
    });
    expect(hint.learning).toMatchObject({ status: "ok", tier: 1 });
    expect(hint.game.events).toEqual([
      expect.objectContaining({ type: "encounter_started", levelId: "py.L005" }),
    ]);
    const [enc] =
      await db.sql`SELECT status, current_run FROM encounters WHERE player_id = ${id2} AND level_id = 'py.L005'`;
    expect(enc).toMatchObject({
      status: "active",
      current_run: expect.objectContaining({ hints: 1 }),
    });
  }, 60_000);

  it("refuses unknown or malformed player ids", async () => {
    const pg = postgresServices(db, python);
    const body = {
      submissionId: "ghost-000001",
      levelId: "py.L001",
      challengeId: "py.L001.c1",
      answer: { output: "x" },
    };
    await expect(
      pg.game.submit("00000000-0000-4000-8000-000000000000", body),
    ).rejects.toBeInstanceOf(UnknownPlayerError);
    await expect(pg.game.submit("not-a-uuid", body)).rejects.toThrow(/must be a UUID/);
    await expect(pg.game.submit("", body)).rejects.toThrow(/verified session/);
  });
});
