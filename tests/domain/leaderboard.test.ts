import { describe, expect, it } from "vitest";
import {
  compareRecords,
  emptyProgress,
  leaderboardRecord,
  rankLeaderboard,
  validateHandle,
  type LeaderboardRecord,
} from "@/domain";

const rec = (
  playerId: string,
  handle: string,
  xp: number,
  reachedAt: string | null,
  visible = true,
): LeaderboardRecord => ({
  playerId,
  handle,
  xp,
  reachedAt,
  visible,
});

const T1 = "2026-10-15T10:00:00.000Z";
const T2 = "2026-10-15T11:00:00.000Z";

describe("leaderboard ranking", () => {
  it("orders by XP, then by who reached it first", () => {
    const board = rankLeaderboard([
      rec("a", "Ari", 100, T2),
      rec("b", "Bo", 300, T2),
      rec("c", "Cy", 100, T1),
    ]);
    expect(board.entries.map((e) => [e.rank, e.handle, e.xp])).toEqual([
      [1, "Bo", 300],
      [2, "Cy", 100],
      [3, "Ari", 100],
    ]);
  });

  it("gives a shared rank for equal XP reached at the same instant (1224), ordered by handle", () => {
    const board = rankLeaderboard([
      rec("p4", "dana", 50, T1),
      rec("p1", "Zed", 200, T1),
      rec("p2", "bram", 200, T1),
      rec("p3", "Ash", 200, T1),
    ]);
    expect(board.entries.map((e) => [e.rank, e.handle])).toEqual([
      [1, "Ash"],
      [1, "bram"],
      [1, "Zed"],
      [4, "dana"],
    ]);
  });

  it("is deterministic regardless of input order", () => {
    const records = [
      rec("p1", "kit", 10, T1),
      rec("p2", "Kit", 10, T1),
      rec("p3", "kat", 10, T2),
      rec("p4", "amy", 99, T2),
    ];
    const expected = rankLeaderboard(records).entries;
    for (let i = 0; i < records.length; i++) {
      const rotated = [...records.slice(i), ...records.slice(0, i)];
      expect(rankLeaderboard(rotated).entries).toEqual(expected);
      expect(rankLeaderboard([...rotated].reverse()).entries).toEqual(expected);
    }
    expect(expected.map((e) => e.handle)).toEqual(["amy", "Kit", "kit", "kat"]);
  });

  it("uses the internal id only as a last resort and never exposes it", () => {
    const a = rec("id-2", "same", 5, T1);
    const b = rec("id-1", "same", 5, T1);
    expect(compareRecords(a, b)).toBeGreaterThan(0);
    const board = rankLeaderboard([a, b], { viewerId: "id-2" });
    expect(JSON.stringify(board)).not.toMatch(/id-1|id-2/);
    expect(board.entries).toEqual([
      { rank: 1, handle: "same", xp: 5, isViewer: false },
      { rank: 1, handle: "same", xp: 5, isViewer: true },
    ]);
  });

  it("excludes hidden players and players without XP, and explains the viewer's status", () => {
    const records = [
      rec("a", "Ari", 100, T1),
      rec("h", "Hid", 999, T1, false),
      rec("z", "Zero", 0, null),
    ];
    const board = rankLeaderboard(records, { viewerId: "h" });
    expect(board.entries.map((e) => e.handle)).toEqual(["Ari"]);
    expect(board.totalRanked).toBe(1);
    expect(board.viewer).toEqual({ ranked: false, reason: "hidden" });
    expect(rankLeaderboard(records, { viewerId: "z" }).viewer).toEqual({
      ranked: false,
      reason: "no_xp",
    });
    expect(rankLeaderboard(records, { viewerId: "nobody" }).viewer).toEqual({
      ranked: false,
      reason: "unknown",
    });
  });

  it("reports the viewer's rank even outside the top N, and clamps the limit", () => {
    const records = Array.from({ length: 150 }, (_, i) => rec(`p${i}`, `player${i}`, 1000 - i, T1));
    const board = rankLeaderboard(records, { viewerId: "p120", limit: 5 });
    expect(board.entries).toHaveLength(5);
    expect(board.viewer).toEqual({ ranked: true, rank: 121, xp: 880 });
    expect(rankLeaderboard(records, { limit: 1000 }).entries).toHaveLength(100);
    expect(rankLeaderboard(records, { limit: 0 }).entries).toHaveLength(1);
    expect(rankLeaderboard(records).entries).toHaveLength(10);
  });

  it("returns an empty board with no players instead of inventing any", () => {
    expect(rankLeaderboard([])).toEqual({
      metric: "lifetime_xp",
      entries: [],
      viewer: { ranked: false, reason: "unknown" },
      totalRanked: 0,
    });
  });
});

describe("leaderboard records from verified XP", () => {
  it("uses the ledger total and the time the latest award was made", () => {
    const progress = emptyProgress("p");
    progress.xp.push(
      {
        sourceKey: "challenge:a",
        amount: 10,
        reason: "challenge_solved",
        levelId: "L1",
        challengeId: "a",
        at: T1,
      },
      { sourceKey: "level:L1", amount: 25, reason: "level_completed", levelId: "L1", at: T2 },
    );
    expect(leaderboardRecord({ playerId: "p", handle: "Ari", visible: true }, progress)).toEqual(
      rec("p", "Ari", 35, T2),
    );
    expect(
      leaderboardRecord({ playerId: "q", handle: "Bo", visible: true }, emptyProgress("p")),
    ).toEqual(rec("q", "Bo", 0, null));
  });
});

describe("public handles", () => {
  it("accepts simple names and trims surrounding spaces", () => {
    expect(validateHandle("  Ari_the-Brave ")).toEqual({ ok: true, handle: "Ari_the-Brave" });
  });
  it.each([
    ["ab", "use 3 to 20 characters"],
    ["a".repeat(21), "use 3 to 20 characters"],
    ["1player", "start with a letter"],
    ["ari@example.com", "start with a letter"],
    ["ari bo", "start with a letter"],
    ["Admin", "reserved"],
    ["code_dungeon", "reserved"],
  ])("rejects %s", (handle, reason) => {
    const r = validateHandle(handle);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });
});
