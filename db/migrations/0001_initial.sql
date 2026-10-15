-- Code Dungeon — initial schema (Phase 4).
--
-- Learning content lives in Git (content/); this database stores per-player state only.
-- Every player-owned table is protected by row-level security: the application runs each
-- transaction as the non-owner role code_dungeon_app with app.player_id set to the player's
-- verified id, so a session can only ever see or change that player's rows.

-- ---------------------------------------------------------------------------
-- Application role (no login; the server switches to it with SET LOCAL ROLE)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'code_dungeon_app') THEN
    CREATE ROLE code_dungeon_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- The verified player for the current transaction; NULL (deny everything) when unset.
CREATE FUNCTION app_current_player() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.player_id', true), '')::uuid $$;

-- ---------------------------------------------------------------------------
-- Players (public identity; linked to an identity provider later)
-- ---------------------------------------------------------------------------
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Same format rule as validateHandle (src/domain/game/leaderboard.ts); reserved words are checked in code.
  handle text NOT NULL CHECK (handle ~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$'),
  leaderboard_visible boolean NOT NULL DEFAULT true,
  -- Filled when an approved identity provider is integrated (docs/auth-design.md).
  auth_provider text,
  auth_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((auth_provider IS NULL) = (auth_subject IS NULL)),
  UNIQUE (auth_provider, auth_subject)
);
CREATE UNIQUE INDEX players_handle_unique ON players (lower(handle));

-- One row per player and learning path; locked FOR UPDATE to serialise that player's writes.
CREATE TABLE player_paths (
  player_id uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  path_id text NOT NULL,
  progress_revision integer NOT NULL DEFAULT 0 CHECK (progress_revision >= 0),
  game_revision integer NOT NULL DEFAULT 0 CHECK (game_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, path_id)
);

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
CREATE TABLE level_progress (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  level_id text NOT NULL,
  completed_at timestamptz,
  mastered_at timestamptz,
  PRIMARY KEY (player_id, path_id, level_id),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE,
  CHECK (mastered_at IS NULL OR completed_at IS NOT NULL)
);

CREATE TABLE challenge_progress (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  level_id text NOT NULL,
  challenge_id text NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 0),
  correct boolean NOT NULL,
  hints_revealed integer NOT NULL CHECK (hints_revealed >= 0),
  hints_since_last_attempt integer NOT NULL CHECK (hints_since_last_attempt >= 0),
  first_try_clean boolean,
  demonstrated boolean NOT NULL,
  PRIMARY KEY (player_id, path_id, level_id, challenge_id),
  FOREIGN KEY (player_id, path_id, level_id) REFERENCES level_progress ON DELETE CASCADE,
  CHECK (NOT correct OR attempts > 0),
  CHECK (NOT demonstrated OR correct)
);

-- Immutable XP ledger. The primary key is the award-once guarantee (DEC-002).
CREATE TABLE xp_ledger (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  source_key text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (reason IN ('challenge_solved', 'first_try_bonus', 'level_completed', 'level_mastered')),
  level_id text NOT NULL,
  challenge_id text,
  awarded_at timestamptz NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (player_id, path_id, source_key),
  UNIQUE (player_id, path_id, position),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);
CREATE INDEX xp_ledger_by_path ON xp_ledger (path_id, player_id);

-- Idempotency: one row per client submission id, holding the original learning result
-- and the game events it produced.
CREATE TABLE submissions (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  submission_id text NOT NULL CHECK (submission_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  level_id text NOT NULL,
  challenge_id text NOT NULL,
  learning_result jsonb NOT NULL,
  game_events jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, path_id, submission_id),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Game state
-- ---------------------------------------------------------------------------
CREATE TABLE encounters (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  level_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('not_started', 'active', 'defeated', 'won')),
  runs integer NOT NULL CHECK (runs >= 0),
  defeats integer NOT NULL CHECK (defeats >= 0),
  current_run jsonb,
  won_at timestamptz,
  flawless boolean,
  PRIMARY KEY (player_id, path_id, level_id),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE,
  CHECK ((status = 'won') = (won_at IS NOT NULL)),
  CHECK ((status = 'active') = (current_run IS NOT NULL)),
  CHECK (flawless IS NULL OR status = 'won')
);

CREATE TABLE checkpoints (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  level_id text NOT NULL,
  reached_at timestamptz NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (player_id, path_id, level_id),
  UNIQUE (player_id, path_id, position),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);

CREATE TABLE quest_progress (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  quest_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'completed')),
  activated_at timestamptz NOT NULL,
  completed_at timestamptz,
  objectives_met text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (player_id, path_id, quest_id),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE,
  CHECK ((state = 'completed') = (completed_at IS NOT NULL))
);

CREATE TABLE player_achievements (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL,
  PRIMARY KEY (player_id, path_id, achievement_id),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);

-- Cosmetic rewards (DEC-005); one per source (quest or achievement).
CREATE TABLE reward_items (
  player_id uuid NOT NULL,
  path_id text NOT NULL,
  source text NOT NULL,
  item text NOT NULL,
  awarded_at timestamptz NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (player_id, path_id, source),
  UNIQUE (player_id, path_id, position),
  FOREIGN KEY (player_id, path_id) REFERENCES player_paths ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Row-level security: a player sees and changes only their own rows
-- ---------------------------------------------------------------------------
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY players_self ON players TO code_dungeon_app
  USING (id = app_current_player()) WITH CHECK (id = app_current_player());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['player_paths', 'level_progress', 'challenge_progress', 'xp_ledger',
                           'submissions', 'encounters', 'checkpoints', 'quest_progress',
                           'player_achievements', 'reward_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I TO code_dungeon_app USING (player_id = app_current_player()) WITH CHECK (player_id = app_current_player())',
      t || '_own_rows', t);
  END LOOP;
END
$$;

-- Least-privilege grants. The XP ledger is append-only for the application.
GRANT USAGE ON SCHEMA public TO code_dungeon_app;
GRANT EXECUTE ON FUNCTION app_current_player() TO code_dungeon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON players TO code_dungeon_app;
GRANT SELECT, INSERT, UPDATE ON player_paths, level_progress, challenge_progress, encounters,
  checkpoints, quest_progress, player_achievements, reward_items TO code_dungeon_app;
GRANT SELECT, INSERT ON xp_ledger TO code_dungeon_app;
GRANT SELECT, INSERT, UPDATE ON submissions TO code_dungeon_app;

-- ---------------------------------------------------------------------------
-- Leaderboard: the only cross-player read. Returns public fields for visible players
-- with XP on one path (DEC-006). Runs with the owner's rights, but exposes nothing else.
-- ---------------------------------------------------------------------------
CREATE FUNCTION leaderboard_records(p_path_id text)
  RETURNS TABLE (player_id uuid, handle text, xp integer, reached_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    SELECT p.id, p.handle, sum(x.amount)::integer, max(x.awarded_at)
    FROM public.players p
    JOIN public.xp_ledger x ON x.player_id = p.id AND x.path_id = p_path_id
    WHERE p.leaderboard_visible
    GROUP BY p.id, p.handle
  $$;
REVOKE ALL ON FUNCTION leaderboard_records(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leaderboard_records(text) TO code_dungeon_app;

-- ---------------------------------------------------------------------------
-- Session resolution: after an approved identity provider has verified a sign-in, the
-- server needs the player id for (provider, subject) before it can set app.player_id.
-- Returns only the id; no other columns, no listing.
-- ---------------------------------------------------------------------------
CREATE FUNCTION player_id_for_identity(p_provider text, p_subject text)
  RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    SELECT id FROM public.players WHERE auth_provider = p_provider AND auth_subject = p_subject
  $$;
REVOKE ALL ON FUNCTION player_id_for_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION player_id_for_identity(text, text) TO code_dungeon_app;
