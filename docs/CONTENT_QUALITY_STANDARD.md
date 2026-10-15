# Content Quality Standard

## Every published level must have

- Stable ID, content version, subject/path/zone/level references and publication state.
- Observable learner objective; prerequisites; estimated time and difficulty.
- Original explanation and a concise worked example.
- Expected output where applicable, verified by test.
- One or more challenges with clear prompts and a defined validator/rubric.
- Canonical answer and supported alternatives, stored where untrusted clients cannot use hidden answer keys to forge results.
- Explanation of correctness and mistake-specific feedback.
- Optional hint(s) that support reasoning rather than only reveal the answer.
- Reputable references, relevant section/topic, edition/version and review date.
- Validation result and reviewer/status metadata.

## Publication workflow

1. Draft content.
2. Check technical accuracy against official docs/reputable source.
3. Run examples/tests and verify output.
4. Review prompt ambiguity, alternate valid answers and common errors.
5. Ensure feedback explains the underlying concept.
6. Run content schema, link/reference and ID checks.
7. Publish only if all required checks pass; otherwise retain `draft` state.
8. On edits to an answer/rubric, increment version or use migration rules so prior progress remains coherent.

## Python-specific checks

- Use the selected Python version consistently and document it.
- Avoid version-sensitive assumptions without noting the version.
- Test indentation, numeric/string types, `input()` conversion, loop bounds, scope, collection behavior, exceptions, imports and file paths.
- Prefer small, reproducible examples.
- Never show arbitrary user-code execution as successful unless an approved sandbox actually ran it.

## Source use

Use official Python documentation and reputable books/research to validate or inform content. Examples: official Python Tutorial, Allen Downey's *Think Python*, *Make It Stick*, and *How Learning Works*. Preserve licenses and attribution for anything reused. Write original explanation and challenges; do not reproduce copyrighted chapters or proprietary exercise banks.

## Learner feedback

Feedback should answer: what happened, why, what concept matters and how to improve on the next attempt. A single answer is not conclusive proof of mastery. Use spaced revisit/retrieval practice when the product has sufficient progress data to do it sensibly.
