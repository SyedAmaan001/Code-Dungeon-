-- 0005: shared rate limit for account writes (profile update, onboarding, account deletion).
--
-- Separate from the answer/hint limit (0003, unchanged). Onboarding happens before a player
-- row exists, so limits are kept per *bucket* rather than per player id:
--   player:<player uuid>:<action>     signed-in player (profile, delete)
--   identity:<sha256 hex>:<action>    verified sign-in identity without a player yet
--                                     (a hash of provider and subject; no raw identifier)
-- The application role cannot read or write the table; it can only call
-- account_rate_limit_hit(), which counts one hit atomically. Windows use the database clock,
-- so every server instance shares the same windows. A player bucket can only be charged by
-- that player's own session (app.player_id). Additive: one table, one function.

CREATE TABLE account_rate_limits (
  bucket text NOT NULL CHECK (bucket ~ '^(player:[0-9a-f-]{36}|identity:[0-9a-f]{64}):[a-z_]{1,32}$'),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX account_rate_limits_by_window ON account_rate_limits (window_start);

-- Row-level security with no policy: the application role sees and changes nothing directly.
ALTER TABLE account_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION account_rate_limit_hit(p_bucket text, p_window_seconds integer, p_limit integer)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  DECLARE
    v_player uuid := public.app_current_player();
    v_window timestamptz;
    v_hits integer;
  BEGIN
    IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_limit IS NULL OR p_limit < 1 THEN
      RAISE EXCEPTION 'invalid rate limit' USING ERRCODE = '22023';
    END IF;
    IF p_bucket LIKE 'player:%'
       AND (v_player IS NULL OR split_part(p_bucket, ':', 2) <> v_player::text) THEN
      RAISE EXCEPTION 'rate limit bucket does not belong to this session' USING ERRCODE = '42501';
    END IF;
    v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
    INSERT INTO public.account_rate_limits AS r (bucket, window_start, hits)
    VALUES (p_bucket, v_window, 1)
    ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
    RETURNING hits INTO v_hits;
    -- First hit of a new window: drop windows older than a day (or two windows, if longer).
    -- Keeps the table small, including buckets of deleted accounts.
    IF v_hits = 1 THEN
      DELETE FROM public.account_rate_limits
      WHERE window_start < now() - greatest(interval '1 day', make_interval(secs => 2 * p_window_seconds));
    END IF;
    RETURN v_hits <= p_limit;
  END
  $$;
REVOKE ALL ON FUNCTION account_rate_limit_hit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_rate_limit_hit(text, integer, integer) TO code_dungeon_app;
