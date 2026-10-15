# Content packs

Each directory here is one learning path, stored as data. The game engine and UI never
hard-code levels; they read these files.

```text
content/<pack>/
  path.yaml      subject, path, zones, quests, achievements
  sources.yaml   reference registry (optional until a level cites a source)
  levels/        one YAML file per level, e.g. L001-wake-the-interpreter.yaml
```

The schema is defined in `src/learning/schema.ts`; a complete, valid example of every
challenge type is in `tests/fixtures/packs/valid-small/`.

## Rules

- IDs (`py.L001`, `py.L001.c1`, `py.zone.camp`) are permanent. Change titles freely; never reuse or rename an ID.
- New levels start as `status: draft`. A level can only be `published` when it has a lesson with a verified example, at least one challenge with feedback and explanation, a source reference, `estimatedMinutes` and `review` metadata, and all its prerequisites are published.
- Change a challenge's `version` whenever its answer or meaning changes.
- `code_write` challenges cannot be published while live code execution is disabled.
- Write original explanations; cite sources in `sources.yaml` with edition and licence.

## Checks

```bash
npm run content:validate        # schemas, references, publication gate
npm run content:verify-python   # runs every example and predict_output answer with real Python
```

Both run in CI and must pass before a change is merged.
