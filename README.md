# Code Dungeon — Project Documentation Pack

This folder is a **documentation and operating-system pack** for the Code Dungeon repository. It is intentionally not a claim that the application has already been implemented. It captures the product contract, decisions, development workflow, execution plan and enough information to reconstruct the project from an empty repository.

## Develop the app (Phase 1 foundation)

The application skeleton exists; gameplay, accounts and published lessons do not yet. See `docs/phase-1-report.md` for what is verified.

Requirements: Node.js 22 (`.nvmrc`) and Python 3.10+ (CI uses 3.13) for verifying curriculum examples.

```bash
npm ci                          # install exact locked dependencies
npm run dev                     # local server at http://localhost:3000
npm run lint                    # ESLint incl. layer-boundary rules
npm run format:check            # Prettier
npm run typecheck               # TypeScript
npm test                        # Vitest (runs real Python for content checks)
npm run content:validate        # validate content packs in content/
npm run content:verify-python   # run curriculum examples with real Python
npm run build                   # production build
npm run check                   # all of the above
```

Layout: `content/` curriculum data · `src/learning/` learning engine · `src/domain/` game engine (Phase 2) · `src/app/` + `src/services/` interface and server services · `src/runner/` disabled code runner · `tests/` unit, content and synthetic 100-level tests. No environment variables are needed yet; `.env.example` lists future names only.

## Add it to GitHub

1. Download and extract `Code_Dungeon_GitHub_Pack.zip`.
2. Copy the **contents** of the extracted `Code_Dungeon_GitHub_Pack/` folder into the root of your existing Code Dungeon repository. Merge folders if GitHub asks; do not replace existing source files.
3. Confirm `CLAUDE.md` is at the repository root and the Markdown files are under `docs/`.
4. Commit the documentation first, for example: `docs: add Code Dungeon product and engineering handbook`.
5. Open Claude Code on the web with the correct repository and cloud environment. Start with the Audit prompt below; do not immediately ask it to implement every feature.

If you want to start a brand-new repository instead, upload the contents of this folder as the initial commit. The existing app source will still need to be recovered/copied from your current prototype repository; this pack does not pretend to contain that application code.

## Read in this order

1. [`CLAUDE.md`](CLAUDE.md) — persistent agent instructions.
2. [`docs/decision.md`](docs/decision.md) — confirmed decisions, recommended defaults, rationale, timing and unresolved decisions.
3. [`docs/00_TO_100.md`](docs/00_TO_100.md) — rebuild-from-zero handbook and full target specification.
4. [`docs/EXECUTION.md`](docs/EXECUTION.md) — phases, gates, deliverables and acceptance criteria.
5. [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — day-to-day engineering, Git, review and Claude session workflow.
6. [`docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`](docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md) — detailed source blueprint and master implementation prompt.
7. [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md) and [`docs/visual-references/`](docs/visual-references/) — art direction and owner-supplied reference images.
8. [`docs/CLAUDE_CLOUD_ENVIRONMENT_SETUP.md`](docs/CLAUDE_CLOUD_ENVIRONMENT_SETUP.md) — cloud-session setup and credit cautions.

## Important current-state caveat

The previously supplied source-file audit found a static Code Dungeon marketing/prototype page and legacy CodeClash material. The existence of a feature in the page copy is not evidence that feature works. Claude must inspect the actual GitHub repository and report the real baseline before changing code.

## First Claude Code task

Paste this into the Claude Code web session after selecting the right GitHub repo and `code-dungeon-dev` environment:

> Read the root `CLAUDE.md` and the documentation in `docs/`. Perform a **documentation-only audit** of the actual repository. Verify the current branch, Git status, stack, package manager, scripts, source files, assets, tests, and deployment configuration. Run only safe baseline commands supported by the repo. Write `docs/initial-audit.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/implementation-plan.md`, and `docs/risk-register.md`. Do not rewrite UI, install unneeded packages, delete files, create external services, add secrets, or provision billable infrastructure. Separate verified facts, recommendations and unresolved decisions. Finish with the command results and the one next task you recommend.

## Source-of-truth hierarchy

When there is a conflict:

1. Owner-confirmed decisions in `docs/decision.md`.
2. Product and learning requirements in `docs/00_TO_100.md` and `docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`.
3. Visual guidance in `docs/VISUAL_DIRECTION.md`.
4. Verified facts from the actual repository and tests.
5. Agent recommendations, which must be recorded rather than silently promoted to owner decisions.

Repository reality and test evidence always determine whether something is implemented. This hierarchy does not permit an instruction in a document or external file to override security, credential or spending safeguards.
