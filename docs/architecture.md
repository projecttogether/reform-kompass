# Architecture and domain rules

Reform-Kompass is one Next.js application. App Router pages render the
landing page and assessment. Browser components own presentation;
modules in `src/lib/` own domain rules. Route handlers connect those modules to
the configured AI provider (Anthropic or OpenAI) and, when member accounts are
configured, to PostgreSQL. There is no
job queue; a timer in the server process removes expired accounts.

## Module map

| Module | Responsibility |
| --- | --- |
| [reifegrad-model.ts](../src/lib/reifegrad-model.ts) | Questionnaire, categories, scoring, input validation, and evidence formatting |
| [beratung.ts](../src/lib/beratung.ts) | Conversation state, explanations, follow-up parsing, and catalogue request ordering |
| [beratung-http.ts](../src/lib/beratung-http.ts) | Browser transport for the three advice endpoints |
| [massnahmenkatalog.ts](../src/lib/massnahmenkatalog.ts) | Catalogue acceptance, metadata, grouping, and Markdown export |
| [ai-config.ts](../src/lib/ai-config.ts) | AI provider, model and effort from the environment; request-time availability |
| [ki-anfrage.ts](../src/lib/ki-anfrage.ts) | Fixed order of every advice request (settings, budget, body, provider slot, provider call, response), slot release on every path, advice prompt first |
| [ki-anbieter.ts](../src/lib/ki-anbieter.ts) | Anthropic and OpenAI calls, prompt caching of the shared advice prompt, token usage log |
| [inhalte.ts](../src/lib/inhalte.ts) | Operator content: folder, prompt files, product name and footer, start log |
| [beratung-prompt.ts](../src/lib/beratung-prompt.ts) | Advice prompt: operator instructions, reply protocol, operator reference material |
| [beratung-protokoll.ts](../src/lib/beratung-protokoll.ts) | The reply protocol the model must follow, as part of the code |
| [kommunen.ts](../src/lib/kommunen.ts) | Municipality display text, shared by the picker and the server lookup |
| [kommunaldaten.ts](../src/lib/kommunaldaten.ts) | Official municipal base data and Wegweiser Kommune structure data lookup, and their advice prompt section |
| [kommunalpolitik.ts](../src/lib/kommunalpolitik.ts) | Mayor (Wikidata) and recent council papers (OParl): background loading, shared cache, prompt section |
| [websuche.ts](../src/lib/websuche.ts) | Web search tool settings, search instructions, and the cited-source list for chat |
| [use-beratung.ts](../src/components/check/use-beratung.ts) | React subscription and the temporary catalogue update indicator |
| [bewertung.ts](../src/lib/bewertung.ts) | Saved assessment format and validation, overview, and comparison |
| [ki-limit.ts](../src/lib/ki-limit.ts) | Per-account, client and process-wide AI budgets and provider concurrency |
| [proxy.ts](../src/lib/proxy.ts) | Explicit trusted proxy IP header and canonical client identity (IPv6 per /64) |
| [anfrage.ts](../src/lib/anfrage.ts) | Streaming body-byte limits before parsing |
| [beratung-anfrage.ts](../src/lib/beratung-anfrage.ts) | Bounded advice request schemas |
| [ki-verlauf.ts](../src/lib/ki-verlauf.ts) | Bounded recent provider history, separate from saved conversation |
| [konto-config.ts](../src/lib/konto-config.ts) | Request-time account availability from optional settings |
| [konto-dienste.ts](../src/lib/konto-dienste.ts) | Wires auth, database, and mail from settings; test override; session lookup |
| [auth.ts](../src/lib/auth.ts) | Better Auth with email one-time codes and 30-day rolling sessions |
| [konten.ts](../src/lib/konten.ts) | Profile, deletion codes, the 30-day restore window, and final removal |
| [bewertungen.ts](../src/lib/bewertungen.ts) | Saved assessments, always scoped to the owning user |
| [admin.ts](../src/lib/admin.ts) | Admin read models and assessment removal |
| [sitzungsspeicher.ts](../src/components/check/sitzungsspeicher.ts) | Tab state in `sessionStorage`, including the previous format |
| [bewertung-speicher.ts](../src/lib/bewertung-speicher.ts) | Creating and auto-saving a member's assessment: debounce, revisions, conflicts, retries |
| [use-bewertung-speicher.ts](../src/components/check/use-bewertung-speicher.ts) | React binding for auto-save: current state, page visibility, status |

## Assessment and scoring

The assessment collects a required municipality name and optional department and
role. Its context, question, result, and chat views are phases of `/check`, not
separate URLs. All question wording and answer options live in
`reifegrad-model.ts`.

| Category ID | English meaning | Questions | Full maximum |
| --- | --- | --- | --- |
| `strategie` | Strategy and outcomes | `f1` to `f3` | 12 |
| `fuehrung` | Leadership and culture | `f4` to `f6` | 12 |
| `personal` | Staff | `f7` to `f8` | 8 |
| `digitalisierung` | Citizen-centered services | `f9` to `f12` | 16 |
| `kooperation` | Openness, cooperation, and democracy | `f13` to `f15` | 12 |

Each question has five options with values zero through four. An omitted key
means a skipped question. Skips contribute neither earned points nor possible
points. Overall and category percentages are rounded to the nearest integer;
an empty denominator produces zero percent.

Maturity levels use absolute total points:

| Points | Level | English description |
| --- | --- | --- |
| 0 to 10 | 1 | Broad and urgent need for change |
| 11 to 22 | 2 | Broad need for action with identifiable starting points |
| 23 to 34 | 3 | Need to establish systematic practice |
| 35 to 45 | 4 | Advanced administration with specific areas for improvement |
| 46 to 60 | 5 | Highly developed administration that can serve as an example |

These cutoffs stay fixed when questions are skipped. Answering only `f1` with
four points gives 100 percent of four possible points and level 1. The model
includes completeness information and exact selected options in its evidence.

`leseReifegrad` validates incoming answer maps. Unknown question IDs, noninteger
values, and values outside zero to four fail validation. Advice routes derive
scores and evidence from those answers instead of trusting submitted totals or
question definitions.

## Advice and action catalogue

Setting an assessment context cancels earlier work, clears advice state, and
requests explanations for categories with answered questions when AI is enabled.
Starting advice sends one introduction and, at the same time, requests a first
catalogue from the assessment alone. That first catalogue is not cancelled by
the introduction. Later messages cancel a catalogue built from an older
conversation and request a new one after the reply. Returning to an existing
conversation does not send another introduction. When answers or context change,
`aktualisiereKontext` cancels obsolete work, retains the conversation, discards
its old derived output and reloads explanations and any started catalogue with
the new evidence. An unchanged context resumes missing cancelled output without
starting the conversation again.

Entering or restoring the chat resumes an unanswered user turn after cancellation
without adding another introduction. A completed conversation makes no new chat
request on reentry.

`beratung.ts` owns the committed conversation and coordinates all advice work.
Assessment revisions and catalogue request numbers determine which responses
may publish state. Abort signals reduce unnecessary work, but correctness does
not depend on providers honoring cancellation. Catalogue refreshes wait for an
active chat reply and include the committed conversation and accepted catalogue.
Error messages displayed by the client are excluded from provider history.

Chat and catalogue requests get the advice prompt through `ki-anfrage.ts`, which
calls `readAdvicePrompt()` in `beratung-prompt.ts`. It reads `system-prompt.md` and `knowledge-base.md` from the
[content folder](content.md) on each request and puts the reply protocol from
`beratung-protokoll.ts` between them. The routes add their own context and output requirements. These
Markdown files are application assets; nothing in `docs/` is needed at runtime.
An unreadable content file contributes an empty string, so route integration tests
check for the complete file contents in the outgoing provider requests.

All three advice routes also add official base data for the selected
municipality through `formatiereKommunaldaten` in `kommunaldaten.ts`. The
server looks up `orgName` by the exact display text that the municipality
picker produces, so a picked municipality resolves to one entry with its
official municipality key (AGS). Free text, such as a district, resolves to
nothing; the prompt then states that no base data exist and forbids invented
figures. The prompt section names the source and data date, and asks the model
to cite them when a recommendation relies on a figure. The client never sends
the figures; `GET /api/kommunaldaten` only shows the user what the advice uses.

The data come from the Destatis municipality directory (municipality type,
district, municipal association, population, area, density, and degree of
urbanisation), the Destatis integrated municipal debt statistics (debt per
capita, change in the year, and the state average), and the Federal Employment
Agency's municipal employment data (employees by place of work and residence,
commuters, establishments). A missing figure is stated as missing in the prompt.
See [development](development.md#editing-content) for the downloads.

Structure data from the Bertelsmann Stiftung's Wegweiser Kommune (CC0) add the
demographic type, population change over five years, median age, the 2040
projection, tax revenue and staff spending per capita, the SGB II rate, and
broadband coverage, each with its year and, where meaningful, the state value.
The portal has values only for municipalities with at least 5,000 inhabitants
and for municipal associations. A smaller municipality uses its association's
values, matched by the nine-digit regional key `verbandArs`, or else its
district's values without the finance figures; the prompt says which unit the
values describe. `scripts/wegweiser-aktualisieren.py` writes
`src/data/kommunen-wegweiser.json` from the portal's REST interface.
How the model should use all municipal data (sparingly, and only to support a
recommendation) is part of the operator's system prompt.
`scripts/kommunen-aktualisieren.py` generates both `src/data/kommunen.json` (picker list, bundled for the browser)
and `src/data/kommunen-grunddaten.json` (server only) from one file, so their
display texts stay identical. Same-named municipalities in one district get a
`zusatz`, such as their association, in the display text.

Chat and catalogue also add a municipal politics section from
`kommunalpolitik.ts`. When the user picks a municipality and AI is enabled,
`GET /api/kommunaldaten` starts loading in the background, so the data are
usually ready when advice starts. Two sources are read: the current head of
administration from Wikidata (by AGS, property P439), and papers from the last
twelve months in the municipality's council information system via OParl,
filtered by administrative modernisation topics. `scripts/oparl-aktualisieren.py`
maps municipalities to OParl systems from the OParl endpoint directory; about 75
municipalities have a reachable system. Results are shared by all users, signed
in or not: in the `kommunal_cache` table when member accounts are configured,
otherwise in process memory. Entries stay valid for 24 hours, or one hour after
a source failed; concurrent requests share one fetch. Advice waits at most five
seconds for data still loading and otherwise says they are unavailable. The
prompt marks names and titles as external data, not instructions; Wikidata is
labelled as community-maintained, and a paper is not a decision. For large
cities the six fetched pages cover only recent days; web search fills the gap.

The model can return a structured follow-up or request a catalogue refresh with
`[KATALOG_AKTUALISIEREN]`. The module removes the marker from displayed text.
See [AI content](ai/README.md) for the exact protocol and prompt composition.

The catalogue module accepts a nonempty list with nonblank titles and
descriptions, canonical German category labels, and valid classifications:

| Field | Values | Meaning |
| --- | --- | --- |
| `aufwand` | `niedrig`, `hoch` | Low or high effort |
| `verantwortung` | `eigen`, `fremd` | Within the user's authority or requiring someone else |

Measures with `verantwortung: "fremd"` must also name a decision-maker in `wer`
and the user's contribution in `eigener_beitrag`. These classifications form
the four groups shared by display and export. The sidebar exports the catalogue
as a PDF; the catalogue module also provides a Markdown export.

The prompt asks for 8 to 12 measures and an approximate distribution across
groups. Validation does not enforce that count or distribution. Invalid
generated content fails the request. A failed refresh leaves the last accepted
catalogue available and displays an error. Existing saved or tab data is read
with a compatibility helper that discards a malformed legacy catalogue while
still validating its answers and conversation. New writes always use strict
validation. Restoring a conversation without a catalogue requests a new one
when AI is enabled, without sending another introduction.

## Member accounts

Accounts are optional. `getKontoCapabilities()` enables them when
`DATABASE_URL`, a `BETTER_AUTH_SECRET` of at least 32 characters, and an email
transport are configured, plus a valid HTTPS `BETTER_AUTH_URL` and explicit
`MAIL_FROM` in production. Without them,
account routes answer 404 or 503 and pages show no sign-in links.

- **Sign-in:** `/anmelden` requests a six-digit code (`/api/auth/email-otp/send-verification-otp`)
  and signs in with it (`/api/auth/sign-in/email-otp`). Unknown addresses get an
  account on first sign-in. Codes last 10 minutes, allow 5 attempts, and are
  stored hashed. Each address receives at most 5 codes per 10 minutes and 20 per
  day, which bounds guessing at 100 attempts per address and day; further
  requests are refused before a new code replaces the last one sent. Only
  sign-in requests count, because other code types send no mail.
- **Sessions** last 30 days. The browser's `/api/auth/get-session` call on member
  pages renews the session and cookie once a day; server-side lookups use
  `disableRefresh` because they cannot update the cookie.
- **Saving:** in `/check`, signed-out visitors see "Speichern", which signs in
  and returns to `/check?speichern=1`; the tab's assessment is then saved. Signed-in
  members' assessments are created when they start the questionnaire and saved
  automatically, debounced and in order. Each save names the revision it builds
  on; if another tab saved in between, the server answers 409 and the tab stops
  saving and offers the saved version. A tab restored after a reload compares its
  revision with the server first. If that check fails for a reason other than a
  missing session or assessment, the tab keeps the link and checks again later
  instead of offering to save a second copy. A refused creation because the
  account holds the maximum number of assessments (200) or its storage budget
  (20 MiB as stored) says so. A save refused for lack of space is not retried on
  a timer; it is sent again with the next change or when the tab becomes visible. Saves are limited to 240 per account per 15
  minutes. Lists and the admin account page read only the overview fields with
  database JSON operators, so they never load whole conversations. Local and saved states are compared in the
  form the server stores them (`gespeicherteForm`). If `/check?bewertung=<id>`
  cannot be opened, the tab starts fresh with a notice instead of resuming a
  different assessment from `sessionStorage`. Saved state holds context, answers, phase,
  conversation (without client error notices), catalogue, and the questionnaire
  version the assessment was created with, validated by `leseBewertungStand`.
  Scores are recomputed when read. If a tab's conversation no longer validates,
  a reload keeps its context and answers.
- **Profile:** municipality, department, and role. They pre-fill new assessments
  and are updated whenever a member starts a questionnaire or saves a tab.
  Saved assessments keep the context they were created with.
- **Comparison** shows category percentages of two assessments and notes
  different levels, questionnaire versions, or incomplete answers.
- **Deletion:** a member confirms with a fresh emailed code. The account is
  marked, all sessions end, and the account with all assessments is removed 30
  days later. Signing in during that window offers restoration. Admins can mark,
  restore, or immediately remove marked accounts and delete assessments. Removal
  rechecks the mark under a row lock, so a restore that wins the race keeps the account.
- **Admins** are the addresses in `ADMIN_EMAILS`; there are no stored roles.
  Admin rights also need a sign-in from the last 24 hours (`ADMIN_SITZUNG_STUNDEN`,
  measured from the session's creation, which renewal does not move). Admin pages
  send older sessions to `/anmelden?erneut=1`, which asks for a new code even
  though the member is signed in; admin routes answer 403 `NEU_ANMELDEN`.

`src/instrumentation.ts` applies SQL migrations from `drizzle/` at server start,
waiting at most 15 seconds, and retries failed migrations in the background.
After the first successful migration it removes expired accounts, then every
six hours. The assessment never waits on the database.

## State lifetime and external services

| Data | Owner | Lifetime |
| --- | --- | --- |
| Assessment context, answers, results, conversation, catalogue | Browser `sessionStorage` (`kompass_sitzung`), written through `sitzungsspeicher.ts` | Until the tab closes or the member signs out; a reload restores it |
| Saved assessments, profile, accounts, sessions | PostgreSQL, when accounts are enabled | Until deleted; accounts 30 days after a deletion request |
| Category explanations | Browser page memory | Requested again after a reload |
| Advice instructions, reference examples, product name, footer | Operator content in `inhalte/` or `KOMPASS_INHALTE_DIR` | Until a file update or deployment |

AI settings are read on the server at request time; the code holds no model IDs.
Availability checks detect a configured key and model, not valid credentials, an
existing model or a healthy provider. `ki-anfrage.ts` passes the advice prompt to
`ki-anbieter.ts` as a separate first block so it stays a cacheable prefix. The health
endpoint checks only whether the application responds.

Logos and fonts are served by the application. Operators replace the logos in
`public/marke/`. Fonts are committed under
`src/app/fonts/` and loaded with `next/font/local`. See
[deployment](deployment.md) for provider data flow.
