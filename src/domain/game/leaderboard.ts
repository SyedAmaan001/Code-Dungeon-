/**
 * Leaderboard ranking (pure). Status: DEFAULT (DEC-006).
 *
 * Metric: lifetime XP from the learner's XP ledger (DEC-002; R-005).
 *
 * Order (fully deterministic):
 *   1. XP, highest first
 *   2. reachedAt — when the player reached that XP total — earliest first
 *   3. handle, case-insensitive A→Z, then exact code-point order
 *   4. playerId (internal, never shown) as the last resort
 * Rank: standard competition ranking ("1224") on (XP, reachedAt). Players with the
 * same XP who reached it at the same instant share a rank; rules 3–4 only fix the
 * display order inside that shared rank.
 *
 * Only visible players with at least `minXp` are ranked. Output exposes rank,
 * handle and XP — never player ids, emails or progress details.
 */
import { DEFAULT_GAME_POLICY, type GamePolicy } from "./policy";
import type { LearnerProgress } from "../progression";
import { totalXp } from "../progression";

export interface LeaderboardRecord {
  playerId: string;
  handle: string;
  xp: number;
  /** ISO timestamp when the current XP total was reached; null when xp is 0. */
  reachedAt: string | null;
  visible: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  xp: number;
  isViewer: boolean;
}

export interface Leaderboard {
  metric: "lifetime_xp";
  entries: LeaderboardEntry[];
  /** The viewer's own placing, or why they are not ranked. */
  viewer:
    | { ranked: true; rank: number; xp: number }
    | { ranked: false; reason: "hidden" | "no_xp" | "unknown" };
  totalRanked: number;
}

/** Build a ranking record from a learner's verified XP ledger. */
export function leaderboardRecord(
  player: { playerId: string; handle: string; visible: boolean },
  progress: LearnerProgress,
): LeaderboardRecord {
  const xp = totalXp(progress);
  const reachedAt = progress.xp.reduce<string | null>(
    (latest, e) => (latest === null || e.at > latest ? e.at : latest),
    null,
  );
  return { ...player, xp, reachedAt: xp > 0 ? reachedAt : null };
}

function compareHandles(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function compareRecords(a: LeaderboardRecord, b: LeaderboardRecord): number {
  if (a.xp !== b.xp) return b.xp - a.xp;
  const ra = a.reachedAt ?? "";
  const rb = b.reachedAt ?? "";
  if (ra !== rb) return ra < rb ? -1 : 1;
  const byHandle = compareHandles(a.handle, b.handle);
  if (byHandle !== 0) return byHandle;
  return a.playerId === b.playerId ? 0 : a.playerId < b.playerId ? -1 : 1;
}

export function rankLeaderboard(
  records: readonly LeaderboardRecord[],
  options: { viewerId?: string; limit?: number } = {},
  policy: GamePolicy = DEFAULT_GAME_POLICY,
): Leaderboard {
  const { defaultLimit, maxLimit, minXp } = policy.leaderboard;
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? defaultLimit), 1), maxLimit);

  const ranked = records.filter((r) => r.visible && r.xp >= minXp).sort(compareRecords);
  const ranks: number[] = [];
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    ranks.push(prev && prev.xp === r.xp && prev.reachedAt === r.reachedAt ? ranks[i - 1]! : i + 1);
  });

  const viewerIndex = options.viewerId
    ? ranked.findIndex((r) => r.playerId === options.viewerId)
    : -1;
  const viewerRecord = options.viewerId
    ? records.find((r) => r.playerId === options.viewerId)
    : undefined;
  const viewer: Leaderboard["viewer"] =
    viewerIndex >= 0
      ? { ranked: true, rank: ranks[viewerIndex]!, xp: ranked[viewerIndex]!.xp }
      : {
          ranked: false,
          reason: !viewerRecord ? "unknown" : !viewerRecord.visible ? "hidden" : "no_xp",
        };

  return {
    metric: "lifetime_xp",
    entries: ranked.slice(0, limit).map((r, i) => ({
      rank: ranks[i]!,
      handle: r.handle,
      xp: r.xp,
      isViewer: r.playerId === options.viewerId,
    })),
    viewer,
    totalRanked: ranked.length,
  };
}

// ---------------------------------------------------------------------------
// Public handles
// ---------------------------------------------------------------------------

const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "system",
  "support",
  "codedungeon",
  "staff",
]);

export type HandleCheck = { ok: true; handle: string } | { ok: false; reason: string };

/**
 * Public leaderboard handles: 3–20 characters, letters, digits, `_` or `-`,
 * starting with a letter; not a reserved word. Emails are never valid handles.
 * (Offensive-word filtering needs a maintained list and is deferred: risk R-08.)
 */
export function validateHandle(raw: string): HandleCheck {
  const handle = raw.trim();
  if (handle.length < 3 || handle.length > 20)
    return { ok: false, reason: "use 3 to 20 characters" };
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(handle))
    return { ok: false, reason: "start with a letter and use only letters, digits, _ or -" };
  if (RESERVED.has(handle.toLowerCase().replace(/[_-]/g, "")))
    return { ok: false, reason: "that name is reserved" };
  return { ok: true, handle };
}
