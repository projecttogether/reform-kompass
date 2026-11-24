# Development

## Local setup

Use Node.js 22, matching `.nvmrc`, `package.json`, and the Dockerfile.

```bash
nvm use
npm ci
npm run dev
```

The development server runs at [localhost:3000](http://localhost:3000).
`./start.sh` starts the same server from the repository directory. For a
different port, use `npm run dev -- --port 3001`.

No environment file is required. To enable advice, copy
[.env.local.example](../.env.local.example) to `.env.local`, then set
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` and `AI_MODEL`. The server logs
`KI aktiv: …` at start, or which settings are missing. Restart the server after
changing these settings. Keep credentials out of Git.

## Member accounts locally

Start PostgreSQL in Docker and print sign-in codes to the server log instead of
sending email:

```bash
docker run -d --name kompass-pg -e POSTGRES_PASSWORD=kompass -e POSTGRES_DB=kompass \
  -p 127.0.0.1:5432:5432 postgres:17-alpine
```

Add to `.env.local`:

```bash
DATABASE_URL=postgres://postgres:kompass@127.0.0.1:5432/kompass
BETTER_AUTH_SECRET=local-development-secret-at-least-32-chars
KONTO_MAIL_KONSOLE=1
ADMIN_EMAILS=you@example.org
```

`npm run dev` applies migrations at start. `KONTO_MAIL_KONSOLE` only works
outside production; `BETTER_AUTH_URL` defaults to `http://localhost:3000` there.

After changing [schema.ts](../src/lib/db/schema.ts), generate and commit a
migration with `npx drizzle-kit generate --name <change>`. Do not edit applied
migrations.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | All module and route tests through `tsx --test` |
| `npx tsc --noEmit --incremental false` | Type check without emitting files or an incremental cache |
| `npm run build` | Production build and TypeScript validation |
| `npm start` | Start an existing production build from the repository |
| `npm run check` | Lint with no warnings, type check, tests, and production build |
| `npm run typecheck` | Type check without output or incremental cache |
| `npm run lint` | ESLint with the Next.js core web vitals and TypeScript flat configs |

ESLint uses [eslint.config.mjs](../eslint.config.mjs). Run
`npm run check` before requesting review; warnings fail this gate. The build
checks TypeScript but does not run ESLint. CI runs those steps separately and
also runs a redacted Gitleaks history scan and `npm audit --omit=dev`.
See [dependency maintenance](dependencies.md) for supported tool versions and
remaining upstream tooling advisories.

Fonts are committed under `src/app/fonts/` and loaded with `next/font/local`, so
builds need no access to Google. Package installation needs registry access.
Neither operation needs an AI key.
Use the [Docker deployment procedure](deployment.md#build-and-run-with-docker)
to validate the standalone production artifact.

## Tests

Tests use Node's built-in test runner with `tsx`; there is no browser test suite.

| File | Coverage |
| --- | --- |
| [reifegrad.test.ts](../tests/reifegrad.test.ts) | Answer validation, scores, cutoffs, skips, and evidence |
| [massnahmenkatalog.test.ts](../tests/massnahmenkatalog.test.ts) | Catalogue acceptance, grouping, and export |
| [beratung.test.ts](../tests/beratung.test.ts) | Conversation flow, follow-ups and streamed reply display, failures, cancellation, and stale replies |
| [advice-routes.test.ts](../tests/advice-routes.test.ts) | Real route handlers and SDK requests against a loopback model endpoint, full content loading from both Markdown files in `inhalte/`, the reply protocol, provider slot release on every path, and browser payloads |
| [inhalte.test.ts](../tests/inhalte.test.ts) | Content folder, reply protocol, operator settings, defaults, and product name in emails |
| [bewertung.test.ts](../tests/bewertung.test.ts) | Saved assessment validation, recomputed overview, comparison, and the questionnaire version fingerprint |
| [bewertung-speicher.test.ts](../tests/bewertung-speicher.test.ts) | Auto-save against an in-memory server: debounce and order, lost replies, conflicts, retries, relinking after reload, create-once, and the account and storage limits |
| [sitzungsspeicher.test.ts](../tests/sitzungsspeicher.test.ts) | Legacy tab-state recovery and migration without losing valid answers or conversation |
| [konten.test.ts](../tests/konten.test.ts) | Code sign-in through Better Auth, session length, per-address code limits per 10 minutes and per day, deletion codes, restore window, removal, and the MailerSend payload |
| [konto-routes.test.ts](../tests/konto-routes.test.ts) | Ownership checks, origin checks, account and admin routes, admin re-sign-in, overview lists, storage budget, assessment limit under parallel saves, save rate limit, disabled accounts, and AI rate limits |
| [anfragen.test.ts](../tests/anfragen.test.ts) | Streamed body limits, request schemas, proxy trust, IPv6 /64 identities, exact origins, provider history, concurrency and shared budgets |
| [sicherheitsheader.test.ts](../tests/sicherheitsheader.test.ts) | Security headers and Content-Security-Policy in `next.config.js` |

Run one file with `npx tsx --test tests/beratung.test.ts`. The suite supplies
fake credentials and local provider responses where needed. Account tests run
migrations on in-process PGlite and capture emails, so they need no database or
MailerSend. The suite makes no external model or email calls and does not
validate the quality of live model output.

## Manual checks

For assessment or UI changes, check the affected flow on desktop and a narrow
viewport:

1. Open `/check` with no keys. Enter a municipality, answer some questions, skip
   others, and inspect the score and completeness information.
2. Return to the questions, change an answer, and inspect the updated result.
   With AI enabled, confirm new explanations and catalogue requests use the new
   answers, the existing conversation remains, and no second introduction is sent.
   Reload while on the questions and confirm the tab still resumes correctly.
   Use a loopback provider for automated browser checks; never use a real key.
3. Focus the municipality combobox by its label. Type a name, use ArrowDown,
   ArrowUp, Enter and Escape, and check its listbox/active-option relationships.
4. With advice enabled, check category explanations, the first conversation
   reply, follow-up choices, and catalogue refresh and PDF export.
5. Confirm that returning to the conversation preserves it without another
   introduction. A failed refresh should leave the accepted catalogue visible.

With [accounts enabled](#member-accounts-locally):

6. Signed out, finish an assessment, choose "Speichern", sign in with the code
   from the log, and confirm `/check` shows "Gespeichert". Change an answer and
   confirm `/konto` reflects it.
7. Start a new assessment from `/konto`; the context is pre-filled from the
   profile. Compare two assessments. Open, reload, and delete one.
8. Sign out and confirm `/check` starts empty. As an admin, open `/admin`, view
   an assessment, and mark an account for deletion; sign in as that member and
   restore it. Delete an account with the emailed code.

Live AI checks use the configured provider accounts. Use the automated deferred
adapter tests for advice failure and stale-response scenarios.

## Editing content

Edit landing-page copy in [src/app/page.tsx](../src/app/page.tsx), assessment UI
copy in [check.tsx](../src/components/check/check.tsx), and questions in
[reifegrad-model.ts](../src/lib/reifegrad-model.ts). Keep user-facing language
German. Styling combines Tailwind classes, global CSS, and inline styles in the
larger page components.

Advice texts, product name, footer and logos are [operator content](content.md).
The files in `inhalte/` are neutral examples; keep real deployments' content out
of this repository. See [AI content](ai/README.md) for the prompt. Keep both
Markdown files in German and developer explanations in English under `docs/`.

Municipality data combine three official `.xlsx` downloads, matched by the
official municipality key:

| Source | Publisher | Updated | Last used (checked 2026-11-05) |
| --- | --- | --- | --- |
| [Municipality directory](https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html), "Gemeinden in Deutschland nach Fläche, Bevölkerung und Postleitzahl" | Destatis | Quarterly | Territory 30.09.2026, population 31.12.2025 |
| [Integrated municipal debt](https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Schulden-Finanzvermoegen/_inhalt.html), "Integrierte Schulden der Gemeinden und Gemeindeverbände", table volume | Destatis | Yearly (autumn) | 31.12.2025 |
| [Municipal employment data](https://statistik.arbeitsagentur.de/DE/Navigation/Footer/Top-Produkte/Gemeindedaten-sozialversicherungspflichtig-Beschaeftigter-Nav.html), "Gemeindedaten der sozialversicherungspflichtig Beschäftigten nach Wohn- und Arbeitsort" | Bundesagentur für Arbeit | Yearly | 30.06.2025 |

The script uses only the Python standard library:

```bash
python3 -I scripts/kommunen-aktualisieren.py path/to/AuszugGV.xlsx --schulden path/to/integrierte-schulden-tabellenband.xlsx --beschaeftigung path/to/gemband-dlk.xlsx
```

It rewrites both files in `src/data/`, prints how many municipalities each
source covers, and stops if a format changed or two municipalities cannot be
told apart. City states have no debt figures in the debt table. Then run
`npx tsx --test tests/kommunaldaten.test.ts`. Both publishers allow reuse with
attribution; the advice prompt names each source and date.

Refresh the municipality-to-OParl mapping occasionally, after the
municipality data (it only keeps valid municipality keys). It queries the OParl
endpoint directory, each listed council information system, and Wikidata:

```bash
python3 -I scripts/oparl-aktualisieren.py
```

It rewrites `src/data/oparl-koerperschaften.json` and lists systems it could
not reach.

Refresh the structure data from the
[Wegweiser Kommune](https://www.wegweiser-kommune.de/open-data) (Bertelsmann
Stiftung, CC0; checked 2026-11-05, latest actual values 2023, broadband 2022,
projection to 2040) about once a year:

```bash
python3 -I scripts/wegweiser-aktualisieren.py
```

It queries the REST interface (at most 100 regions per request, about 70
requests) and rewrites `src/data/kommunen-wegweiser.json`. It stops if the year
axis or the number of regions looks wrong. Then run
`npx tsx --test tests/kommunaldaten.test.ts`.

Run `npx tsx --test tests/advice-routes.test.ts` after changing runtime AI content.
For file moves, also update the shared reader, Dockerfile, and links, then build
the image and run the [packaging check](deployment.md#verify-packaged-content).
Developer documentation edits need checks of links, paths, commands, and code
consistency; they do not require another application build.
