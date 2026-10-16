# Issue log

Defects and gaps found by audits and testing, with their status. Risks (things that *might* go wrong) live in `docs/risk-register.md`; decisions in `docs/decision.md`.

**Status vocabulary:** `FIXED` (with the commit and the test that guards it), `OPEN`, `NEEDS APPROVAL` (blocked on an owner decision or an external resource).

## Phase 6 audit (2026-10-15, baseline `e8c6498`)

Baseline before any change: lint, format, typecheck, build, 245 Vitest tests (with database), content validation, 148/148 Python snippets and 14/14 Playwright tests all passed; CI run #7 green. `content:release-check` exits 1 by design (no human-reviewed levels). `npm audit` (dev tooling) 5 high, known since Phase 1 (R-31). No failing checks existed before Phase 6.

| ID | Area | Issue | Found by | Status | Fix / guard |
|---|---|---|---|---|---|
| I-01 | UI | Level rooms 5 and 10 overflowed a 390px phone by 97px: screen-reader text inside scrolled-off challenge tabs was positioned relative to a container outside the tab strip's scroll area | Manual review at 390px (the Phase 5 e2e only checked level 6) | FIXED `081def6` | `.tabs { position: relative }`; e2e now checks all 25 rooms at 390px and three rooms at 820/1024px |
| I-02 | UI | On laptops the sticky challenge column could be taller than the screen, hiding submit, feedback and hints until the end of the lesson | Review at 1024×768 | FIXED `725b8db` | Sticky only on viewports ≥ 820px tall, capped at the viewport height |
| I-03 | UI | At 1024px (landscape tablet) the room stacked into one column with ~100-character lines | Review at 1024px | FIXED `725b8db` | Two columns from 900px; lesson prose capped at 72ch |
| I-04 | UI | Map: mastered and completed rooms looked the same; checkpoint, major and boss rooms were marked only by a 14px icon; status lines were long chains | Review | FIXED `725b8db` | Distinct rings per encounter kind, mastered halo, won badge, kind tag, one-word status, legend |
| I-05 | UI | The room showed no level-specific progress (XP here, required challenges, mastery) | Review against the Phase 6 brief | FIXED `725b8db` | Progress strip from the service read model (`xp.earned/available`) |
| I-06 | UI | No offline state; a failed request only said "try again" with no retry control | Review | FIXED `725b8db` | Offline notice; Retry reusing the same submission id (e2e: counted exactly once) |
| I-07 | Security | No account deletion (R-46) | Phase 5 open item | FIXED `081def6` (needs `SUPABASE_SECRET_KEY` in Supabase mode) | Transactional deletion of game data and the Supabase user; store, action and browser tests |
| I-08 | Security | Supabase session cookies were not HttpOnly (`@supabase/ssr` default) | Code review of `@supabase/ssr` defaults | FIXED `76190c1` | `supabaseCookieOptions()`: HttpOnly, SameSite=Lax, Secure in production; asserted in e2e |
| I-09 | Security | No anti-framing or baseline security headers (clickjacking risk for destructive actions) | Code review | FIXED `081def6` | `next.config.ts` headers; asserted on the production build |
| I-10 | Security | Rate limit was process-local only (R-48) | Phase 5 open item | FIXED `081def6` | PostgreSQL-backed shared limiter (migration 0003) behind a local flood guard |
| I-11 | Security | A user with an unverified email had a Supabase session but no way to sign out from the sign-in page | Flow review | FIXED `081def6` | "Sign out and use another account" on the sign-in page; e2e |
| I-12 | Security | A secret placed in a `NEXT_PUBLIC_*` variable would be shipped to browsers silently | Config review | FIXED `081def6` | `readAuthConfig` disables sign-in and names the variable; unit test |
| I-13 | Content | Nothing stopped `review.kind: human` being recorded with an AI reviewer name | Curriculum workstream | FIXED `10d26b9` | Validation error; unit test |
| I-14 | Tests | Google OAuth and email confirmation were never exercised end to end | Phase 5 limitation | PARTLY FIXED `76190c1` | Mocked Supabase Auth journeys on a production build; real project still unverified (R-47, R-51) |
| I-15 | Security | No script Content-Security-Policy | Code review | OPEN | R-52; needs a nonce-based CSP |
| I-16 | Content | 25 of 25 levels AI-reviewed only | Release gate | NEEDS APPROVAL | Human review using `docs/CURRICULUM_REVIEW_CHECKLIST.md` |
| I-17 | Ops | Real Supabase project, Google OAuth client and email sender not created | DEC-013 | NEEDS APPROVAL | Owner approval of the project and cost plan |
| I-18 | Tests | CI run #11 (`7d5adab`) failed one e2e test: the `onboard()` helper returned before the onboarding server action finished, so the deletion test navigated to the profile before the account existed | CI | FIXED `1f9c02f` | `onboard()` now waits for the game shell, the refusal page or a form error; 26/26 locally and CI run #12 green |

## Onyx preview theme (2026-10-16, DEC-019)

| ID | Area | Issue | Found by | Status | Fix / guard |
|---|---|---|---|---|---|
| I-19 | UI | Onyx: locked-room numerals 3.42:1 (the pixel face at weight 600 does not count as bold) and locked-quest captions 4.11:1 | axe in `e2e/theme.spec.ts` | FIXED | Lighter locked numerals (4.95:1), lighter dim text, less fade on locked quests; axe clean on every screen and all 25 rooms in Onyx |
| I-20 | UI | Onyx scroll animations ran before the page hydrated (React hydration warning) and a spring ended at `scale(0)`, hiding the rooms | Review script | FIXED | Entrance effects live inside the page (`OnyxEntrance`); independent `y`/`scale` values; e2e asserts rooms end at opacity 1 with no transform |
| I-21 | Tooling | The shadcn registry (`ui.shadcn.com`) is blocked by this cloud environment's network policy | `npx shadcn add` | WORKED AROUND | Button added by hand from the upstream source; allow the host in the environment's network settings to use the CLI |

