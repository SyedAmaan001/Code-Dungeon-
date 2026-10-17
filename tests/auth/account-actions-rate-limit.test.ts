/**
 * Rate limits on account writes (profile update, onboarding, deletion): the bucket comes from
 * the verified session, a refused or unverifiable request changes nothing, and one account's
 * budget never affects another's. The PostgreSQL limiter itself is covered in
 * tests/db/account-rate-limit.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityResult } from "@/auth/identity";
import type { AccountProfile } from "@/services/postgres-player-store";
import { identityBucket, playerBucket } from "@/services/postgres-rate-limit";
import { RateLimiter, type ActionLimiter } from "@/services/rate-limit";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
const session: {
  player: AccountProfile | null;
  identity: IdentityResult & { config: { mode: string } };
} = { player: null, identity: { status: "signed_out", config: { mode: "dev" } } };
vi.mock("@/auth/server", () => ({
  playerForAction: async () => session.player,
  getIdentity: async () => session.identity,
  supabaseServerClient: async () => ({ auth: { signOut: async () => ({ error: null }) } }),
}));
vi.mock("@/auth/supabase-admin", () => ({ deleteSupabaseUser: vi.fn() }));
vi.mock("server-only", () => ({}));

const accounts = {
  update: vi.fn(async () => ({ ok: true as const, profile: session.player! })),
  create: vi.fn(async () => ({ ok: true as const, profile: session.player! })),
  playerIdForIdentity: vi.fn(async (): Promise<string | undefined> => undefined),
  deleteAccount: vi.fn(async () => true),
};
let accountLimiter: ActionLimiter;
vi.mock("@/services/runtime", () => ({ getRuntime: () => ({ accounts, accountLimiter }) }));

const { completeOnboarding, deleteAccount, updateProfile } = await import("@/app/actions/account");

const ANA: AccountProfile = {
  playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  handle: "Ana",
  visible: true,
};
const BEA: AccountProfile = {
  playerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  handle: "Bea",
  visible: true,
};
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const idle = { status: "idle" } as const;
const signedIn = (player: AccountProfile) => {
  session.player = player;
  session.identity = {
    status: "signed_in",
    identity: { provider: "dev", subject: player.handle.toLowerCase() },
    config: { mode: "dev" },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  session.player = null;
  session.identity = { status: "signed_out", config: { mode: "dev" } };
  accountLimiter = new RateLimiter(2, 60_000);
});

describe("account write rate limits", () => {
  it("charge the session player's bucket, never one named in the form", async () => {
    signedIn(ANA);
    const allow = vi.fn(async () => true);
    accountLimiter = { allow };
    await updateProfile(idle, form({ handle: "Ana", playerId: BEA.playerId }));
    expect(allow).toHaveBeenCalledWith(playerBucket(ANA.playerId, "profile"));
    expect(accounts.update).toHaveBeenCalledWith(ANA.playerId, expect.anything());
  });

  it("refuse repeated profile updates once the budget is spent, changing nothing", async () => {
    signedIn(ANA);
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await updateProfile(idle, form({ handle: "Ana" })));
    expect(results.slice(0, 2)).toEqual([{ status: "saved" }, { status: "saved" }]);
    expect(results[2]).toMatchObject({ status: "error", message: /Too many attempts/ });
    expect(accounts.update).toHaveBeenCalledTimes(2);
  });

  it("keep each account's budget separate (cross-account)", async () => {
    signedIn(ANA);
    for (let i = 0; i < 3; i++) await updateProfile(idle, form({ handle: "Ana" }));
    signedIn(BEA);
    expect(await updateProfile(idle, form({ handle: "Bea" }))).toEqual({ status: "saved" });
  });

  it("count concurrent requests against one budget", async () => {
    signedIn(ANA);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => updateProfile(idle, form({ handle: "Ana" }))),
    );
    expect(results.filter((r) => r.status === "saved")).toHaveLength(2);
    expect(accounts.update).toHaveBeenCalledTimes(2);
  });

  it("fail closed when the limit cannot be checked (database failure)", async () => {
    signedIn(ANA);
    accountLimiter = {
      allow: async () => {
        throw new Error("connection refused");
      },
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await updateProfile(idle, form({ handle: "Ana" }))).toMatchObject({
      status: "error",
      message: /could not be done just now/,
    });
    expect(
      await deleteAccount(idle, form({ confirmHandle: "Ana", acknowledge: "on" })),
    ).toMatchObject({ status: "error" });
    expect(accounts.update).not.toHaveBeenCalled();
    expect(accounts.deleteAccount).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("send signed-out callers to sign-in without charging any budget", async () => {
    const allow = vi.fn(async () => true);
    accountLimiter = { allow };
    await expect(updateProfile(idle, form({ handle: "Ana" }))).rejects.toThrow("REDIRECT /sign-in");
    await expect(
      deleteAccount(idle, form({ confirmHandle: "Ana", acknowledge: "on" })),
    ).rejects.toThrow("REDIRECT /sign-in");
    await expect(completeOnboarding(idle, form({ handle: "Ana" }))).rejects.toThrow(
      "REDIRECT /sign-in",
    );
    expect(allow).not.toHaveBeenCalled();
  });

  it("limit onboarding per verified identity before a player exists", async () => {
    session.identity = {
      status: "signed_in",
      identity: { provider: "dev", subject: "newcomer" },
      config: { mode: "dev" },
    };
    const allow = vi.fn(async () => false);
    accountLimiter = { allow };
    const body = form({ handle: "Newcomer", birthYear: "2000", birthMonth: "6" });
    expect(await completeOnboarding(idle, body)).toMatchObject({
      status: "error",
      message: /Too many attempts/,
    });
    expect(allow).toHaveBeenCalledWith(identityBucket("dev", "newcomer", "onboarding"));
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it("keep deletion usable: typos are retried within the budget, then the deletion runs", async () => {
    signedIn(ANA);
    accountLimiter = new RateLimiter(10, 60_000);
    for (let i = 0; i < 3; i++)
      expect(
        await deleteAccount(idle, form({ confirmHandle: "Anna", acknowledge: "on" })),
      ).toMatchObject({ status: "error", message: /Type your handle/ });
    await expect(
      deleteAccount(idle, form({ confirmHandle: "Ana", acknowledge: "on" })),
    ).rejects.toThrow("REDIRECT /account-deleted");
    expect(accounts.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("refuse deletion once the budget is spent, deleting nothing", async () => {
    signedIn(ANA);
    for (let i = 0; i < 2; i++)
      await deleteAccount(idle, form({ confirmHandle: "wrong", acknowledge: "on" }));
    expect(
      await deleteAccount(idle, form({ confirmHandle: "Ana", acknowledge: "on" })),
    ).toMatchObject({ status: "error", message: /Too many attempts/ });
    expect(accounts.deleteAccount).not.toHaveBeenCalled();
  });
});
