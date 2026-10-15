# Security and Privacy Baseline

This is a requirements document; it does not certify the current app as secure.

## Identity and data access

- Prefer mature managed authentication.
- Enforce record ownership server-side and at database policy/RLS where available.
- Test that two independent test accounts cannot read or modify each other's private profile, attempt, progress, quest or XP records.
- Use safe public handles; never expose emails or internal secrets on a leaderboard.
- Protect privileged service keys; only intentionally public/publishable keys can be shipped to a browser.
- Do not store passwords or invent cryptography/session handling if managed auth can meet the need.

## Score/progression abuse

- Browser-submitted totals and user IDs are untrusted.
- Server verifies published challenge ID/version, attempt ownership, unlock prerequisites and result validator.
- Use idempotency/source-event uniqueness to prevent double XP awards on retry/network replay.
- Define rate limits for auth and high-impact challenge submissions.
- Make quest/achievement completion a verified server-side predicate.

## Arbitrary code

Never run arbitrary learner Python unsandboxed in the primary app process. If an external runner is used, verify security isolation, terms, cost and limits; apply request/code/output/runtime caps; do not send application credentials to it; restrict its network; normalize errors. Otherwise use non-execution challenge types and say live execution is deferred.

## Secrets and environments

- Never commit real `.env` files or credentials.
- Use `.env.example` placeholders only.
- Never output secret values in prompts/reports/logs/screenshots.
- Use least-privilege and separate development/staging/production.
- Do not give unreviewed MCP servers cloud-admin or production-data access.

## Privacy and lifecycle

Collect the minimum data needed. Document what is recorded (profile handle, path progress, challenge attempt metadata, scores/quests/achievements), retention, deletion/export and any external providers. Avoid retaining raw user code unless required and clearly disclosed. Use safe error messages without stack traces or personal data.

## Release gates

- Access-control/cross-user tests pass.
- Secret scan and client bundle checks pass.
- Dependencies reviewed; known critical/high findings addressed or explicitly accepted.
- Error logging excludes secrets and unnecessary personal data.
- Account deletion/retention policy defined before public launch.
- Code runner either passes threat-focused testing or remains unavailable.
