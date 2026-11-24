# Repository instructions

## Project context

Reform-Kompass is a public self-assessment and advice prototype for German
municipal administrations. It uses Next.js 16, React 19, TypeScript, and Node.js
22. The questionnaire works without AI keys, accounts, or a database. Optional
member accounts use PostgreSQL (Drizzle ORM), Better Auth with email one-time
codes, and MailerSend.

Read [README.md](README.md) for setup and
[docs/architecture.md](docs/architecture.md) before changing domain behavior.
All maintained developer documentation belongs in `docs/`, except the root
README and this file. Operator content (advice texts, product name, footer,
logos) belongs in `inhalte/` and `public/marke/`; this repository only holds
neutral examples. Runtime AI content stays in German. Write developer documentation in English. Keep German user-facing copy,
category labels, JSON field names, and advice protocol tokens unless the task
explicitly changes them.

## Where to make changes

| Concern | Source of truth |
| --- | --- |
| Questions, options, scoring, and canonical category labels | `src/lib/reifegrad-model.ts` |
| Advice state, follow-up interpretation, and request ordering | `src/lib/beratung.ts` |
| Advice HTTP transport | `src/lib/beratung-http.ts` |
| Catalogue validation, grouping, and Markdown export | `src/lib/massnahmenkatalog.ts` |
| AI provider, model, effort, and availability | `src/lib/ai-config.ts` |
| Provider calls, prompt caching, and token usage logging | `src/lib/ki-anbieter.ts` |
| Operator content: folder, loading, product name, footer | `src/lib/inhalte.ts`, examples in `inhalte/` |
| Reply protocol sent to the model | `src/lib/beratung-protokoll.ts` |
| Advice prompt composition | `src/lib/beratung-prompt.ts` |
| Product name in the browser, logo | `src/components/marke.tsx`, `public/marke/` |
| Order of every advice request, provider slot release | `src/lib/ki-anfrage.ts` |
| AI request limits | `src/lib/ki-limit.ts` |
| Saved assessment format, validation, overview, and comparison | `src/lib/bewertung.ts` |
| Optional account availability | `src/lib/konto-config.ts` |
| Account services wiring (auth, database, mail); test override | `src/lib/konto-dienste.ts` |
| Sign-in, sessions, and code emails | `src/lib/auth.ts`, `src/lib/mail.ts` |
| Saved assessments, profile, deletion window, admin queries | `src/lib/bewertungen.ts`, `src/lib/konten.ts`, `src/lib/admin.ts` |
| Database schema and migrations | `src/lib/db/schema.ts`, `drizzle/` (generated) |
| Tab state and auto-save in `/check` | `src/components/check/sitzungsspeicher.ts`, `src/lib/bewertung-speicher.ts` (`use-bewertung-speicher.ts` only binds it to React) |
| Pages, components, and API adapters | `src/app/`, `src/components/` |

Keep domain rules in their owning modules. React components and route handlers
should use those interfaces instead of maintaining their own score, catalogue,
or request-ordering logic. Use the existing `@/*` alias for imports from `src/`.
Follow the style of adjacent code; there is no configured formatter.

## Behavior to preserve

- Skipped answers affect neither earned nor possible points. Maturity levels
  use the absolute cutoffs 10, 22, 34, and 45, even for partial assessments.
- Server advice routes validate answers with `leseReifegrad` and derive their
  own evidence. Client-provided scores and question text are not authoritative.
- A failed catalogue refresh keeps the last accepted catalogue. Acceptance
  requires valid fields, canonical category labels, and valid classifications.
  The generation target of 8 to 12 measures is not a validation limit.
- Advice request revisions prevent stale responses from updating newer state,
  even if cancellation is ignored. Returning to a conversation must not send a
  second introduction.
- The application must build and serve the assessment with no environment file.
  AI credentials and account settings remain optional, server-side, and
  runtime-only. AI provider, model, and effort come only from the environment;
  do not add model IDs to code.
- The advice prompt stays the first, unchanged prompt block of
  chat and catalogue requests so providers can cache it. Put request-specific
  context after it. A database outage must not break `/` or `/check`.
- Nothing that works without login may require login. Accounts only add saving,
  comparison, and administration.
- Saved assessments store answers and context, never scores. Scores are always
  recomputed. Increase `FRAGEBOGEN_VERSION` when questions, options, or scoring
  change; a pinned fingerprint test fails until you do.
- Every saved-assessment query is scoped to the owning user. Admin access comes
  only from `ADMIN_EMAILS`. State-changing account routes reject foreign origins.
- Account deletion marks the account and signs out all sessions; data is removed
  30 days later unless the member signs in and restores it.
- Do not hard-code an operator's name, contact, logo or advice texts. They come
  from the content folder at request time, so one image serves any operator.

## Changing AI content or deployment

Read [docs/ai/README.md](docs/ai/README.md) and [docs/content.md](docs/content.md)
before editing the prompt or the content loading. Never commit a real
deployment's content, host names, addresses or settings to this repository.
Preserve `RÜCKFRAGE:`, `OPTION_A:`, `OPTION_B:`, `OPTION_C:`, and
`[KATALOG_AKTUALISIEREN]`. Keep the catalogue route's JSON schema authoritative.

If content files move, update `inhalte.ts`, the Dockerfile copy step,
documentation links, and the route integration checks. File-read errors fall
back to empty strings, so a successful request alone does not prove the files
were loaded; the start log reports unusable files.

## Verification

Use `npm ci` with the existing lockfile, then run checks appropriate to the change:

```bash
npm run check
```

The tests use Node's test runner through `tsx`. Inject fake or deferred adapters
for domain tests; route integration tests use loopback Anthropic and OpenAI
endpoints.
Account tests run Better Auth and the routes against in-process PGlite with a
captured mail transport (`tests/konto-fixtures.ts`). Keep automated tests free
of paid provider requests and real email. Add regression coverage when changing
scoring, validation, request ordering, runtime file loading, access control, or
the database schema. After changing `src/lib/db/schema.ts`, run
`npx drizzle-kit generate` and commit the new migration.

For prose-only changes, check links, paths, commands, and consistency with code.
For runtime file moves, also run the route tests and verify container packaging.
For UI changes, exercise the affected flow at desktop and narrow viewport sizes.
See [docs/development.md](docs/development.md) for the manual checks.

`npm run check` is the local passing gate: lint with no warnings, TypeScript,
tests, and a production build. CI runs the same checks plus secret scanning and
production dependency auditing. `npm run build` does not lint.
Report what passed and any checks blocked by the environment.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
