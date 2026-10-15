# CLAUDE.md — Code Dungeon

## Mission

Build Code Dungeon as a real, accurate, extensible learning game. It consists of three separate systems:

1. **Learning engine** — subjects, paths, skills, lessons, challenges, explanations, hints, review and mastery evidence.
2. **Game engine** — worlds/zones, levels, quest state, progression, checkpoints, XP, achievements and leaderboard rules.
3. **Game-world interface** — navigable maps and rooms, readable learning surfaces, quest journal, reward feedback and an original illustrated fantasy art direction.

Python Fundamentals is the first path. The initial release targets 25 meaningful playable levels while the data model supports at least 100 levels per path and more subjects later.

## Read before substantial changes

- `docs/decision.md`
- `docs/00_TO_100.md`
- `docs/EXECUTION.md`
- `docs/WORKFLOW.md`
- `docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`
- `docs/VISUAL_DIRECTION.md`
- `docs/CLAUDE_CLOUD_ENVIRONMENT_SETUP.md`

Inspect the real repository before assuming these documents describe the current code. Update documentation when verified reality or owner-approved decisions change.

## Confirmed product constraints

- Product name: **Code Dungeon**.
- Three core layers: learning engine, game engine, world/interface.
- Python Fundamentals is the first learning path; the core should support subject-specific content packs.
- Prototype: 25 meaningful levels; architecture extensible to 100+.
- Accounts/login and saved progress are required.
- Quests and a real leaderboard are required for the MVP.
- Single-player first. Do not build multiplayer yet.
- Learning content must be accurate and reviewed/tested; gamification cannot substitute for teaching.
- Visual direction: richly illustrated atmospheric fantasy exploration, distinct biomes, hand-drawn quest/reward items, restrained ornate frames, gold/teal/earth accents, modern readable UI. Not generic SaaS, not exclusively retro pixel art.
- Reuse mature open-source packages and managed services where sensible. Do not build all infrastructure from scratch.

## Engineering rules

- Audit before rewriting. Preserve existing work and keep changes reviewable.
- Distinguish verified existing behavior, incomplete behavior, mocks and new implementation.
- Never claim a feature works without a reproducible check.
- Keep curriculum/content separate from rendering and game rules.
- Keep progression/scoring logic independently testable and server-trusted.
- Make the map/content scalable; do not hardcode 25 nodes as 25 unrelated UI branches.
- Avoid unnecessary microservices, GPUs, Kubernetes, heavy 3D, custom authentication, vector databases or AI orchestration.
- Live execution of arbitrary learner Python must not run unsandboxed on the app server. If no suitable sandbox is available, ship real deterministic challenge formats and clearly defer arbitrary code execution.
- Use accurate, original learning content, source references, reviewed answer keys and tests.
- Do not copy proprietary artwork, game logos, characters or UI assets from references. Keep asset licenses/provenance recorded.
- No fake players, fake metrics, fake code execution, or decorative controls posing as working features.

## Security and spending

- Never commit real `.env` files, API keys, passwords, service-role keys or cloud credentials.
- Do not print secret values; inspect variable names/presence only.
- Do not trust client-supplied score, XP, user ID, role, unlocks or achievement awards.
- Enforce ownership server-side/database-side; test cross-user isolation.
- Do not attach broad credentials to an unreviewed MCP server.
- The owner’s `$100` is shown as **Claude Cloud session credits**. It is for Claude cloud sessions, not production hosting/database costs. Verify expiry in the UI. Do not assume any cloud provider is selected for production.
- Do not provision or modify billable external resources until the actual provider, resources and estimated cost are documented and explicitly approved.
- Do not delete existing external resources or production data as cleanup without explicit approval.

## Required working method

1. Inspect repository and run baseline checks.
2. Write/update documentation and record decisions.
3. Implement one reversible phase at a time.
4. Add tests with domain logic and content.
5. Run lint/typecheck/tests/build and report exact output.
6. Review the diff for secrets, unsafe operations, accidental rewrites and scope creep.
7. Report changed files, verified behavior, failures, mocks, risks, external services, cost impact and next step.
8. For Claude Code on the web, use branches/PRs where available; a PR is not a deployment.

## Decision protocol

If the answer is contained in this repository or docs, find it instead of asking the owner. If a decision remains genuinely ambiguous, record alternatives and a recommendation. Ask the owner before destructive operations, production data impacts, credential permission changes, public release or billable infrastructure provisioning. Continue non-billable work that does not depend on the unanswered decision.
