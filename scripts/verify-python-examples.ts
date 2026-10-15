/**
 * npm run content:verify-python [-- <content-root-or-pack-dir> ...]
 *
 * Runs every lesson example and predict_output answer key in the given content
 * packs (default: ./content) with a real CPython interpreter and compares the
 * actual output with the authored expectation. Exits non-zero on any mismatch,
 * error, timeout, or if the interpreter is missing or older than the pack's
 * minLanguageVersion. Set PYTHON=/path/to/python to choose the interpreter.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findPackDirs, loadPack } from "../src/learning/loader";
import {
  DEFAULT_RUN_OPTIONS,
  collectSnippets,
  pythonVersion,
  verifySnippet,
  versionAtLeast,
} from "../src/learning/python-verify";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = (roots.length ? roots : ["content"]).flatMap((r) =>
  existsSync(join(r, "path.yaml")) ? [r] : findPackDirs(r),
);

const version = pythonVersion();
if (!version) {
  console.error(
    `Python interpreter "${DEFAULT_RUN_OPTIONS.python}" was not found or failed to start.`,
  );
  process.exit(1);
}
console.log(`Using ${DEFAULT_RUN_OPTIONS.python} (Python ${version})`);

let failed = false;
let total = 0;
for (const dir of targets) {
  const { pack, issues } = loadPack(dir);
  if (!pack) {
    console.error(`${dir}: cannot load pack (${issues.length} issue(s)); run content:validate`);
    failed = true;
    continue;
  }
  const min = pack.meta.path.minLanguageVersion;
  if (min && !versionAtLeast(version, min)) {
    console.error(`${dir}: requires Python >= ${min}, interpreter is ${version}`);
    failed = true;
    continue;
  }
  const snippets = collectSnippets(pack);
  total += snippets.length;
  let passed = 0;
  for (const snippet of snippets) {
    const result = verifySnippet(snippet);
    if (result.ok) passed++;
    else {
      failed = true;
      console.log(`  FAIL ${snippet.label}: ${result.reason}`);
    }
  }
  console.log(`${dir}: ${passed}/${snippets.length} Python snippet(s) verified`);
}

console.log(`Total snippets checked: ${total}`);
process.exit(failed ? 1 : 0);
