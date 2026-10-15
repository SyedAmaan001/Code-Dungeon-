# Code Dungeon — Risk Register

- **Created:** 15 October 2026 (Phase 0 audit). Update at every phase gate.
- **Scale:** Likelihood / Impact = Low · Medium · High. **Status:** Open · Mitigating · Accepted · Closed.
- Owner of every risk is the project owner unless stated; "Agent" means the implementing Claude session is expected to carry the mitigation in code/docs.

## Security and privacy

| ID | Risk | L | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-01 | **Client-forged XP/progress.** With Supabase, the browser holds a key that can call the DB REST API; permissive RLS (e.g. "users may insert their own XP") lets anyone award themselves score and corrupt the leaderboard | High if naïve | High | Server is the sole writer of progress/XP tables; revoke insert/update/delete from `anon`/`authenticated`; RLS select-own only; integration tests that try direct writes as a normal user (`architecture-proposal.md` §6.1) | Agent | Open |
| R-02 | **Double awards via replay/retry/race** | Medium | High | `unique(user_id, source_event_key)` on `xp_transactions`, server-derived keys, `unique(user_id, idempotency_key)` on attempts, single transaction; concurrency test | Agent | Open |
| R-03 | **Cross-user data access** (guessed IDs, missing ownership checks) | Medium | High | User ID only from verified session; RLS deny-by-default; two-account tests for every user table and endpoint | Agent | Open |
| R-04 | **Answer keys leaked to the browser** (bundle or API response), enabling trivial cheating | Medium | Medium | Separate public/key projections, `server-only` on key modules, unit test on projections, CI bundle canary grep | Agent | Open |
| R-05 | **Arbitrary learner code executed unsafely** | Low (policy forbids) | Critical | No execution on app server; `DisabledRunner` default; Tier 1 Pyodide runs only in the learner's browser and never awards XP; Tier 2 only via isolated provider after approval and abuse tests | Agent | Open |
| R-06 | **Secret leakage** (committed `.env`, service keys in client bundle, keys in logs/prompts) | Medium | High | `.gitignore` verified for `.env*`; `.env.example` placeholders only; server-only env access module; CI secret scan; never print values. Baseline scan: 0 matches | Agent | Mitigating |
| R-07 | **Learner privacy / minors.** Audience is "students or self-directed learners"; if under-13s (or under local age-of-consent thresholds) can sign up, extra legal duties apply | Medium | High | Decide audience age policy before public launch (O-8); collect minimal data (email via auth provider, handle); leaderboard opt-out; handle moderation; documented retention/deletion | Owner | Open |
| R-08 | **Offensive or identifying public handles** on the leaderboard | Medium | Medium | Handle validation (charset/length/reserved list), basic block-list, report/rename path, `leaderboard_visible` toggle | Agent | Open |
| R-09 | **Auth abuse** (credential stuffing, signup spam, email bombing) | Medium | Medium | Managed auth rate limits, email confirmation, CAPTCHA option if abuse appears, per-user submission rate limit | Agent | Open |
| R-10 | **Unreviewed MCP servers/plugins with broad credentials** | Low | High | Follow CLAUDE.md: no broad credentials to unreviewed tools; scoped, read-only where possible | Owner | Open |

## Content and product

| ID | Risk | L | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-11 | **Inaccurate or ambiguous Python content** undermines the core promise (D-008) | Medium | High | Schema publication gate, CPython verification of every example/key, misconception feedback, human review metadata, draft-by-default; pin Python version (O-3) | Agent + owner review | Open |
| R-12 | **Reference-image licensing.** `docs/visual-references/` contains third-party imagery (e.g. a Faeria website screenshot, likely-sourced concept/pixel art) of unknown licence, committed to the repo; if the repo is or becomes public this is redistribution | Medium | Medium | Never ship them as product assets; owner to confirm repo visibility and whether to keep originals in Git or replace with links/notes (O-10). **No file deleted by this audit** | Owner | Open |
| R-13 | **Copying protected material** (book text, proprietary exercises, game art/logo) into content or UI | Low | High | Original wording; `sources.yaml` with licence notes; asset provenance file per theme; review checklist | Agent | Open |
| R-14 | **Scope creep / "build everything" sessions** (multiplayer, inventory economy, 100 levels, 3D) | High | High | Phase gates in `EXECUTION.md`; one phase per PR; non-MVP list in blueprint §4 | Owner + Agent | Open |
| R-15 | **Gamification overwhelms learning** (XP for speed, punitive failure) | Medium | Medium | Scoring proposal keeps bonus ≤ ⅓ of base, no time bonus, failure never deletes progress; owner confirms P-005 | Owner | Open |
| R-16 | **Content authoring effort underestimated** — 25 reviewed levels is the largest work item | High | Medium | Author by zone batches of 5; vertical slice with 2–3 levels first; reuse challenge types across levels | Owner + Agent | Open |
| R-17 | **Art pipeline stalls** — no original assets exist; references cannot be shipped | High | Medium | Ship with tokenised frames, SVG map and placeholder backdrops clearly marked as placeholders; owner review of one zone slice before bulk assets (P-006); decide art source (commissioned, licensed packs, or owner-made) | Owner | Open |

## Technical

| ID | Risk | L | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-18 | **Vendor lock-in to Supabase** | Medium | Low–Med | Use Supabase for Auth + plain Postgres; all domain writes via our own server code and SQL migrations, so the DB is portable | Agent | Open |
| R-19 | **Free-tier behaviour surprises** (e.g. inactive free Supabase projects reported to pause after ~7 days; hosting free plans with usage/commercial-use limits) | Medium | Medium | Verify on official pricing/terms pages at decision time; document in `cloud-plan.md`; staging only until approved | Owner | Open |
| R-20 | **Cloud-sandbox limits** — Docker daemon unavailable, so Supabase's local stack can't run in cloud sessions | Verified | Low | Use installed PostgreSQL 16 with an emulated `auth` schema for integration tests; run the Supabase CLI locally on the owner's machine if desired | Agent | Mitigating |
| R-21 | **Framework churn** (Next.js major versions, React changes) | Medium | Low | Pin versions in lockfile; keep domain/learning layers framework-free | Agent | Open |
| R-22 | **Content/version drift** corrupts historical progress | Low | Medium | Stable IDs, version bumps, attempts record graded version, registry sync never deletes rows with progress | Agent | Open |
| R-23 | **Map hard-coded to 25 nodes** | Medium | Medium | Data-driven map + layout fallback + 100-level fixture test | Agent | Open |
| R-24 | **Accessibility regressions** over atmospheric art | Medium | Medium | Token contrast tests, axe in e2e, reduced-motion, non-colour state indicators | Agent | Open |
| R-25 | **Pyodide payload/performance** on low-end devices, if Tier 1 is adopted | Medium | Low | Lazy-load only on the scratchpad, Web Worker with timeout, never on the critical learning path | Agent | Open |

## Cost and operations

| ID | Risk | L | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-26 | **Treating Claude cloud-session credit as hosting budget** | Low (well documented) | High | Docs consistently separate them; nothing provisioned without an approved `cloud-plan.md` | Owner | Mitigating |
| R-27 | **Cloud-session credit expiry** — shown as 5 November (year to confirm). If 2026, ≈3 weeks remain from this audit | High | Medium | Prioritise high-value, non-billable phases (scaffold, content schema, domain engine) in focused sessions; avoid parallel speculative sessions | Owner | Open |
| R-28 | **Unbounded usage-based charges** (code sandbox, email, egress) once hosted | Low now | High | Budget alerts + hard caps where supported, rate limits, usage caps per user; Tier 2 runner only after approval | Owner | Open |
| R-29 | **Documentation drift / duplicate docs** (UPPER_SNAKE vs lower-kebab names referenced for the same content) | Medium | Low | Naming convention decision (O-7); do not create duplicates; update references when promoting proposals | Agent | Open |
| R-30 | **Legacy prototype files not in the repo** — docs describe them; their whereabouts are unknown | Verified | Low | Nothing depends on them; owner decides whether to archive them for reference (O-6) | Owner | Open |
