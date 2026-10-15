import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. A full script CSP needs per-request
 * nonces and is tracked separately (docs/risk-register.md R-52); these headers already
 * block framing (clickjacking of actions such as account deletion), MIME sniffing and
 * referrer leakage, and turn off device APIs the game never uses.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // CLAUDE.md is this project's agent guide; don't let `next dev` write an AGENTS.md.
  agentRules: false,
  // Lets the end-to-end suite build a production copy beside a running `next dev`.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
