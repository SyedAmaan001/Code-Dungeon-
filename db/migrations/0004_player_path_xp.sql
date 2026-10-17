-- 0004: maintained XP totals for the leaderboard (scaling; docs/LOCAL_BACKEND_HANDOFF.md).
--
-- Before: leaderboard_records() summed the whole xp_ledger on every leaderboard view.
-- Now: player_path_xp holds each player's total per path and when that total was reached
-- (the latest award time, as in leaderboardRecord() in src/domain/game/leaderboard.ts).
-- A trigger on xp_ledger keeps it current inside the same transaction as every award, so
-- a rolled-back submission leaves no trace and a duplicate award (rejected by the ledger's
-- primary key) never reaches it. The ledger stays the source of truth; the total is derived.
--
-- Additive: one new table, one trigger, one new function, and leaderboard_records() reads
-- the totals with the same signature and result. No existing rows or columns change.
-- This migration runs in one transaction (src/db/migrate.ts); the lock below holds off
-- concurrent awards until the backfill and the trigger are both in place.

LOCK TABLE xp_ledger IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE player_path_xp (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  xp integer NOT NULL CHECK (xp > 0),
  reached_at timestamptz NOT NULL,
  PRIMARY KEY (player_id, path_id),
  -- Account deletion cascades players -> player_paths -> (xp_ledger, player_path_xp).
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);
CREATE INDEX player_path_xp_ranking ON player_path_xp (path_id, xp DESC, reached_at);

ALTER TABLE player_path_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_path_xp_own_rows ON player_path_xp TO code_dungeon_app
  USING (player_id = app_current_player()) WITH CHECK (player_id = app_current_player());
-- Read-only for the application: only the trigger below writes totals.
GRANT SELECT ON player_path_xp TO code_dungeon_app;

-- Runs as the table owner so the application role needs no write access to the totals.
CREATE FUNCTION xp_ledger_add_to_total() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  BEGIN
    INSERT INTO public.player_path_xp AS t (player_id, path_id, xp, reached_at)
    VALUES (NEW.player_id, NEW.path_id, NEW.amount, NEW.awarded_at)
    ON CONFLICT (player_id, path_id) DO UPDATE
      SET xp = t.xp + EXCLUDED.xp, reached_at = greatest(t.reached_at, EXCLUDED.reached_at);
    RETURN NULL;
  END
  $$;
REVOKE ALL ON FUNCTION xp_ledger_add_to_total() FROM PUBLIC;

CREATE TRIGGER xp_ledger_total AFTER INSERT ON xp_ledger
  FOR EACH ROW EXECUTE FUNCTION xp_ledger_add_to_total();

-- Backfill from the ledger (the lock above means no award is missed or counted twice).
INSERT INTO player_path_xp (player_id, path_id, xp, reached_at)
SELECT player_id, path_id, sum(amount)::integer, max(awarded_at)
FROM xp_ledger
GROUP BY player_id, path_id;

-- Same signature and meaning as 0001, now reading the maintained totals.
CREATE OR REPLACE FUNCTION leaderboard_records(p_path_id text)
  RETURNS TABLE (player_id uuid, handle text, xp integer, reached_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    SELECT p.id, p.handle, t.xp, t.reached_at
    FROM public.players p
    JOIN public.player_path_xp t ON t.player_id = p.id AND t.path_id = p_path_id
    WHERE p.leaderboard_visible
  $$;

-- One leaderboard page, ranked in SQL by the rules of rankLeaderboard()
-- (src/domain/game/leaderboard.ts), which stays the reference implementation:
--   order: XP desc, reached_at asc, handle case-insensitive, handle, player id;
--   rank:  competition rank ("1224") on (XP, reached_at);
--   only visible players with XP >= p_min_xp are ranked.
-- Returns the top p_limit rows, plus the caller's own row when it is ranked below them.
-- The caller is app_current_player() (the verified session), never a parameter, and no
-- player ids are returned. Handles are ASCII by constraint, so lower() under "C" collation
-- matches JavaScript's toLowerCase() and code-point comparison.
CREATE FUNCTION leaderboard_page(p_path_id text, p_limit integer, p_min_xp integer)
  RETURNS TABLE (handle text, xp integer, reached_at timestamptz, rank bigint,
                 is_viewer boolean, total_ranked bigint)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    WITH ranked AS (
      SELECT t.player_id, p.handle, t.xp, t.reached_at
      FROM public.player_path_xp t
      JOIN public.players p ON p.id = t.player_id
      WHERE t.path_id = p_path_id AND p.leaderboard_visible AND t.xp >= p_min_xp
    ),
    top AS (
      SELECT r.*,
             rank() OVER (ORDER BY r.xp DESC, r.reached_at) AS rank,
             row_number() OVER (ORDER BY r.xp DESC, r.reached_at, lower(r.handle) COLLATE "C",
                                r.handle COLLATE "C", r.player_id) AS pos
      FROM (
        SELECT * FROM ranked
        ORDER BY xp DESC, reached_at, lower(handle) COLLATE "C", handle COLLATE "C", player_id
        LIMIT greatest(p_limit, 1)
      ) r
    ),
    viewer AS (
      SELECT r.*,
             1 + (SELECT count(*) FROM ranked o
                  WHERE o.xp > r.xp OR (o.xp = r.xp AND o.reached_at < r.reached_at)) AS rank,
             NULL::bigint AS pos
      FROM ranked r
      WHERE r.player_id = public.app_current_player()
        AND NOT EXISTS (SELECT 1 FROM top WHERE top.player_id = r.player_id)
    ),
    page AS (
      SELECT * FROM top
      UNION ALL
      SELECT * FROM viewer
    )
    SELECT page.handle, page.xp, page.reached_at, page.rank,
           coalesce(page.player_id = public.app_current_player(), false),
           (SELECT count(*) FROM ranked)
    FROM page
    ORDER BY page.pos NULLS LAST
  $$;
REVOKE ALL ON FUNCTION leaderboard_page(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leaderboard_page(text, integer, integer) TO code_dungeon_app;
