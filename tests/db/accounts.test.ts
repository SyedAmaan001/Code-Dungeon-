import { afterAll, beforeAll, expect, it } from "vitest";
import { GameService } from "@/services/game-service";
import { LearningService } from "@/services/learning-service";
import { PostgresPlayerAccounts, PostgresPlayerStore } from "@/services/postgres-player-store";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

describeDb("player accounts", () => {
  let db: TestDatabase;
  let accounts: PostgresPlayerAccounts;
  beforeAll(async () => {
    db = await createTestDatabase();
    accounts = new PostgresPlayerAccounts(db.sql);
  });
  afterAll(() => db.drop());

  it("creates, reads and updates a profile", async () => {
    const r = await accounts.create({ handle: "  Ari_the-Brave " });
    expect(r).toMatchObject({ ok: true, profile: { handle: "Ari_the-Brave", visible: true } });
    if (!r.ok) return;
    expect(await accounts.get(r.profile.playerId)).toEqual(r.profile);
    expect(await accounts.update(r.profile.playerId, { handle: "AriB", visible: false })).toEqual({
      ok: true,
      profile: { playerId: r.profile.playerId, handle: "AriB", visible: false },
    });
  });

  it("applies the handle rules and keeps handles unique regardless of case", async () => {
    expect(await accounts.create({ handle: "Unique1" })).toMatchObject({ ok: true });
    expect(await accounts.create({ handle: "UNIQUE1" })).toEqual({
      ok: false,
      reason: "that name is already taken",
    });
    expect(await accounts.create({ handle: "Admin" })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("reserved"),
    });
    expect(await accounts.create({ handle: "x" })).toMatchObject({ ok: false });
    expect(await accounts.create({ handle: "a@b.com" })).toMatchObject({ ok: false });
    const other = await accounts.create({ handle: "Other1" });
    if (!other.ok) throw new Error();
    expect(await accounts.update(other.profile.playerId, { handle: "unique1" })).toEqual({
      ok: false,
      reason: "that name is already taken",
    });
  });

  it("enforces the handle format in the database too", async () => {
    await expect(db.sql`INSERT INTO players (handle) VALUES ('1bad name')`).rejects.toMatchObject({
      code: "23514",
    });
  });

  const ageCheck = { policy: "13plus-v1", at: new Date("2026-10-15T09:00:00Z") };

  it("links a provider identity once and resolves it to the player", async () => {
    const r = await accounts.create({
      handle: "Linked",
      identity: { provider: "example-idp", subject: "sub-123" },
      ageCheck,
    });
    if (!r.ok) throw new Error(r.reason);
    expect(await accounts.playerIdForIdentity("example-idp", "sub-123")).toBe(r.profile.playerId);
    expect(await accounts.playerIdForIdentity("example-idp", "sub-999")).toBeUndefined();
    expect(
      await accounts.create({
        handle: "Linked2",
        identity: { provider: "example-idp", subject: "sub-123" },
        ageCheck,
      }),
    ).toEqual({
      ok: false,
      reason: "that sign-in is already linked to a player",
    });
  });

  it("requires the age check for identity-linked players, in code and in the database", async () => {
    expect(
      await accounts.create({
        handle: "NoAgeCheck",
        identity: { provider: "example-idp", subject: "sub-noage" },
      }),
    ).toEqual({ ok: false, reason: "the age check must be completed first" });
    await expect(
      db.sql`INSERT INTO players (handle, auth_provider, auth_subject)
             VALUES ('NoAgeCheck', 'example-idp', 'sub-noage')`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.sql`INSERT INTO players (handle, age_check_policy) VALUES ('HalfCheck', '13plus-v1')`,
    ).rejects.toMatchObject({ code: "23514" });
    const [row] = await db.sql`
      SELECT age_check_policy, age_checked_at FROM players WHERE handle = 'Linked'`;
    expect(row).toEqual({ age_check_policy: "13plus-v1", age_checked_at: ageCheck.at });
    // No birth date is stored anywhere.
    const columns = await db.sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'players'`;
    expect(columns.map((c) => c.column_name).filter((c) => /birth|dob|email/.test(c))).toEqual([]);
  });

  it("deletes a player and all of their data", async () => {
    const r = await accounts.create({ handle: "Leaving" });
    if (!r.ok) throw new Error();
    const id = r.profile.playerId;
    const pack = loadOrThrow(VALID_SMALL);
    const store = new PostgresPlayerStore(db.sql);
    const learning = new LearningService({ pack, store: store.progressStore });
    const game = new GameService({ pack, learning, store: store.gameStore, transactional: store });
    await game.submit(id, {
      submissionId: "leave-000001",
      levelId: "fx.L001",
      challengeId: "fx.L001.c1",
      answer: { output: "23" },
    });
    expect(await accounts.delete(id)).toBe(true);
    for (const t of ["players", "player_paths", "challenge_progress", "xp_ledger", "submissions"]) {
      const col = t === "players" ? "id" : "player_id";
      const [row] = await db.sql.unsafe(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = $1`, [
        id,
      ]);
      expect(row!.n, t).toBe(0);
    }
    expect(await accounts.get(id)).toBeUndefined();
  });
});
