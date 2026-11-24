# Deployment and operations

The application needs Node.js 22. Member accounts additionally need PostgreSQL;
without account settings it needs no database or persistent volume. The
repository Dockerfile builds a standalone Next.js server, runs as the `node`
user, and listens on `0.0.0.0:3000`.

## Runtime configuration

| Variable | Purpose | Required |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic key for category explanations, advice, and catalogue | One provider key for AI features |
| `OPENAI_API_KEY` | OpenAI key for the same AI features | One provider key for AI features |
| `AI_MODEL` | Model ID at the chosen provider, for example `claude-sonnet-4-6`; no built-in default | For AI features |
| `AI_PROVIDER` | `anthropic` or `openai`; blank uses the provider whose key is set, Anthropic first | No |
| `AI_EFFORT` | Effort level passed to the provider unchanged; blank uses the provider default | No |
| `DATABASE_URL` | PostgreSQL connection string | Only for accounts |
| `BETTER_AUTH_SECRET` | Signs sessions and hashes codes; at least 32 random characters (`openssl rand -base64 32`) | Only for accounts |
| `BETTER_AUTH_URL` | Public URL without trailing slash, for example `https://kompass.example.org` | For accounts in production |
| `MAILERSEND_API_KEY` | MailerSend API token for sign-in and deletion codes | Only for accounts |
| `MAIL_FROM` | Sender address verified in your MailerSend account; no production default | For accounts in production |
| `MAIL_FROM_NAME` | Sender display name; defaults to the product name in `betreiber.json` | No |
| `TRUSTED_PROXY_IP_HEADER` | Header that the reverse proxy replaces with the client IP, for example `x-real-ip`. Blank means no header trust, so all clients share rate limits; see [Proxy trust and AI limits](#proxy-trust-and-ai-limits) | No, but set it behind a proxy |
| `KI_GLOBAL_MAX_REQUESTS` | Process-wide AI request budget per 15 minutes; defaults to 1,200 | No |
| `KI_MAX_PARALLEL` | Active provider requests per process; defaults to 8 | No |
| `ADMIN_EMAILS` | Comma-separated addresses with access to `/admin` | No |
| `KOMPASS_INHALTE_DIR` | Folder with the operator's texts, product name and footer; defaults to `inhalte/`. See [operator content](content.md) | No |
| `PORT` | Listening port | Container defaults to `3000` |
| `HOSTNAME` | Listening interface for the standalone server | Container defaults to `0.0.0.0` |

AI features stay off until a provider key and `AI_MODEL` are set; advice
endpoints then return HTTP 503 with `AI_UNAVAILABLE`. At start the server logs
`KI aktiv: <provider>, Modell <model>.`, or `KI deaktiviert. Fehlende
Einstellungen: …` when some AI settings are present but incomplete. See
[AI provider and model](#ai-provider-and-model).

Accounts turn on only when the database, secret, valid HTTPS public origin,
MailerSend settings and explicit sender address are all present in production.
Sign-in and deletion emails use the configured public origin, including in test
deployments. If `DATABASE_URL` is set but other settings are missing, the server
logs which ones at start. Changing `BETTER_AUTH_SECRET` signs everyone out and
invalidates pending codes.

Pages check feature availability at request time. The same image can therefore
run with or without AI settings or accounts. Set secrets only in the runtime
environment; the build needs no secrets or build arguments. Restart or redeploy
after changing variables. Changing keys does not require an image rebuild.

## AI provider and model

AI uses Anthropic or OpenAI. Set one provider key and `AI_MODEL`:

- `AI_PROVIDER` selects the provider. Without it, Anthropic is used when
  `ANTHROPIC_API_KEY` is set, otherwise OpenAI.
- `AI_MODEL` is passed to the provider unchanged, for example
  `claude-sonnet-4-6`. The application has no default model; choose one that
  your provider account offers.
- `AI_EFFORT` is optional and passed unchanged, to Anthropic as
  `output_config.effort` and to OpenAI as `reasoning.effort`. Not every model
  accepts every level; an unsupported value makes provider requests fail.

All three advice routes use the same model. Models that think or reason before
answering spend part of the output token limit (1,500, 4,000 and 8,000 tokens) on
it. After changing the model or effort, check explanations, follow-up questions
and catalogues. Roll back by restoring the previous values and restarting.

### Prompt caching

Chat and catalogue requests begin with the same advice prompt, unchanged across requests, routes and users. Anthropic requests mark it for
caching, and chat requests also cache the conversation for the next turn. OpenAI
caches prompt prefixes of 1,024 tokens or more automatically; requests share one
`prompt_cache_key`. Cached input is billed at a fraction of the normal input
price. Cache entries expire after a few minutes without use, so the first
request after a quiet period writes the cache again.

### Token usage log

Every provider call logs one line when it ends, also when it is cancelled or
fails:

```text
KI-Nutzung {"route":"chat","anbieter":"anthropic","modell":"claude-sonnet-4-6","eingabeGesamt":15420,"cacheGelesen":15000,"cacheGeschrieben":300,"ausgabe":412,"ende":"end_turn","dauerMs":5321}
```

| Field | Meaning |
| --- | --- |
| `route` | `chat`, `katalog` or `erklaerung` |
| `eingabeGesamt` | All input tokens, including cached ones |
| `cacheGelesen` | Input tokens served from the cache |
| `cacheGeschrieben` | Input tokens written to the cache; OpenAI may report 0 |
| `ausgabe` | Output tokens, including thinking or reasoning |
| `ende` | Provider stop reason. `max_tokens` or `max_output_tokens` means a truncated answer; `abgebrochen` or `fehler` means the call did not finish |
| `dauerMs` | Time from the request to the end of the answer |

Token fields are `null` when the call ended before the provider reported them.
The line contains no prompts, answers, names or keys. When caching works,
`cacheGelesen` covers most of `eingabeGesamt` for chat and catalogue requests
that follow each other within a few minutes. Read the lines with
`docker logs <container> 2>&1 | grep KI-Nutzung`.

## Build and run with Docker

Run these commands from the repository root. The build needs outbound access
for the Node base image and npm packages. Fonts are part of the repository.

```bash
docker build --tag reform-kompass:local .
docker run --detach --rm --init \
  --name reform-kompass-local \
  --publish 127.0.0.1:3000:3000 \
  reform-kompass:local
docker ps --filter name=reform-kompass-local
```

Once the container reports healthy:

```bash
curl --fail http://localhost:3000/-/healthz
docker logs --tail=100 reform-kompass-local
```

Open [localhost:3000/check](http://localhost:3000/check) and exercise the
assessment. To enable AI in this preview, add `--env-file .env.local` before
the image name in `docker run`. Stop and remove the preview with:

```bash
docker stop reform-kompass-local
```

The final image copies `.next/standalone`, `.next/static`, `public`, `inhalte/`,
and the SQL migrations in `drizzle/`. `src/lib/inhalte.ts` reads the
[operator content](content.md) from `inhalte/` in the server's working directory,
`/app` in the image, or from `KOMPASS_INHALTE_DIR`. Developer guides in `docs/`
are not runtime inputs.

Every push to `main` that passes the checks also publishes the image as
`ghcr.io/projecttogether/reform-kompass`, with the tags `main` and
`sha-<commit>`. Pin the digest you tested in deployments.

If packaging a standalone server outside Docker, include those static assets
and `inhalte/` with the same relative paths. The reader returns an empty string
for an unreadable file, so a successful build or health response does not
establish that the content is present; the start log does.

### Verify packaged content

After building the image above, check the content files as the image's default
`node` user. This command needs no credentials and makes no provider requests:

```bash
docker run --rm --network none --entrypoint node reform-kompass:local -e '
  const fs = require("node:fs");
  for (const name of ["system-prompt.md", "knowledge-base.md", "betreiber.json"]) {
    const file = "/app/inhalte/" + name;
    if (!fs.readFileSync(file, "utf8").trim()) throw new Error("Empty content file: " + file);
    console.log("Readable and nonempty: " + file);
  }
'
```

The command fails if either file is missing, unreadable, or empty. The
[route integration tests](development.md#tests) separately verify that both
Markdown files reach chat and catalogue provider requests. Run both checks after
moving content files; the health endpoint alone does not cover content loading.

## Hosting

The image runs on any host with Docker. Set the runtime variables, use the
image's health check, and put a reverse proxy in front that terminates HTTPS.
Port 3000 does not need public exposure. For separate rate limits per client,
the proxy must replace a header with the client's address; see
[proxy trust and AI limits](#proxy-trust-and-ai-limits).

## Member accounts

Accounts are optional and can be enabled later without rebuilding the image.

1. **Database.** Run PostgreSQL next to the application, reachable only from
   it, and use its connection URL as `DATABASE_URL`. Configure
   scheduled PostgreSQL backups, retention and protected off-host storage, and
   test a restore. Verify which volumes any server snapshot actually includes.
   Take a `pg_dump` before risky migrations as well.
2. **Settings.** Set the variables from [runtime configuration](#runtime-configuration)
   as runtime variables only. Use a new `BETTER_AUTH_SECRET` per environment.
3. **Email.** Verify your own sender domain/address in MailerSend and set
   `MAIL_FROM` explicitly. Use a token with email sending access only.
4. **Deploy.** At start the server applies pending migrations from `drizzle/`
   and logs `Datenbankmigrationen angewendet.` It waits at most 15 seconds for
   this. If the database is unreachable, the error is logged, account pages
   fail, the assessment keeps working, and migration is retried in the
   background (at most every minute) until it succeeds.
5. **Admins.** List admin addresses in `ADMIN_EMAILS`, redeploy, sign in at
   `/anmelden`, and open `/admin`.

Accounts marked for deletion are removed 30 days later by a timer in the server
process, at start and every six hours. With several replicas each runs it; the
removal is idempotent. Migrations at start assume one replica during deploys.

Login sessions last 30 days and are stored in the database, so deployments and
restarts keep members signed in. Admin rights additionally need a sign-in from
the last 24 hours; `/admin` asks older sessions for a new code. Rate-limit
counters live in process memory and reset on restart.

### Test environment

Run a second deployment of the same image with its own PostgreSQL, its own
`BETTER_AUTH_SECRET`, and
`BETTER_AUTH_URL=https://kompass-test.example.org` (or the chosen test
domain). Never point test and production at the same database. Test sign-ins
send real emails through MailerSend.

## Security headers

`next.config.js` sends these with every response: a Content-Security-Policy
with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'` and `img-src 'self' data: blob:`, plus `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
and a `Permissions-Policy`. `X-Powered-By` is off. The image rule keeps Markdown in
AI replies from loading images from other hosts. The policy has no `script-src`
yet: Next.js needs per-request nonces and dynamic rendering for that. Do not
embed the app in frames on other sites; `frame-ancestors` blocks it. Check the
headers after deployment with `curl -sI https://<domain>/`.

## Health checks

`GET /-/healthz` returns HTTP 200, `Cache-Control: no-store`, and JSON containing
`status: "OK"` and an ISO timestamp. It makes no provider calls and checks no
credentials, AI files, or the database.

The Docker check calls this route on loopback every 30 seconds, with a
five-second timeout, a 20-second start period, and three retries. Its fetch has
a four-second timeout. A healthy container means the app process responds;
exercise the assessment and enabled AI features separately after deployment.

## Sessions, data, and updates

Questionnaire context, answers, results, conversations, and catalogues are kept
in the browser's `sessionStorage` under `kompass_sitzung`. A reload in the same tab
restores them; closing the tab discards them. Deployments do not affect them.

AI requests send municipal context, official base data, and assessment evidence to
the configured provider, Anthropic or OpenAI. With Anthropic, the chat model may
also run Anthropic's web search with queries it derives from the conversation,
usually naming the municipality. The server itself requests public municipal
politics data from Wikidata and, for municipalities with an OParl system, from
their council information system; these requests contain only the municipality
key or the system's paper list URL. Chat and catalogue requests also send
conversation content; catalogue updates include the previously accepted
catalogue. OpenAI requests set `store: false`, so responses are not kept for
retrieval through the API. Application memory behavior does not describe the
provider's retention policies.

Signed-in members' assessments, profiles, accounts, and sessions are stored in
PostgreSQL. Signing out clears the state of the tab that signs out; other open
tabs keep their state but stop saving. See
[architecture](architecture.md#member-accounts) for saving and deletion rules.

Advice routes are rate limited by shared anonymous identity or trusted client IP,
by signed-in account, and by a process-wide budget. Code requests are limited by
shared identity or trusted IP and by email address (5 per 10 minutes, 20 per
day). Account and admin routes require a session. Each account may store 200
assessments in at most 20 MiB of database space and save 240 times per 15
minutes. See [proxy trust and AI limits](#proxy-trust-and-ai-limits).

Deploy code and AI content changes from Git. Roll back by deploying a previous
commit or image.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| AI endpoint returns 503 | A provider key and `AI_MODEL` are set and the process has restarted; see the `KI deaktiviert` start log |
| AI endpoint returns 500 after changing settings | `AI_MODEL` exists at the chosen provider and accepts `AI_EFFORT`; the server log shows the provider error |
| AI endpoint returns 500 | Provider credentials, connectivity, provider response, and server logs |
| Docker COPY reports missing content files | `inhalte/` is committed and included in the build context |
| Advice loses its expected context, or the name or footer is neutral | Server log for `Inhalte unvollständig`; the files exist in `/app/inhalte/` and are readable by the `node` user |
| Catalogue refresh fails | The previous catalogue remains available; retry after resolving the request failure |
| Proxy reports no available server | Container logs, listening port, and image health status |
| No sign-in link appears | Server log line `Konten deaktiviert. Fehlende Einstellungen: …` |
| Account pages fail after deploy | Server log for `Datenbankmigration fehlgeschlagen`, database reachability from the container |
| Sign-in codes do not arrive | Server log for MailerSend errors, MailerSend activity, spam folder; each address gets 5 codes per 10 minutes and 20 per day |
| Saving shows "Speicherplatz voll" | The account reached 200 assessments or 20 MiB of stored states; the member deletes older assessments |
| Saving answers with 403 `HERKUNFT` | `BETTER_AUTH_URL` matches the browser Origin, including scheme and port |

## Proxy trust and AI limits

By default, forwarded headers are ignored. Anonymous AI visitors share a limit
of 120 requests per 15 minutes; signed-in members receive 240 per account. Better
Auth uses its shared per-endpoint limiter when no trusted IP header is configured.
This also applies under direct `next start`, since incoming forwarded headers
are not proof that a request passed through a trusted proxy. The shared default
lets one client lock everyone out: 30 code requests per 10 minutes block sign-in
for all addresses, and 120 AI requests per 15 minutes block anonymous AI. Set a
trusted header for public deployments.

For per-IP counters behind a reverse proxy:

1. Make the application port reachable only from that proxy, not from the public
   network or untrusted containers.
2. Configure the proxy to replace a chosen header, such as `X-Real-IP`, with one
   actual client IP. Remove any incoming copy. Do not pass through a supplied
   value or append a comma-separated chain. If using several proxies, establish
   this guarantee at the final proxy using its own trusted-upstream configuration.
3. Set `TRUSTED_PROXY_IP_HEADER=x-real-ip` and restart. The same opt-in controls
   AI and Better Auth. Then [verify the header](#verify-the-trusted-header), and
   check that direct access to the application port fails.

Missing, invalid or multi-value IPs share an unknown-client counter. IPv6
clients count per /64 network, as in Better Auth, so one host cannot rotate
addresses within its network; IPv4-mapped addresses count as IPv4. Neither `Host` nor `X-Forwarded-Host` determines
allowed account origins; the full Origin must match `BETTER_AUTH_URL` exactly,
including scheme and non-default port. The configured account URL must use HTTPS
in production.

Each process additionally accepts at most 1,200 AI requests per 15 minutes and
8 simultaneous provider calls by default. Eight slots accommodate five category
explanations together with the initial chat and catalogue. Lowering this limit
can cause transient 429 responses during that flow; failed explanations can be
retried by returning to the results. The limits can be lowered or raised with
`KI_GLOBAL_MAX_REQUESTS` and `KI_MAX_PARALLEL`. Invalid values retain defaults.
Requests already rejected by their identity limit do not consume the shared
budget. Provider calls have a 120-second timeout and SDK retries are disabled;
the catalogue UI still has its bounded retry policy.

Counters and slots are shared within one server process and reset on restart.
For several replicas, enforce a shared edge limit. Configure provider spend
limits and alerts independently; request counts do not constitute a financial
budget. Set proxy body and connection timeouts too. AI bodies are bounded to
128 KiB while reading; auth/profile/deletion bodies and admin forms to 16 KiB,
and saved assessments to 4 MiB. Oversized bodies return 413 before JSON parsing.

The browser sends a recent history of at most 40 messages and 40,000 characters,
with at most 20,000 characters per message. Full saved conversations are retained.
Context fields allow 300 characters. Schema and canonical answer validation run
before any provider call.

### Verify the trusted header

This check needs accounts enabled; otherwise every request returns 404. Better
Auth allows each client three requests per 10 seconds on
`/api/auth/change-password`, a path this application does not use, so the check
affects nobody for longer than that. Send four requests, each with a different
forged `X-Real-IP`:

```bash
URL=https://kompass.example.de
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/api/auth/change-password" \
    -H "content-type: application/json" -H "origin: $URL" \
    -H "X-Real-IP: 203.0.113.$i" --data '{}'
done
```

Within 10 seconds, send the same request once from another network, such as a
phone hotspot or another server.

| Result | Meaning |
| --- | --- |
| `400 400 400 429`; other network `400` | Forged headers are ignored, and each client has its own counter |
| `400 400 400 429`; other network `429` | The application does not use the header: the variable is missing, or the application was not restarted |
| Four times `400` | Forged headers reach the application: clear the variable and restart |

Without accounts, use the AI limit instead; AI must be enabled. Requests to
`/api/erklaerung` with the body
`{"orgName":"X","kategorie":"personal","antworten":{}}` are answered without a
provider call. Send 121, each with a different forged `X-Real-IP`. The 121st
must return 429, and a request from another network must still return 200. This
blocks your own address from AI for 15 minutes. If the application does not use
the header, it blocks anonymous AI for every visitor for that time.

## Before promoting a hosted deployment

Publish operator-reviewed German privacy and imprint information, describe
provider recipients and storage, and warn users against entering confidential
case data. Confirm processor, deletion and backup-retention responsibilities.
Source visibility alone does not satisfy these service obligations. Record
incident and credential-rotation evidence privately; do not copy secrets or
internal operational records into public documentation.
