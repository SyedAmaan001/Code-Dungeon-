/**
 * Server runtime: the one place where the app wires content, services and PostgreSQL.
 *
 * Created lazily on first use (never at build time) and cached per server process
 * (on globalThis, so development hot reloads do not open new connection pools).
 * Every page and server action reaches player data only through these services,
 * with a player id resolved from a verified session (src/auth/server.ts).
 */
import "server-only";
import { join } from "node:path";
import { createSql, type Sql } from "@/db/client";
import { loadPack } from "@/learning/loader";
import {
  applyReleasePolicy,
  parseContentRelease,
  type ContentRelease,
  type WithheldLevel,
} from "@/learning/release";
import type { ContentPack } from "@/learning/schema";
import { validatePack } from "@/learning/validate";
import { GameService } from "./game-service";
import { LearningService } from "./learning-service";
import {
  PostgresLeaderboardSource,
  PostgresPlayerAccounts,
  PostgresPlayerStore,
} from "./postgres-player-store";
import { Presenter } from "./presenter";
import { RateLimiter } from "./rate-limit";

export interface Runtime {
  /** The pack as released (CONTENT_RELEASE); levels without human review are withheld in `public`. */
  pack: ContentPack;
  release: ContentRelease;
  withheld: WithheldLevel[];
  learning: LearningService;
  game: GameService;
  accounts: PostgresPlayerAccounts;
  presenter: Presenter;
  /** Submissions and hints per player: 40 per minute (process-local; R-36). */
  actionLimiter: RateLimiter;
}

export class RuntimeConfigError extends Error {}

const PACK_DIR = join(process.cwd(), "content", "python-fundamentals");

function loadReleasedPack(release: ContentRelease) {
  const { pack, issues } = loadPack(PACK_DIR);
  const errors = [...issues, ...(pack ? validatePack(pack) : [])].filter(
    (i) => i.severity === "error",
  );
  if (!pack || errors.length)
    throw new RuntimeConfigError(
      `Content pack has ${errors.length} error(s); run npm run content:validate.`,
    );
  return applyReleasePolicy(pack, release);
}

function build(sql: Sql): Runtime {
  const release = parseContentRelease(process.env.CONTENT_RELEASE);
  const { pack, withheld } = loadReleasedPack(release);
  const store = new PostgresPlayerStore(sql);
  const learning = new LearningService({
    pack,
    store: store.progressStore,
    onEvaluationError: ({ challengeId }) =>
      console.error(`[code-dungeon] evaluation error on challenge ${challengeId}`),
  });
  const game = new GameService({
    pack,
    learning,
    store: store.gameStore,
    transactional: store,
    leaderboardSource: new PostgresLeaderboardSource(sql),
  });
  return {
    pack,
    release,
    withheld,
    learning,
    game,
    accounts: new PostgresPlayerAccounts(sql),
    presenter: new Presenter(pack),
    actionLimiter: new RateLimiter(40, 60_000),
  };
}

const globalForRuntime = globalThis as unknown as { __codeDungeonRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (globalForRuntime.__codeDungeonRuntime) return globalForRuntime.__codeDungeonRuntime;
  if (!process.env.DATABASE_URL)
    throw new RuntimeConfigError(
      "DATABASE_URL is not set. Start a local database with `npm run db:local -- start` and add it to .env.local.",
    );
  const max = Number(process.env.DATABASE_POOL_MAX ?? "5");
  const runtime = build(createSql({ max: Number.isInteger(max) && max > 0 ? max : 5 }));
  globalForRuntime.__codeDungeonRuntime = runtime;
  return runtime;
}
