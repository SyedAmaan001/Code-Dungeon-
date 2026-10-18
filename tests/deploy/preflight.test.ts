import { describe, expect, it } from "vitest";
import { preparedStatementsEnabled } from "@/db/client";
import { checkProductionConfig, type Finding } from "@/deploy/preflight";

// Placeholder values shaped like the real thing; none of them is a credential.
const READY = {
  AUTH_MODE: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
  SUPABASE_SECRET_KEY: "sb_secret_placeholder",
  APP_URL: "https://staging.example.org",
  DATABASE_URL:
    "postgresql://app.example-ref:placeholder@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require",
  DATABASE_PREPARE: "false",
  DATABASE_POOL_MAX: "1",
  CONTENT_RELEASE: "public",
};

const errors = (f: Finding[]) => f.filter((x) => x.level === "error").map((x) => x.name);
const warnings = (f: Finding[]) => f.filter((x) => x.level === "warning").map((x) => x.name);

describe("production configuration preflight", () => {
  it("passes a complete Supabase configuration", () => {
    expect(checkProductionConfig(READY)).toEqual([]);
  });

  it("never prints a value, only variable names", () => {
    const leaky = {
      ...READY,
      DATABASE_URL: "postgresql://u:hunter2-secret@db.example.org:5432/postgres",
      SUPABASE_SECRET_KEY: "",
      DEV_AUTH_SECRET: "x".repeat(40),
      AUTH_MODE: "supabase",
    };
    const text = JSON.stringify(checkProductionConfig(leaky));
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("x".repeat(40));
    expect(text).not.toContain("sb_publishable_placeholder");
  });

  it("requires Supabase sign-in: development sign-in or nothing is an error", () => {
    expect(errors(checkProductionConfig({ ...READY, AUTH_MODE: "" }))).toContain("AUTH_MODE");
    expect(
      errors(
        checkProductionConfig({ ...READY, AUTH_MODE: "dev", DEV_AUTH_SECRET: "y".repeat(40) }),
      ),
    ).toContain("AUTH_MODE");
  });

  it("reuses the app's guards: https APP_URL and no secret behind NEXT_PUBLIC_", () => {
    expect(
      errors(checkProductionConfig({ ...READY, APP_URL: "http://staging.example.org" })),
    ).toContain("AUTH_MODE");
    expect(
      checkProductionConfig({ ...READY, NEXT_PUBLIC_SUPABASE_SECRET_KEY: "oops" })[0]!.message,
    ).toContain("NEXT_PUBLIC_SUPABASE_SECRET_KEY");
  });

  it("requires the server-only deletion key (DEC-015)", () => {
    expect(errors(checkProductionConfig({ ...READY, SUPABASE_SECRET_KEY: "" }))).toEqual([
      "SUPABASE_SECRET_KEY",
    ]);
    // The publishable key given as the secret key does not count.
    expect(
      errors(
        checkProductionConfig({
          ...READY,
          SUPABASE_SECRET_KEY: READY.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        }),
      ),
    ).toEqual(["SUPABASE_SECRET_KEY"]);
  });

  it("checks the database connection: present, TLS, and pooler settings", () => {
    expect(errors(checkProductionConfig({ ...READY, DATABASE_URL: "" }))).toEqual(["DATABASE_URL"]);
    expect(errors(checkProductionConfig({ ...READY, DATABASE_URL: "not a url" }))).toEqual([
      "DATABASE_URL",
    ]);
    expect(
      errors(
        checkProductionConfig({
          ...READY,
          DATABASE_URL: READY.DATABASE_URL.replace("?sslmode=require", ""),
        }),
      ),
    ).toEqual(["DATABASE_URL"]);
    expect(errors(checkProductionConfig({ ...READY, DATABASE_PREPARE: "" }))).toEqual([
      "DATABASE_PREPARE",
    ]);
    expect(warnings(checkProductionConfig({ ...READY, DATABASE_POOL_MAX: "" }))).toEqual([
      "DATABASE_POOL_MAX",
    ]);
    // A session-mode or direct connection keeps prepared statements.
    const session = READY.DATABASE_URL.replace(":6543/", ":5432/").replace(
      "aws-0-ap-south-1.pooler",
      "db.example-ref",
    );
    expect(
      checkProductionConfig({ ...READY, DATABASE_URL: session, DATABASE_PREPARE: "" }),
    ).toEqual([]);
  });

  it("warns that a development content release serves unreviewed levels, and rejects bad values", () => {
    expect(warnings(checkProductionConfig({ ...READY, CONTENT_RELEASE: "" }))).toEqual([
      "CONTENT_RELEASE",
    ]);
    expect(errors(checkProductionConfig({ ...READY, CONTENT_RELEASE: "beta" }))).toEqual([
      "CONTENT_RELEASE",
    ]);
  });

  it("warns about a leftover development secret", () => {
    expect(warnings(checkProductionConfig({ ...READY, DEV_AUTH_SECRET: "z".repeat(40) }))).toEqual([
      "DEV_AUTH_SECRET",
    ]);
  });
});

describe("DATABASE_PREPARE", () => {
  it("only an explicit false turns prepared statements off", () => {
    expect(preparedStatementsEnabled({})).toBe(true);
    expect(preparedStatementsEnabled({ DATABASE_PREPARE: "true" })).toBe(true);
    expect(preparedStatementsEnabled({ DATABASE_PREPARE: " FALSE " })).toBe(false);
  });
});
