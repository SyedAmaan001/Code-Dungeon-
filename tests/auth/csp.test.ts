import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce } from "@/csp";

describe("content security policy (R-52)", () => {
  it("creates a fresh 128-bit base64 nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(Buffer.from(n, "base64")).toHaveLength(16);
  });

  it("allows only nonce-bearing scripts in production", () => {
    const csp = contentSecurityPolicy("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("keeps the anti-framing, base-uri and object-src rules", () => {
    const csp = contentSecurityPolicy("n", false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it("adds eval only for next dev", () => {
    expect(contentSecurityPolicy("n", true)).toContain("'unsafe-eval'");
  });
});
