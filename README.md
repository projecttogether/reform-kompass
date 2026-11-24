# Reform-Kompass

Reform-Kompass helps employees of German municipal administrations assess how far
their administration has modernized and identify practical next steps. It
combines a 15-question self-assessment with optional AI explanations, advice, and
an action catalogue.

The initiative Re:Form of [ProjectTogether](https://projecttogether.org) develops
it and runs it as VerwaltungsKompass. This repository holds the application with
neutral example content. Every operator brings their own advice texts, name and
logos; see [operator content](docs/content.md).

The application interface, runtime AI content, and generated advice are in
German. Developer documentation is in English. The assessment needs no account.
Optional member accounts save assessments in PostgreSQL; without account
settings the application runs without a database.

## Quick start

Use Node.js 22 and npm. The repository pins the Node major version in `.nvmrc`.

```bash
nvm use
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). If you do not use nvm, install
Node.js 22 before running the npm commands. The questionnaire and score results
work without environment variables or AI credentials.

To enable AI features, copy the example configuration, then set a provider key
and the model:

```bash
cp .env.local.example .env.local
```

| Variable | Enables |
| --- | --- |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Category explanations, advice chat, and the action catalogue |
| `AI_MODEL` | Model ID at the chosen provider, for example `claude-sonnet-4-6`; there is no built-in default |
| `AI_PROVIDER`, `AI_EFFORT` | Optional provider choice (`anthropic` or `openai`) and effort level; see [deployment](docs/deployment.md#ai-provider-and-model) |
| `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MAILERSEND_API_KEY`, `MAIL_FROM` | Member accounts; see [deployment](docs/deployment.md#member-accounts) |
| `KOMPASS_INHALTE_DIR` | Another folder with your own content; see [operator content](docs/content.md) |

All variables are optional and server-side. Next.js loads `.env.local`.
AI features stay off until a provider key and `AI_MODEL` are set. Provider requests use your
configured account and may incur charges. To try accounts locally without
MailerSend, see [development](docs/development.md#member-accounts-locally).

## What the app does

| Route | Purpose |
| --- | --- |
| `/` | Introduction to the modernization check |
| `/check` | Municipal context, questionnaire, results, advice, and catalogue export |
| `/anmelden` | Sign-in with a six-digit code sent by email (accounts only) |
| `/konto` | Member area: saved assessments, comparison, profile, account deletion |
| `/admin` | Admin area for addresses listed in `ADMIN_EMAILS` |
| `/-/healthz` | Uncached process health response, with no provider calls |

The assessment covers strategy, leadership, staff, citizen services, and
cooperation. Each answer scores zero to four points. Skipped questions do not
count toward the percentage; maturity levels use absolute point thresholds.
See the [scoring rules](docs/architecture.md#assessment-and-scoring) before
interpreting partial results.

The browser keeps the municipal context, answers, conversation, and catalogue
in `sessionStorage` for the current tab, so a reload restores them and closing
the tab discards them. Signed-in members' assessments are also saved to the
database and update automatically. AI features send relevant inputs to
the configured AI provider. The [deployment guide](docs/deployment.md) describes data flow and
storage.

## Development and checks

```bash
npm ci
npm run check
```

Tests use local substitutes for AI providers and need no credentials. The
Rubik and Fraunces fonts are committed under `src/app/fonts/`; neither builds
nor browsers contact Google. `npm run check` runs lint with no warnings,
TypeScript, tests and a production build. CI also scans the checked-out Git
history for secrets and audits production dependencies. See
[development](docs/development.md) for validation and manual checks.

The stack is Next.js 16 with the App Router, React 19, strict TypeScript,
Tailwind CSS, and the Anthropic and OpenAI SDKs. The
[package manifest](package.json) and lockfile define the installed versions.

## Deployment

The [Dockerfile](Dockerfile) produces a standalone Next.js server on port 3000,
runs as the `node` user, and includes a health check. It builds without AI keys;
configure keys only at runtime. Every passing push to `main` publishes the image:

```bash
docker run --rm --init --publish 127.0.0.1:3000:3000 ghcr.io/projecttogether/reform-kompass:main
```

Use your own content with a small image on top or with mounted folders; see
[operator content](docs/content.md). The [deployment guide](docs/deployment.md)
covers settings, health checks, and session behavior during updates.

## Documentation

- [Documentation index](docs/README.md)
- [Operator content](docs/content.md)
- [Development workflow](docs/development.md)
- [Architecture and domain rules](docs/architecture.md)
- [HTTP API](docs/api.md)
- [AI content](docs/ai/README.md)
- [Repository instructions for coding agents](AGENTS.md)

## License

The code is licensed under the [Apache License 2.0](LICENSE); see
[NOTICE](NOTICE). Not covered by it:

- **Names and logos** of ProjectTogether, Re:Form and VerwaltungsKompass; see
  [TRADEMARKS.md](TRADEMARKS.md).
- **Municipal data** in `src/data/`, which keep the terms of their sources; see
  [data sources](src/data/README.md).
- **Fonts** Rubik and Fraunces, under the SIL Open Font License; see
  `src/app/fonts/`.
- Third-party dependencies, which keep their own licenses.

See [contributing](docs/CONTRIBUTING.md) and the [security policy](docs/SECURITY.md)
before opening an issue or pull request. This is a prototype; assessment scores
and generated advice are not an external audit or an administrative decision.
