/**
 * npm run content:release-check [-- <content-root-or-pack-dir> ...]
 *
 * Public-release gate (DEC-011): exits non-zero while any published level has not been
 * reviewed by a person. AI-agent review does not count. Not part of CI on purpose: the
 * 25 Python levels are AI-reviewed and stay playable in development until human review.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findPackDirs, loadPack } from "../src/learning/loader";
import { levelsNeedingHumanReview } from "../src/learning/release";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = (roots.length ? roots : ["content"]).flatMap((r) =>
  existsSync(join(r, "path.yaml")) ? [r] : findPackDirs(r),
);

let blocked = false;
for (const dir of targets) {
  const { pack } = loadPack(dir);
  if (!pack) {
    console.log(`${dir}: could not be loaded (run content:validate)`);
    blocked = true;
    continue;
  }
  const pending = levelsNeedingHumanReview(pack);
  const published = pack.levels.filter((l) => l.status === "published").length;
  console.log(
    `${dir}: ${published - pending.length} of ${published} published level(s) human-reviewed`,
  );
  for (const p of pending)
    console.log(
      `  BLOCKED level ${p.number} (${p.levelId}): ${p.review === "ai_reviewed" ? "AI-reviewed only" : "no review"}`,
    );
  if (pending.length) blocked = true;
}

console.log(blocked ? "Not ready for public release." : "Ready for public release.");
process.exit(blocked ? 1 : 0);
