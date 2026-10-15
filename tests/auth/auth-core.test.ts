import { describe, expect, it } from "vitest";
import { checkAge } from "@/auth/age";
import { readAdminConfig, readAuthConfig } from "@/auth/config";
import { normaliseDevName, signDevSession, verifyDevSession } from "@/auth/dev-session";
import { resolveDevIdentity, resolveSupabaseIdentity } from "@/auth/identity";
import { isProtectedPath, safeNext } from "@/auth/redirect";

const SECRET = "x".repeat(40);
const supabaseEnv = {
  AUTH_MODE: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  APP_URL: "https://codedungeon.example",
};

describe("auth configuration", () => {
  it("is disabled unless a mode is chosen", () => {
    expect(readAuthConfig({}).mode).toBe("disabled");
    expect(readAuthConfig({ AUTH_MODE: "magic" })).toMatchObject({ mode: "disabled" });
  });

  it("refuses the development sign-in in production builds", () => {
    expect(readAuthConfig({ AUTH_MODE: "dev", DEV_AUTH_SECRET: SECRET }).mode).toBe("dev");
    expect(
      readAuthConfig({ AUTH_MODE: "dev", DEV_AUTH_SECRET: SECRET, NODE_ENV: "production" }),
    ).toMatchObject({ mode: "disabled", reason: expect.stringContaining("production") });
  });

  it("needs a strong development secret", () => {
    expect(readAuthConfig({ AUTH_MODE: "dev", DEV_AUTH_SECRET: "short" }).mode).toBe("disabled");
  });

  it("needs the Supabase URL, publishable key and app URL, and rejects secret keys", () => {
    expect(readAuthConfig(supabaseEnv)).toEqual({
      mode: "supabase",
      supabaseUrl: "https://abc.supabase.co",
      publishableKey: "sb_publishable_test",
      appUrl: "https://codedungeon.example",
    });
    expect(readAuthConfig({ ...supabaseEnv, APP_URL: "" }).mode).toBe("disabled");
    expect(readAuthConfig({ ...supabaseEnv, NEXT_PUBLIC_SUPABASE_URL: "javascript:x" }).mode).toBe(
      "disabled",
    );
    expect(
      readAuthConfig({ ...supabaseEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
    ).toMatchObject({ mode: "disabled", reason: expect.stringContaining("secret key") });
    expect(
      readAuthConfig({ ...supabaseEnv, APP_URL: "http://insecure.example", NODE_ENV: "production" })
        .mode,
    ).toBe("disabled");
  });
});

describe("secret handling", () => {
  it("refuses to run when a secret is exposed through a NEXT_PUBLIC_ variable", () => {
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
      "NEXT_PUBLIC_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_DB_PASSWORD",
    ])
      expect(readAuthConfig({ ...supabaseEnv, [name]: "x" })).toMatchObject({
        mode: "disabled",
        reason: expect.stringContaining(name),
      });
  });

  it("allows plain http only for loopback hosts in production builds", () => {
    const prod = { ...supabaseEnv, NODE_ENV: "production" };
    expect(readAuthConfig({ ...prod, APP_URL: "http://localhost:3101" }).mode).toBe("supabase");
    expect(readAuthConfig({ ...prod, APP_URL: "http://127.0.0.1:3101" }).mode).toBe("supabase");
    expect(readAuthConfig({ ...prod, APP_URL: "http://game.example" }).mode).toBe("disabled");
  });

  it("reads the server-side admin key only in Supabase mode and never accepts a publishable key", () => {
    expect(readAdminConfig(supabaseEnv)).toBeNull();
    expect(readAdminConfig({ ...supabaseEnv, SUPABASE_SECRET_KEY: "sb_secret_abc" })).toEqual({
      url: "https://abc.supabase.co",
      secretKey: "sb_secret_abc",
    });
    expect(
      readAdminConfig({ ...supabaseEnv, SUPABASE_SECRET_KEY: "sb_publishable_test" }),
    ).toBeNull();
    expect(
      readAdminConfig({ AUTH_MODE: "dev", DEV_AUTH_SECRET: SECRET, SUPABASE_SECRET_KEY: "s" }),
    ).toBeNull();
  });
});

describe("development session tokens", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("round-trips a signed identity", () => {
    const token = signDevSession("alice", SECRET, now);
    expect(verifyDevSession(token, SECRET, now)).toBe("alice");
    expect(resolveDevIdentity(token, SECRET, now)).toEqual({
      status: "signed_in",
      identity: { provider: "dev", subject: "alice" },
    });
  });

  it("rejects forged, tampered, foreign-secret and expired tokens", () => {
    const token = signDevSession("alice", SECRET, now);
    const [v, payload, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "bob", iat: 0, exp: 4_000_000_000 }),
    ).toString("base64url");
    expect(verifyDevSession(`${v}.${forgedPayload}.${sig}`, SECRET, now)).toBeUndefined();
    expect(verifyDevSession(`${v}.${payload}.${sig}x`, SECRET, now)).toBeUndefined();
    expect(verifyDevSession(token, "y".repeat(40), now)).toBeUndefined();
    expect(verifyDevSession(token, SECRET, new Date("2026-10-23T12:00:00Z"))).toBeUndefined();
    expect(verifyDevSession(undefined, SECRET, now)).toBeUndefined();
    expect(verifyDevSession("garbage", SECRET, now)).toBeUndefined();
    expect(resolveDevIdentity("garbage", SECRET, now)).toEqual({ status: "signed_out" });
  });

  it("accepts only simple development names", () => {
    expect(normaliseDevName(" Alice ")).toBe("alice");
    expect(normaliseDevName("a")).toBeUndefined();
    expect(normaliseDevName("alice@example.com")).toBeUndefined();
    expect(() => signDevSession("../x", SECRET)).toThrow();
  });
});

describe("Supabase identity resolution", () => {
  const client = (result: unknown, throws = false) => ({
    auth: {
      getUser: async () => {
        if (throws) throw new Error("network down");
        return result as never;
      },
    },
  });

  it("accepts a verified user and uses the user id (never the email) as subject", async () => {
    const r = await resolveSupabaseIdentity(
      client({
        data: { user: { id: "uuid-1", email: "a@b.c", email_confirmed_at: "2026-10-15" } },
        error: null,
      }),
    );
    expect(r).toEqual({
      status: "signed_in",
      identity: { provider: "supabase", subject: "uuid-1" },
    });
  });

  it("rejects users without a confirmed email", async () => {
    expect(
      await resolveSupabaseIdentity(
        client({ data: { user: { id: "uuid-1", email_confirmed_at: null } }, error: null }),
      ),
    ).toEqual({ status: "email_unverified" });
  });

  it("fails closed on missing sessions, errors and network failures", async () => {
    expect(await resolveSupabaseIdentity(client({ data: { user: null }, error: null }))).toEqual({
      status: "signed_out",
    });
    expect(
      await resolveSupabaseIdentity(
        client({ data: { user: { id: "u", email_confirmed_at: "x" } }, error: new Error("jwt") }),
      ),
    ).toEqual({ status: "signed_out" });
    expect(await resolveSupabaseIdentity(client(null, true))).toEqual({ status: "signed_out" });
  });
});

describe("age check (13+, neutral screen)", () => {
  const today = new Date("2026-10-15T12:00:00Z");
  it("admits players who are certainly 13 or older", () => {
    expect(checkAge({ birthYear: "2013", birthMonth: "9" }, today)).toEqual({
      ok: true,
      eligible: true,
    });
    expect(checkAge({ birthYear: "1980", birthMonth: "12" }, today)).toMatchObject({
      eligible: true,
    });
  });

  it("refuses anyone who may still be 12, assuming the latest birthday in the month", () => {
    expect(checkAge({ birthYear: "2013", birthMonth: "10" }, today)).toEqual({
      ok: true,
      eligible: false,
    });
    expect(checkAge({ birthYear: "2013", birthMonth: "11" }, today)).toMatchObject({
      eligible: false,
    });
    expect(
      checkAge({ birthYear: "2013", birthMonth: "10" }, new Date("2026-10-31T12:00:00Z")),
    ).toMatchObject({ eligible: true });
  });

  it("rejects malformed answers without deciding", () => {
    expect(checkAge({ birthYear: "13", birthMonth: "1" }, today)).toMatchObject({ ok: false });
    expect(checkAge({ birthYear: "2030", birthMonth: "1" }, today)).toMatchObject({ ok: false });
    expect(checkAge({ birthYear: "2000", birthMonth: "13" }, today)).toMatchObject({ ok: false });
    expect(checkAge({ birthYear: null, birthMonth: null }, today)).toMatchObject({ ok: false });
  });
});

describe("redirect safety", () => {
  it("keeps only same-site paths", () => {
    expect(safeNext("/play/level/py.L002")).toBe("/play/level/py.L002");
    expect(safeNext("/play?x=1")).toBe("/play?x=1");
    for (const bad of [
      "https://evil.example",
      "//evil.example/x",
      "/\\evil.example",
      "javascript:alert(1)",
      "play",
      "/play\r\nSet-Cookie: x=1",
      "",
      null,
    ])
      expect(safeNext(bad)).toBe("/play");
    // Encoded characters stay encoded inside the path; they cannot change the host.
    expect(safeNext("/%0d%0aSet-Cookie:x")).toBe("/%0d%0aSet-Cookie:x");
  });

  it("protects the game and onboarding routes only", () => {
    expect(isProtectedPath("/play")).toBe(true);
    expect(isProtectedPath("/play/map")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/playground")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
  });
});
