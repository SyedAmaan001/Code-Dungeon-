/**
 * Seed one e2e player by playing levels through the real services (no shortcuts):
 *   NODE_OPTIONS=--conditions=react-server tsx scripts/e2e/seed.ts <dev-name> <Handle> <levels>
 * Creates the player linked to the dev identity (with the age check recorded) and answers
 * every challenge of the first <levels> levels correctly via GameService + PostgreSQL.
 */
import { join } from "node:path";
import { AGE_POLICY } from "../../src/auth/age";
import { DEV_PROVIDER } from "../../src/auth/dev-session";
import { createSql } from "../../src/db/client";
import { loadPack } from "../../src/learning/loader";
import { GameService } from "../../src/services/game-service";
import { LearningService } from "../../src/services/learning-service";
import {
  PostgresPlayerAccounts,
  PostgresPlayerStore,
} from "../../src/services/postgres-player-store";
import { correctSubmission } from "../../tests/support/answers";

const [name, handle, levelsArg] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!name || !handle || !levelsArg || !url) {
  console.error("usage: seed.ts <dev-name> <Handle> <levels>  (DATABASE_URL required)");
  process.exit(1);
}

const { pack } = loadPack(join(process.cwd(), "content", "python-fundamentals"));
if (!pack) throw new Error("content pack failed to load");
const sql = createSql({ url, max: 2 });
const accounts = new PostgresPlayerAccounts(sql);
const created = await accounts.create({
  handle,
  visible: true,
  identity: { provider: DEV_PROVIDER, subject: name },
  ageCheck: { policy: AGE_POLICY.id, at: new Date() },
});
if (!created.ok) throw new Error(created.reason);
const store = new PostgresPlayerStore(sql);
const learning = new LearningService({ pack, store: store.progressStore });
const game = new GameService({ pack, learning, store: store.gameStore, transactional: store });

let n = 0;
for (const level of pack.levels.slice(0, Number(levelsArg)))
  for (const c of level.challenges) {
    const result = await game.submit(created.profile.playerId, {
      submissionId: `seed-${name}-${n++}`,
      levelId: level.id,
      challengeId: c.id,
      answer: correctSubmission(c),
    });
    if (result.learning.status !== "evaluated" || !result.learning.correct)
      throw new Error(`seeding failed at ${c.id}: ${result.learning.status}`);
  }
await sql.end();
console.log(`seeded ${handle}: ${levelsArg} level(s)`);
