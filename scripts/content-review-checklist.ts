/**
 * npm run content:review-checklist [-- --check]
 *
 * Writes docs/CURRICULUM_REVIEW_CHECKLIST.md from the Python Fundamentals pack. With
 * --check, exits non-zero if the committed file is out of date (used by the test suite).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPack } from "../src/learning/loader";
import { reviewChecklist } from "../src/learning/review-checklist";

const target = join("docs", "CURRICULUM_REVIEW_CHECKLIST.md");
const { pack } = loadPack(join("content", "python-fundamentals"));
if (!pack) {
  console.error("content pack failed to load; run npm run content:validate");
  process.exit(1);
}
const text = reviewChecklist(pack) + "\n";
if (process.argv.includes("--check")) {
  const current = (() => {
    try {
      return readFileSync(target, "utf8");
    } catch {
      return "";
    }
  })();
  if (current !== text) {
    console.error(`${target} is out of date; run npm run content:review-checklist`);
    process.exit(1);
  }
  console.log(`${target} is up to date`);
} else {
  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
