/**
 * npm run content:validate [-- <content-root-or-pack-dir> ...]
 *
 * Loads every content pack (a directory containing path.yaml) under the given
 * roots (default: ./content), checks schemas, cross-references and the
 * publication gate, prints a summary, and exits non-zero on any error.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { formatIssue, hasErrors, type ContentIssue } from "../src/learning/issues";
import { findPackDirs, loadPack } from "../src/learning/loader";
import { validatePack } from "../src/learning/validate";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = (roots.length ? roots : ["content"]).flatMap((r) =>
  existsSync(join(r, "path.yaml")) ? [r] : findPackDirs(r),
);

if (targets.length === 0) {
  console.error(`No content packs found under: ${(roots.length ? roots : ["content"]).join(", ")}`);
  process.exit(1);
}

let failed = false;
for (const dir of targets) {
  const { pack, issues: loadIssues } = loadPack(dir);
  const issues: ContentIssue[] = [...loadIssues, ...(pack ? validatePack(pack) : [])];
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;

  if (pack) {
    const count = (s: string) => pack.levels.filter((l) => l.status === s).length;
    console.log(
      `${dir}: ${pack.meta.path.title} — ${pack.levels.length} levels ` +
        `(${count("published")} published, ${count("review")} in review, ${count("draft")} draft), ` +
        `${pack.meta.zones.length} zones, ${pack.meta.quests.length} quests, ` +
        `${pack.meta.achievements.length} achievements, ${pack.sources.length} sources`,
    );
  } else {
    console.log(`${dir}: could not be loaded`);
  }
  for (const issue of issues) console.log(`  ${formatIssue(issue)}`);
  console.log(`  → ${errors} error(s), ${warnings} warning(s)`);
  if (hasErrors(issues)) failed = true;
}

process.exit(failed ? 1 : 0);
