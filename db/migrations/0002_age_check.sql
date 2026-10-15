-- 0002: record the onboarding age check (docs/decision.md DEC-010).
--
-- Only the outcome is stored: which policy was applied and when the player passed it.
-- The birth month/year a player enters is used once on the server and never stored.
-- Every player linked to a sign-in identity must have passed the check. NOT VALID keeps
-- rows created before this migration (local development data) loadable; new and
-- updated rows are checked.

ALTER TABLE players
  ADD COLUMN age_check_policy text CHECK (age_check_policy ~ '^[a-z0-9.+-]{1,40}$'),
  ADD COLUMN age_checked_at timestamptz,
  ADD CONSTRAINT players_age_check_complete
    CHECK ((age_check_policy IS NULL) = (age_checked_at IS NULL));

ALTER TABLE players
  ADD CONSTRAINT players_identity_needs_age_check
    CHECK (auth_provider IS NULL OR age_checked_at IS NOT NULL) NOT VALID;
