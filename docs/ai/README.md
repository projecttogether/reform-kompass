# AI content maintenance

The advice prompt has three parts, sent in this order:

| Part | Purpose |
| --- | --- |
| `system-prompt.md` in the [content folder](../content.md) | Advisory role, response language and style |
| [beratung-protokoll.ts](../../src/lib/beratung-protokoll.ts) | Reply protocol for follow-up questions and catalogue updates |
| `knowledge-base.md` in the content folder | Municipal examples, reference material, and resources for recommendations |

All parts are German. Keep German category labels and protocol markers unchanged
because the application uses them for validation and display. The Markdown files
in this repository are neutral examples that operators replace. Keep developer
notes in `docs/` because the application sends the complete files to the
provider.

## How requests use the content

The chat and catalogue routes use
[beratung-prompt.ts](../../src/lib/beratung-prompt.ts), through
[ki-anfrage.ts](../../src/lib/ki-anfrage.ts), to read both files from the
content folder on each request. They do not fetch the linked sources or use a
retrieval index. All three advice routes add official
municipal base data and Wegweiser Kommune structure data from
[kommunaldaten.ts](../../src/lib/kommunaldaten.ts). The system prompt should tell
the model how sparingly to use these data and the municipal politics section.

- Chat combines the system prompt, reference material, municipal context, base
  data, canonical assessment evidence, and, with Anthropic, web search
  instructions from [websuche.ts](../../src/lib/websuche.ts). Conversation
  messages go to the configured provider as the message history. Chat is the
  only route with a web search tool: Anthropic's server-side
  `web_search_20260209`, at most 3 searches per reply. OpenAI chat requests do
  not search. The model decides whether a question needs current local
  information, such as the mayor, council decisions, or local news.
  [ki-anbieter.ts](../../src/lib/ki-anbieter.ts) streams only text, resumes a
  reply paused by the search (`pause_turn`) up to twice, and appends cited web
  sources that the reply did not already link, except in follow-up questions.
- Catalogue generation combines the same files with a route-specific JSON
  schema and generation instructions. Its user message includes the assessment,
  conversation, and previous catalogue when supplied. The schema takes precedence
  over the conversational response format.
- Category explanations use their own short prompt in
  [the explanation route](../../src/app/api/erklaerung/route.ts). They do not read
  these Markdown files.

Provider, model and effort come from `AI_PROVIDER`, `AI_MODEL` and `AI_EFFORT`
(see [deployment](../deployment.md#ai-provider-and-model)); the code holds no
model IDs. [ki-anbieter.ts](../../src/lib/ki-anbieter.ts) sends the same requests
to Anthropic or OpenAI. The output token limits are set in the routes:

| Task | Output token limit | Prompt caching |
| --- | --- | --- |
| Category explanation | 1,500 | None; the prompt is short and unique |
| Advice chat | 4,000 | Shared advice prompt, plus the conversation for the next turn |
| Action catalogue | 8,000 | Shared advice prompt |

The three parts form the shared advice prompt: one unchanged first block that chat
and catalogue requests of all users reuse from the provider's cache. With
Anthropic, the web search tool precedes the system prompt in the cache key, so
chat and catalogue requests each keep their own cache entry for this prefix. Keep
request-specific text out of them. After a content change, the first
request writes a new cache entry. Models that think before answering spend part
of the output limit on it, so check the limits when changing `AI_MODEL` or
`AI_EFFORT`.

## Response protocol

For a follow-up, the chat model emits exactly one question and short choices:

```text
RÜCKFRAGE: <question in German>
OPTION_A: <choice in German>
OPTION_B: <choice in German>
OPTION_C: <choice in German>
```

The parser recognizes a question and at least two of these options. Keep the
three-choice format in the protocol. A follow-up must not include advice before
or after it.

An ordinary advice reply can end with `[KATALOG_AKTUALISIEREN]` to request a
catalogue refresh. The browser module removes the marker before display and
schedules the refresh after the reply. A recognized follow-up does not trigger
a refresh even if a marker is present. Do not translate or rename these tokens
without updating `beratung-protokoll.ts`, the parser and the tests. Operator
content must not redefine them.

## Updating content

1. Edit the system prompt for advisory behavior or the knowledge base for
   factual examples. Keep both files in German and route-specific JSON
   requirements in the route.
2. For an example, link to a primary source, state only what it supports, and
   record the review date. Separate facts from suggested adaptations.
3. Remove or qualify unsupported outcome statistics, deadlines, participation
   counts, and eligibility claims. The runtime has no way to check them live.
4. Preserve German responses and all machine-readable protocol markers.
5. Run `npm test` after runtime content or path changes. Route tests verify that
   the complete contents of both files reach Anthropic and OpenAI requests as
   the unchanged first prompt block, which providers cache. Live response
   quality still needs a manual check with configured credentials.

Local file edits affect the next request. In a container deployment, rebuild and
redeploy the image, or update the mounted folder. If content files move, update
`inhalte.ts`, the Dockerfile, links, and integration checks together.

After a path or packaging change, run the
[container content check](../deployment.md#verify-packaged-content) as well as
the route tests. The container check verifies that the files are nonempty and
readable by the runtime user; route tests verify that the Markdown files reach
provider requests. The file reader returns an empty string for an unreadable
file, so a successful request or health check does not prove that the content
was loaded.
