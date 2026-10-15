import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // CLAUDE.md is this project's agent guide; don't let `next dev` write an AGENTS.md.
  agentRules: false,
};

export default nextConfig;
