-- 0003: shared per-player rate limit for answers and hints (risk R-48).
--
-- One row per player per one-minute window, incremented atomically. Stored in the same
-- PostgreSQL database as the game, so every server instance shares the limit without a
-- new service. Additive only: no existing table or row changes. Old windows are removed
-- by the application; rows also disappear with the player (ON DELETE CASCADE).

CREATE TABLE action_rate_limits (
  player_id uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (player_id, window_start)
);

ALTER TABLE action_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_rate_limits_own_rows ON action_rate_limits TO code_dungeon_app
  USING (player_id = app_current_player()) WITH CHECK (player_id = app_current_player());

GRANT SELECT, INSERT, UPDATE, DELETE ON action_rate_limits TO code_dungeon_app;
