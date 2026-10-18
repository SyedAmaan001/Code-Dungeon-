/**
 * Production configuration preflight: `npm run config:check`.
 *
 * Reads the environment the way a production `next start` would (process env plus
 * .env.production.local / .env.local / .env.production / .env, loaded by @next/env) and
 * reports problems by variable name only. Values are never printed. Exit code 1 if any
 * error is found. Run it in the deployment environment (or with the deployment's variables
 * exported) before promoting a build.
 */
import nextEnv from "@next/env"; // CommonJS: no named ESM exports
import { checkProductionConfig } from "../src/deploy/preflight";

nextEnv.loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

const findings = checkProductionConfig(process.env);
const errors = findings.filter((f) => f.level === "error");
for (const f of findings) console.log(`${f.level.toUpperCase()} ${f.name}: ${f.message}`);
console.log(
  errors.length
    ? `\n${errors.length} error(s), ${findings.length - errors.length} warning(s): not ready for production.`
    : `\nNo errors (${findings.length} warning(s)). Configuration looks ready for production.`,
);
process.exit(errors.length ? 1 : 0);
