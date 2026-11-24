# Contributing

This is a German-language municipal self-assessment prototype maintained by
ProjectTogether. Contributions are accepted under the
[Apache License 2.0](../LICENSE), the license of the project: submitting one
means you have the right to license it that way. You keep your copyright.
Third-party licenses remain applicable. Do not submit texts, data or logos of
others without naming their source and terms.

For feature work, open an issue describing the user problem and proposed scope
before starting a substantial change. Include a minimal reproduction for bugs.
Keep credentials, real emails, assessment conversations and municipal case data
out of issues, screenshots, fixtures and commits. Report security issues through
the [private reporting process](SECURITY.md).

## Local workflow

Use Node.js 22 and the committed lockfile:

```bash
npm ci
npm run dev
npm run check
```

The questionnaire works without an environment file. Tests use local provider
substitutes, PGlite and captured email. Never point tests at production services
or use real provider credentials. See [development](development.md) for account
setup, focused tests and desktop/narrow-viewport checks.

Read [architecture](architecture.md) before changing domain behavior and follow
[AGENTS.md](../AGENTS.md). Keep German user-facing text, JSON fields, canonical
categories and advice protocol tokens. Write developer documentation in English
under `docs/`. Update the owning guide when behavior changes.

Add regression coverage for changed validation, evidence, ordering, persistence
or access control. Questionnaire changes require a version bump and fingerprint
update; schema changes require a generated migration. Preserve anonymous use.
Keep pull requests focused, explain resulting behavior and compatibility changes,
and list actual validation results. Use concrete commit subjects such as
`fix(advice): refresh evidence after assessment edits`. Accurate AI contribution
credits are welcome; the submitter remains responsible for the change.

## Review and support

Maintainers decide whether to accept a contribution and when to release it.
There is no promised response time, production support agreement or availability
commitment. A passing CI run does not replace review of domain behavior, privacy
requirements or downstream deployment settings.
