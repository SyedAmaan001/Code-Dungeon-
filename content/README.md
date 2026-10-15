# Content packs

Each directory here is one learning path, stored as data. The game engine and UI never
hard-code levels; they read these files. Format: content schema v2 (`src/learning/schema.ts`).

```text
content/<pack>/
  path.yaml      subject, path, zones, quests, achievements
  sources.yaml   reference registry (title, edition, licence, review date)
  levels/        one YAML file per level, e.g. L001-your-first-program.yaml
```

A small, complete example of every challenge format is in `tests/fixtures/packs/valid-small/`.

## A level

| Field | Purpose |
|---|---|
| `id`, `version`, `number`, `zone` | Stable identity and position. IDs are permanent; never reuse or rename one. |
| `title`, `description` | Shown to learners on the map/room card. |
| `status` | `draft` → `review` → `published`. Only published levels are playable. |
| `kind` | `standard`, `checkpoint`, `major` or `boss`. Determines completion XP via the central policy. |
| `prerequisites` | Level ids that must be completed first. Must form an acyclic graph reachable from a starting level. |
| `lesson.objectives` | Observable abilities the learner gains. |
| `lesson.explanation` | Original, beginner-friendly explanation. |
| `lesson.examples` | Worked examples; each declares `expectedOutput` or `expectedException` and is run with real Python. |
| `lesson.misconceptions`, `lesson.practicalContext` | Common mistakes, and where this matters outside the game. |
| `challenges` | At least one `role: exercise` and one `role: check` (knowledge check used for mastery). |
| `sources`, `review` | References consulted, and who reviewed the level (`kind: agent` or `human`). |

Levels carry **no XP numbers**. XP comes only from `src/domain/policy.ts` (decision DEC-002).

## A challenge

Formats: `multiple_choice`, `predict_output`, `fill_blank`, `order_lines`, `trace`, `find_fix_bug`
(and `code_write`, which cannot be published while live code execution is disabled).

Every published challenge needs:

- `feedback.correct`, `feedback.incorrect`, and optionally `feedback.byAnswer` for likely wrong answers
  (keys: the option id(s) for multiple choice, the output text, the blank value, `field=value;…` for
  traces, `fix:<id>` / `line:<n>` for bug fixes)
- exactly three `hints`, from gentle nudge to strong hint, none of which may contain the answer
- an `explanation`, shown only after a correct answer
- runnable proof where the format allows it: `check` for `fill_blank` and `order_lines`;
  `buggyBehaviour`, `fixedCode` and `check` for `find_fix_bug`. `predict_output` answers and
  `trace` values are run automatically.

## Quests and achievements (path.yaml)

Quests have an optional `activation` predicate, objectives (each with a `predicate`, optionally `optional: true`) and a `reward`. Achievements have one `predicate` and a `reward`. Rewards are cosmetic `item` keys only: `reward.xp` must be 0 (DEC-005). Predicates come from a closed list evaluated by `src/domain/game/predicates.ts`: `complete_levels`, `complete_level_count`, `complete_zone`, `master_level_count`, `correct_challenges_of_type`, `level_no_hints_first_try`, `earn_xp`, `level_unlocked`, `encounter_won`, `encounters_won`, `flawless_encounters`. Encounter predicates must point at checkpoint, major or boss levels; published quests and achievements may reference published levels only.

## Rules

- Write original explanations; record every source in `sources.yaml` with edition and licence.
- Change a challenge's `version` whenever its answer or meaning changes.
- Keep set and dictionary output deterministic (use `sorted()`); never print random values exactly.

## Checks

```bash
npm run content:validate        # schemas, references, graph, hints, publication gate
npm run content:verify-python   # runs every example and runnable answer key with real Python
```

Both run in CI and must pass before a change is merged. Validation messages name the file,
the level and the field, e.g.
`ERROR levels/L003-variables-and-assignment.yaml › py.L003 › challenges[1] (py.L003.c2).hints: …`.
