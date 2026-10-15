/**
 * Account deletion (R-46): game data and the sign-in identity go together or not at all,
 * only the signed-in player can delete, only their own account, after explicit confirmation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityResult } from "@/auth/identity";
import { GameService } from "@/services/game-service";
import { LearningService } from "@/services/learning-service";
import {
  PostgresPlayerAccounts,
  PostgresPlayerStore,
  type AccountProfile,
} from "@/services/postgres-player-store";
import { PostgresRateLimiter } from "@/services/postgres-rate-limit";
import { createTestDatabase, describeDb, type TestDatabase } from "../support/db";
import { loadOrThrow, VALID_SMALL } from "../support/packs";

// ---- module mocks for the server action (Next.js request APIs and the session) ----
const cookieJar = { delete: vi.fn(), get: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
const session: {
  player: AccountProfile | null;
  identity: IdentityResult & { config: { mode: string } };
} = { player: null, identity: { status: "signed_out", config: { mode: "disabled" } } };
const signOut = vi.fn(async () => ({ error: null }));
vi.mock("@/auth/server", () => ({
  playerForAction: async () => session.player,
  getIdentity: async () => session.identity,
  supabaseServerClient: async () => ({ auth: { signOut } }),
}));
const deleteSupabaseUser = vi.fn(async (...args: [unknown, string]) => void args);
vi.mock("@/auth/supabase-admin", () => ({
  deleteSupabaseUser: (cfg: unknown, id: string) => deleteSupabaseUser(cfg, id),
}));
let accounts: PostgresPlayerAccounts;
vi.mock("@/services/runtime", () => ({ getRuntime: () => ({ accounts }) }));

const { deleteAccount } = await import("@/app/actions/account");

const PLAYER_TABLES = [
  "player_paths",
  "level_progress",
  "challenge_progress",
  "xp_ledger",
  "submissions",
  "encounters",
  "checkpoints",
  "quest_progress",
  "player_achievements",
  "reward_items",
  "action_rate_limits",
];

describeDb("account deletion", () => {
  let db: TestDatabase;
  let game: GameService;
  const ageCheck = { policy: "13plus-v1", at: new Date("2026-10-15T09:00:00Z") };

  async function countRows(playerId: string) {
    const counts: Record<string, number> = {};
    for (const t of [...PLAYER_TABLES, "players"]) {
      const [row] = await db.sql.unsafe(
        `SELECT count(*)::int AS n FROM ${t} WHERE ${t === "players" ? "id" : "player_id"} = $1`,
        [playerId],
      );
      counts[t] = row!.n as number;
    }
    return counts;
  }

  /** A player with data in every table. */
  async function makePlayer(handle: string, identity: { provider: string; subject: string }) {
    const r = await accounts.create({ handle, visible: true, identity, ageCheck });
    if (!r.ok) throw new Error(r.reason);
    const id = r.profile.playerId;
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
      await game.submit(id, {
        submissionId: `${handle}-${n++}-xxxx`,
        levelId,
        challengeId,
        answer,
      });
    await new PostgresRateLimiter(db.sql, 40).allow(id);
    return r.profile;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    accounts = new PostgresPlayerAccounts(db.sql);
    const pack = loadOrThrow(VALID_SMALL);
    pack.meta.quests.forEach((q) => (q.status = "published"));
    pack.meta.achievements.forEach((x) => (x.status = "published"));
    const store = new PostgresPlayerStore(db.sql);
    const learning = new LearningService({ pack, store: store.progressStore });
    game = new GameService({ pack, learning, store: store.gameStore, transactional: store });
  });
  afterAll(() => db.drop());

  describe("store", () => {
    it("deletes every row of the player in one transaction and leaves others intact", async () => {
      const gone = await makePlayer("Gone", { provider: "dev", subject: "gone" });
      const stays = await makePlayer("Stays", { provider: "dev", subject: "stays" });
      let seen: unknown;
      expect(
        await accounts.deleteAccount(gone.playerId, async (identity) => {
          seen = identity;
        }),
      ).toBe(true);
      expect(seen).toEqual({ provider: "dev", subject: "gone" });
      expect(Object.values(await countRows(gone.playerId)).every((n) => n === 0)).toBe(true);
      const kept = await countRows(stays.playerId);
      expect(Object.entries(kept).filter(([, n]) => n === 0)).toEqual([]);
      expect(await accounts.playerIdForIdentity("dev", "gone")).toBeUndefined();
    });

    it("rolls back everything when the identity step fails", async () => {
      const p = await makePlayer("Kept", { provider: "dev", subject: "kept" });
      const before = await countRows(p.playerId);
      await expect(
        accounts.deleteAccount(p.playerId, async () => {
          throw new Error("provider down");
        }),
      ).rejects.toThrow("provider down");
      expect(await countRows(p.playerId)).toEqual(before);
    });

    it("reports false for an unknown player", async () => {
      expect(await accounts.deleteAccount("00000000-0000-4000-8000-000000000000")).toBe(false);
    });
  });

  describe("server action", () => {
    const form = (fields: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.set(k, v);
      return f;
    };
    const idle = { status: "idle" } as const;
    const supabaseEnv = {
      AUTH_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      APP_URL: "https://codedungeon.example",
    };
    const saved = { ...process.env };

    beforeEach(() => {
      process.env = { ...saved };
      session.player = null;
      session.identity = { status: "signed_out", config: { mode: "disabled" } };
      deleteSupabaseUser.mockReset();
      deleteSupabaseUser.mockImplementation(async () => {});
      cookieJar.delete.mockReset();
      signOut.mockClear();
    });
    afterAll(() => {
      process.env = saved;
    });

    async function signInAs(profile: AccountProfile, provider: string, subject: string) {
      session.player = profile;
      session.identity = {
        status: "signed_in",
        identity: { provider, subject },
        config: { mode: provider === "supabase" ? "supabase" : "dev" },
      };
    }

    it("refuses signed-out callers", async () => {
      await expect(deleteAccount(idle, form({}))).rejects.toThrow("REDIRECT /sign-in");
    });

    it("requires the exact handle and the acknowledgement", async () => {
      const p = await makePlayer("Careful", { provider: "dev", subject: "careful" });
      await signInAs(p, "dev", "careful");
      expect(
        await deleteAccount(idle, form({ confirmHandle: "careful", acknowledge: "on" })),
      ).toMatchObject({ status: "error", message: expect.stringContaining("exactly") });
      expect(await deleteAccount(idle, form({ confirmHandle: "Careful" }))).toMatchObject({
        status: "error",
        message: expect.stringContaining("permanent"),
      });
      expect((await countRows(p.playerId)).players).toBe(1);
    });

    it("refuses a Supabase account when no server-side deletion key is configured", async () => {
      Object.assign(process.env, supabaseEnv);
      const p = await makePlayer("NoKey", { provider: "supabase", subject: "uuid-nokey" });
      await signInAs(p, "supabase", "uuid-nokey");
      expect(
        await deleteAccount(idle, form({ confirmHandle: "NoKey", acknowledge: "on" })),
      ).toMatchObject({ status: "error", message: expect.stringContaining("Nothing was deleted") });
      expect(deleteSupabaseUser).not.toHaveBeenCalled();
      expect((await countRows(p.playerId)).xp_ledger).toBeGreaterThan(0);
    });

    it("keeps all game data when Supabase refuses to delete the user", async () => {
      Object.assign(process.env, supabaseEnv, { SUPABASE_SECRET_KEY: "sb_secret_test" });
      const p = await makePlayer("Refused", { provider: "supabase", subject: "uuid-refused" });
      const before = await countRows(p.playerId);
      await signInAs(p, "supabase", "uuid-refused");
      deleteSupabaseUser.mockRejectedValueOnce(new Error("503"));
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(
        await deleteAccount(idle, form({ confirmHandle: "Refused", acknowledge: "on" })),
      ).toMatchObject({ status: "error", message: expect.stringContaining("Nothing was deleted") });
      quiet.mockRestore();
      expect(await countRows(p.playerId)).toEqual(before);
    });

    it("deletes game data and the Supabase user together, then signs out", async () => {
      Object.assign(process.env, supabaseEnv, { SUPABASE_SECRET_KEY: "sb_secret_test" });
      const p = await makePlayer("Leaver", { provider: "supabase", subject: "uuid-leaver" });
      await signInAs(p, "supabase", "uuid-leaver");
      await expect(
        deleteAccount(idle, form({ confirmHandle: "Leaver", acknowledge: "on" })),
      ).rejects.toThrow("REDIRECT /account-deleted");
      expect(deleteSupabaseUser).toHaveBeenCalledWith(
        { url: "https://project.supabase.co", secretKey: "sb_secret_test" },
        "uuid-leaver",
      );
      expect(Object.values(await countRows(p.playerId)).every((n) => n === 0)).toBe(true);
      expect(signOut).toHaveBeenCalled();
    });

    it("deletes a development account and clears its cookie", async () => {
      const p = await makePlayer("DevLeaver", { provider: "dev", subject: "devleaver" });
      await signInAs(p, "dev", "devleaver");
      await expect(
        deleteAccount(idle, form({ confirmHandle: "DevLeaver", acknowledge: "on" })),
      ).rejects.toThrow("REDIRECT /account-deleted");
      expect(cookieJar.delete).toHaveBeenCalledWith("cd_dev_session");
      expect((await countRows(p.playerId)).players).toBe(0);
    });

    it("never deletes an account linked to a different identity than the session's", async () => {
      const victim = await makePlayer("Victim", { provider: "dev", subject: "victim" });
      // A session whose identity does not match the player's linked identity.
      await signInAs(victim, "dev", "intruder");
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(
        await deleteAccount(idle, form({ confirmHandle: "Victim", acknowledge: "on" })),
      ).toMatchObject({ status: "error" });
      quiet.mockRestore();
      expect((await countRows(victim.playerId)).players).toBe(1);
    });
  });
});
