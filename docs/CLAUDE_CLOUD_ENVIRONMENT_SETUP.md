# Code Dungeon — Claude Code Cloud Environment Setup

This is a practical setup for the **Add cloud environment** form shown in the provided screenshot. The visible $100 is labelled **Cloud session credits**. According to the screenshot, the credit applies automatically to cloud sessions and expires at 1:29 PM GMT+5:30 on November 5; confirm the exact date/year in the Claude account UI. This is a development-session credit, not app-hosting/database credit.

## Fill in the form

**Name:** `code-dungeon-dev`

**Network access:** `Trusted`

Trusted is the sensible starting choice because the environment needs to reach common package registries and supported domains. Don't select Full/unrestricted access unless a concrete task needs it and the risk has been reviewed.

**Network secrets:** Leave empty for the first session.

**Environment variables:** Leave empty for the first session. Do not paste database URLs, service keys, auth secrets, or any production credentials into ordinary visible environment variables. Add narrowly scoped credentials only after the app architecture is chosen and there is a demonstrated need.

**Setup script:** Leave it blank for the first session.

Don't paste the placeholder `npm install` blindly. The supplied prototype files are static HTML/CSS/JS and the uploaded file set did not include a package manifest or lockfile. An unconditional install could fail or install dependencies before the correct stack is known. Let Claude inspect the connected repository first, detect its package manager and lockfile, and install dependencies with the project-appropriate command. If later needed, use the repository's `SessionStart` hook for project dependency installation that should run for both local and cloud sessions, or a short idempotent environment setup script for missing VM-level tooling.

Then create the environment.

## First task to send Claude Code

Paste this as the initial task after connecting the correct GitHub repository. It deliberately starts with audit and planning rather than telling the agent to rewrite everything in one pass.

> You are beginning Code Dungeon implementation in this Claude Code cloud session. First inspect the real repository, Git status, package manifests and lockfiles, scripts, assets, tests, current app routes, existing backend/deployment configuration and available tooling. The previously audited files (`index.html`, `styles.css`, `script.js`, `codeclash.html`, `page.js`, `site.html`) contain a concept/static landing page and legacy CodeClash material; do not assume their advertised features already work.
>
> The product has three layers: (1) a reusable learning engine, (2) a game engine, and (3) a distinctive illustrated fantasy game interface. The first playable learning path is Python Fundamentals with 25 real levels, while the data model should support expansion to 100 and more subjects later. Login, saved progress, quests, XP/achievements and a real leaderboard are required. Single-player first; no multiplayer yet.
>
> Design references supplied by the owner point to atmospheric illustrated fantasy environments, five distinct biome scenes (overgrown graveyard/gate, fire-lit stone hall, rune/sigil sanctum, rooted underground arches, and a world-tree citadel), hand-illustrated inventory/quest-item icons, a dark ornate fantasy presentation with gold and teal accents, and painterly future biomes such as desert ruins, icy lands, underwater temples and luminous forests. Do not copy proprietary game art/logos or make the whole UI generic pixel art. Keep learning text and code readable. A detailed `docs/visual-direction.md` should capture this direction.
>
> **For this first task only:** do an audit; run existing baseline checks; create `docs/initial-audit.md`, `docs/visual-direction.md`, and `docs/implementation-plan.md`; make a specific stack and reuse recommendation; list tests and risks; distinguish what can be done in the repository/cloud session from separate production hosting. Do not overwrite or delete legacy files, add secrets, provision external billable resources, or start a giant rewrite. Report concise findings, commands actually run, failures, exact next implementation steps, and any decisions that truly require owner input. Use the uploaded product blueprint/master prompt as the product source of truth.

## Credit and cost guardrails

- Use the Claude cloud-session credit for focused, reviewable tasks: audit; curriculum and schema; game logic; auth/persistence; UI; test pass; handoff. Prefer one coherent phase per session over multiple speculative parallel rewrites.
- Keep changes on a branch or in reviewable diffs where possible. Commit/PR before switching phases if the repository supports it.
- Cloud session credit does not itself deploy the app to a public host. Treat external hosting, database, email, code-runner and AI API charges separately.
- No deployment resources should be provisioned until the agent has prepared a plan naming each resource, its purpose, estimated usage cost, expiry/credit applicability and cleanup plan—and you have approved it.
- Don't add API keys or production data to the codebase. Don't give unreviewed MCP servers broad permissions. Keep network access at Trusted to start.
- Claude's cloud environment is a development sandbox with resource/time limits. Long builds or tests may need to be broken into smaller tasks.

## Official documentation

- Claude Code in the cloud: https://code.claude.com/docs/en/claude-code-on-the-web
- Cloud environment configuration, setup scripts, network access and secrets: https://code.claude.com/docs/en/cloud-environments

The official setup-script documentation says scripts run before Claude Code starts, need network access for package installs, and should complete in roughly five minutes for caching. A setup script installs environment tooling; repository dependency installation should be based on the actual repository and its lockfile.
