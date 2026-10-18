import { describe, expect, it } from "vitest";
import { findForbidden, runSmoke, sameOriginScripts } from "@/deploy/smoke";

let counter = 0;
const goodHeaders = () => {
  const nonce = `bm9uY2Ut${counter++}==`;
  return {
    nonce,
    headers: {
      "content-security-policy": `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "strict-transport-security": "max-age=31536000",
    },
  };
};

/** A fake deployment; `broken` switches one behaviour off to prove the check catches it. */
function deployment(broken?: "nonce" | "redirect" | "leak" | "callback") {
  const seen: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    seen.push(`${init?.method ?? "GET"} ${url}`);
    const { pathname } = new URL(url);
    if (pathname === "/" || pathname === "/sign-in") {
      const { nonce, headers } = goodHeaders();
      const scriptNonce = broken === "nonce" ? "other" : nonce;
      return new Response(
        `<html><script nonce="${scriptNonce}" src="/_next/static/chunks/app.js"></script><script src="https://cdn.example.net/x.js"></script></html>`,
        { status: 200, headers },
      );
    }
    if (pathname === "/play")
      return new Response(null, {
        status: broken === "redirect" ? 200 : 307,
        headers: { location: "/sign-in?next=%2Fplay" },
      });
    if (pathname === "/auth/callback")
      return new Response(null, {
        status: 307,
        headers: {
          location:
            broken === "callback" ? "/play" : "https://staging.example.org/sign-in?error=link",
        },
      });
    if (pathname === "/_next/static/chunks/app.js")
      return new Response(broken === "leak" ? 'const k="sb_secret_abc"' : "console.log(1)");
    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, seen };
}

const failures = (r: { name: string; ok: boolean }[]) => r.filter((x) => !x.ok).map((x) => x.name);

describe("deployment smoke test", () => {
  it("passes a correct deployment using only GET requests and no credentials", async () => {
    const { fetchImpl, seen } = deployment();
    const results = await runSmoke("https://staging.example.org", fetchImpl);
    expect(failures(results)).toEqual([]);
    expect(seen.every((s) => s.startsWith("GET "))).toBe(true);
    // Third-party scripts are not fetched; the same-origin chunk is scanned.
    expect(seen).toContain("GET https://staging.example.org/_next/static/chunks/app.js");
    expect(seen.some((s) => s.includes("cdn.example.net"))).toBe(false);
  });

  it.each([
    ["nonce", "page scripts carry the nonce"],
    ["redirect", "signed-out /play redirects to sign-in"],
    ["callback", "a forged sign-in code is refused"],
    ["leak", "no secrets or answer keys in pages and 1 script(s)"],
  ] as const)("fails when %s is broken", async (broken, check) => {
    const results = await runSmoke("https://staging.example.org", deployment(broken).fetchImpl);
    expect(failures(results)).toEqual([check]);
  });

  it("finds forbidden strings and same-origin scripts", () => {
    expect(findForbidden("x postgresql://u@h/db y service_role")).toEqual([
      "postgresql://",
      "service_role",
    ]);
    expect(
      sameOriginScripts(
        '<script src="/_next/a.js"></script><script async="" src="https://evil.example/b.js"></script>',
        new URL("https://staging.example.org"),
      ),
    ).toEqual(["https://staging.example.org/_next/a.js"]);
  });
});
