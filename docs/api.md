# HTTP API

These routes support the application's own browser client. They are not a
versioned public API. Advice routes need no authentication; account routes use
the Better Auth session cookie. Requests and responses use JSON unless noted.
German field names and enum values are part of the current contract.

## Routes

| Method and path | Purpose | Success response |
| --- | --- | --- |
| `GET /-/healthz` | Process liveness | `{ "status": "OK", "timestamp": "<ISO timestamp>" }` |
| `POST /api/erklaerung` | Explain one assessment category | `{ "erklaerung": "<text>" }` |
| `POST /api/chat` | Generate the next advice reply | Streamed `text/plain` reply |
| `POST /api/katalog` | Create or update an action catalogue | A validated `Katalog` object |
| `GET /api/kommunaldaten?name=<display text>` | Official base data the advice uses for a picked municipality; no AI call. With AI enabled it also starts loading municipal politics data in the background | `{ gefunden: true, ags, kurzfassung, quelle }` or `{ gefunden: false }` |

Advice routes allow 120 requests per 15 minutes for a shared anonymous identity,
or per IP only when a trusted proxy header is configured. Signed-in members get
240 requests per account. A process-wide budget defaults to 1,200 per 15 minutes;
at most 8 provider calls can run at once. Rejections answer 429 with `RATE_LIMITED`
and `Retry-After`. Counters are process-local. See
[proxy configuration](deployment.md#proxy-trust-and-ai-limits).

AI JSON bodies are streamed with a 128 KiB byte limit before parsing. Context
strings are capped at 300 characters, histories at 40 user/assistant messages
and 40,000 characters total, with 20,000 characters per message. Chat requires a
nonempty history ending with a user message. The browser selects recent provider
context without discarding the full saved conversation, and does not duplicate
catalogue history under a second JSON key.

## Account routes

These exist only when member accounts are configured; otherwise they answer 503
with `KONTEN_INAKTIV` (`/api/auth/*` answers 404). They answer 401 without a
session and 403 with `KONTO_VORGEMERKT` while the account is marked for
deletion, except where noted. `POST`, `PUT`, and `DELETE` requests need an
`Origin` header matching the configured full public origin, including scheme and port.

| Method and path | Purpose | Success response |
| --- | --- | --- |
| `/api/auth/*` | Better Auth: `email-otp/send-verification-otp` (429 after 5 sign-in codes per address in 10 minutes, or 20 per day with `code: "CODES_PRO_TAG"`; other code types send no mail and do not count), `sign-in/email-otp`, `get-session`, `sign-out` | Better Auth responses; sets the session cookie |
| `GET /api/konto` | Email, admin flag (true only within 24 hours of signing in), profile, deletion status (also while marked) | `{ email, admin, profil, loeschungBeantragtAm, endgueltigAm }` |
| `PUT /api/konto` | Save `{ profil: { kommune, funktion, fachbereich } }` | `{ profil }` |
| `POST /api/konto/loeschcode` | Email a code that confirms deletion (5 per 10 minutes) | `{ gesendet: true }` |
| `POST /api/konto/loeschen` | Confirm deletion with `{ code }`; ends all sessions | `{ geloescht: true, endgueltigAm }` |
| `POST /api/konto/wiederherstellen` | Undo a deletion request (also while marked) | `{ wiederhergestellt }`, `false` if the account was not marked |
| `GET /api/bewertungen` | Own saved assessments with recomputed overview | `{ bewertungen: [...] }` |
| `POST /api/bewertungen` | Save `{ stand }` as a new assessment (max. 200 per account, 409 `ZU_VIELE`) | `201 { id, revision: 1 }` |
| `GET /api/bewertungen/{id}` | One own assessment | `{ id, revision, erstelltAm, aktualisiertAm, stand }` |
| `PUT /api/bewertungen/{id}` | Replace its state with `{ stand, revision }`; 409 `KONFLIKT` if `revision` is no longer current | `{ gespeichert: true, revision }` |
| `DELETE /api/bewertungen/{id}` | Delete it | `{ geloescht: true }` |
| `POST /api/admin/konten/{id}` | Form field `aktion`: `abmelden`, `loeschen`, `wiederherstellen`, `endgueltig-loeschen` | `303` to the admin page |
| `POST /api/admin/bewertungen/{id}` | Form field `aktion=loeschen` | `303` to the account page |

`stand` is validated by `leseBewertungStand` in
[bewertung.ts](../src/lib/bewertung.ts): `version: 1`, `fragebogenVersion`,
`phase`, `aktuelleFrage`, `kontext { orgName, funktion, positionFachbereich, ebene }`,
`antworten`, `nachrichten` (at most 500), and `katalog` (or `null`). Bodies over
4 MB answer 413. Each account's stored states may take 20 MiB of database space;
a `POST` or `PUT` that would exceed it answers 413 `SPEICHER_VOLL`. `POST` and `PUT`
together allow 240 saves per account per 15 minutes, then 429 `RATE_LIMITED` with
`Retry-After`. Lists read only the fields an overview needs, never whole states.
Other users' assessments answer 404. Admin routes answer 403 unless the session's
address is listed in `ADMIN_EMAILS`, and 403 `NEU_ANMELDEN` when that admin signed
in more than 24 hours ago.

## Advice requests

Advice requests use municipal context fields `orgName`, `orgTyp`, `funktion`,
and `positionFachbereich`, plus the assessed level `ebene` (`gesamtverwaltung`,
`amt`, or `team`; default `gesamtverwaltung`). `/api/erklaerung` takes `ebene` at
the top level; chat and catalogue requests send it as `assessment.ebene`. The
level selects the question wording used for evidence. The UI sets `orgTyp` to `Kommune`; department and role
can be empty. Answers map canonical question IDs to integer values from zero
through four. Omit skipped questions.

For `/api/erklaerung`, send `antworten` directly and a `kategorie` ID:

```json
{
  "orgName": "Example municipality",
  "funktion": "Department head",
  "positionFachbereich": "Staff development",
  "kategorie": "personal",
  "antworten": { "f7": 2, "f8": 1 }
}
```

Category IDs are `strategie`, `fuehrung`, `personal`, `digitalisierung`, and
`kooperation`. If the selected category has no answered questions, the route
returns a fixed German explanation without calling the AI provider, provided
advice is enabled.

For `/api/chat`, wrap answers in `assessment.antworten` and supply `messages`:

```json
{
  "orgName": "Example municipality",
  "orgTyp": "Kommune",
  "funktion": "Department head",
  "positionFachbereich": "Staff development",
  "assessment": { "antworten": { "f7": 2, "f8": 1 } },
  "messages": [{ "role": "user", "content": "Where should we start?" }]
}
```

Message roles are `user` and `assistant`. Responses remain German under the
system prompt. The reply may contain the
[follow-up or catalogue protocol](ai/README.md#response-protocol).

`/api/katalog` takes the same context and assessment, with `chatHistory` instead
of `messages`. Set `nurAktualisieren` to `false` for the initial catalogue. For
an update, set it to `true` and send the previously accepted catalogue as
`bisherigerKatalog`. The browser adapter constructs these requests in
[beratung-http.ts](../src/lib/beratung-http.ts).

The catalogue response has `version`, `org_name`, `erstellt_am`, `disclaimer`,
and a nonempty `massnahmen` array. Each measure has `titel`, `beschreibung`,
`bereich`, `aufwand`, and `verantwortung`. External responsibility also requires
`wer` and `eigener_beitrag`. `bereich` uses the exact German label from
`KATEGORIEN`, not its category ID. See the
[catalogue model](../src/lib/massnahmenkatalog.ts) for types and validation.

Routes recompute assessment evidence from answers. Submitted totals, percentages,
category scores, and question wording do not override canonical definitions.

## Failure behavior

| Status | Current use |
| --- | --- |
| 400 | Malformed JSON, invalid request shape, answers, category or previous catalogue |
| 413 | Request body exceeds the route byte limit, or a save exceeds the account's storage (`SPEICHER_VOLL`) |
| 429 | AI, save, or sign-in code limit reached; AI and save limits answer `RATE_LIMITED` with `Retry-After` |
| 503 | Incomplete AI settings (provider key or `AI_MODEL`), with `AI_UNAVAILABLE` in `code` |
| 500 | Advice provider failure or invalid generated catalogue content; the message is generic |

Error responses normally contain `error`.

All advice handlers validate JSON shape and size before provider calls and derive
their own assessment evidence. Invalid generated catalogue entries fail the
refresh; the browser keeps its last accepted catalogue. Account bodies and auth
POSTs are limited to 16 KiB, saved-assessment writes to 4 MiB, and admin URL-encoded
forms to 16 KiB. Other form encodings are not accepted by the admin action routes.
Browser advice transport presents a generic unavailable message for unsuccessful
HTTP responses.
