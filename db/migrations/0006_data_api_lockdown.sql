-- 0006: keep hosted "Data API" roles away from Code Dungeon's objects (DEC-022).
--
-- Supabase exposes the public schema over its Data API (PostgREST) and, on projects with
-- the older defaults, automatically grants the API roles anon, authenticated and
-- service_role access to new tables, sequences and functions in public. Code Dungeon never
-- uses the Data API: every read and write goes through the server as code_dungeon_app.
-- Without this migration, anyone holding the publishable key could call the SECURITY
-- DEFINER functions (leaderboard_records, leaderboard_page, player_id_for_identity,
-- account_rate_limit_hit) or touch schema_migrations, the one table without RLS.
--
-- This revokes every privilege those roles hold on objects in public, and the default
-- privileges that would grant them access to future objects created by the migrating role.
-- On plain PostgreSQL (local, CI) the roles do not exist and nothing happens. Additive in
-- effect: no table, row or code_dungeon_app grant changes. Turn the Data API off in the
-- Supabase dashboard as well (docs/cloud-plan.md section 4).

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;

-- Functions are executable by PUBLIC by default; ours are granted explicitly where needed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE ALL ON FUNCTION app_current_player() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_player() TO code_dungeon_app;
