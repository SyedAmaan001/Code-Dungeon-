/**
 * Deployment smoke test: `npm run smoke -- https://staging.example.org`.
 * Read-only and credential-free (src/deploy/smoke.ts). Exit code 1 if any check fails.
 */
import { runSmoke } from "../src/deploy/smoke";

const base = process.argv[2];
if (!base) {
  console.error("usage: npm run smoke -- <base-url>   e.g. http://localhost:3000");
  process.exit(2);
}

const results = await runSmoke(base);
for (const r of results)
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  `\n${results.length - failed} passed, ${failed} failed against ${new URL(base).origin}`,
);
process.exit(failed ? 1 : 0);
