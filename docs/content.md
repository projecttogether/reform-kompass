# Operator content

Everything an operator usually wants to change lives in two folders, so the same
image serves any organization. The repository contains neutral examples.

| File | Purpose |
| --- | --- |
| `inhalte/system-prompt.md` | Instructions for the advice model, in German |
| `inhalte/knowledge-base.md` | Examples and references for recommendations, in German |
| `inhalte/betreiber.json` | Product name and start page footer |
| `public/marke/logo-hell.svg` | Logo on dark backgrounds (website header) |
| `public/marke/logo-dunkel.svg` | Logo on white (PDF export) |
| `public/marke/icon.svg` | Browser icon |

Both logos need a viewBox ratio of 856:384; the PDF draws them at that ratio.
Brand colors, page texts and the questionnaire are part of the code.

## betreiber.json

```json
{
  "name": "Example Compass",
  "fusszeile": [
    {
      "text": "Run by the example association.",
      "link": { "text": "Imprint", "url": "https://example.org/imprint" }
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `name` | Required, at most 60 characters. Shown in page titles, logo text, emails and PDFs |
| `fusszeile` | Optional, at most six lines. Each has `text` and an optional `link` |
| `link.url` | Must start with `https://` or `mailto:` |

Unknown fields, other link types, or invalid JSON make the file invalid. The app
then uses the name `Reform-Kompass` and no footer, and logs the problem at start.

## Use your own content

The files are read on each request, as the `node` user (UID 1000). Set
`KOMPASS_INHALTE_DIR` to read another folder than `inhalte/` in the working
directory.

Build your own image on top of the published one. Pin a version you tested:

```dockerfile
FROM ghcr.io/projecttogether/reform-kompass:main@sha256:<digest>
COPY --chown=node:node inhalte/ ./inhalte/
COPY --chown=node:node marke/ ./public/marke/
```

Or mount the folders:

```bash
docker run --rm --init --publish 127.0.0.1:3000:3000 \
  --volume "$PWD/inhalte:/app/inhalte:ro" \
  --volume "$PWD/marke:/app/public/marke:ro" \
  ghcr.io/projecttogether/reform-kompass:main
```

A mount replaces the whole folder, so include every file. At start the server
logs `Inhalte: /app/inhalte (<name>).`, or `Inhalte unvollständig …` with the
files it could not use. An unreadable prompt file counts as empty: the
assessment keeps working, but advice loses that text. Check the log after every
content change.

The reply protocol is part of the code
([beratung-protokoll.ts](../src/lib/beratung-protokoll.ts)) and is always sent
between the two Markdown files. Operator content does not need to describe it and
must not contradict it. See [AI content](ai/README.md).

## Before you publish a deployment

- Add your imprint and privacy information, for example as footer links.
- Only publish texts you have the rights to. The whole prompt can be extracted
  by users of the chat, so it must not contain confidential information.
- Use your own name and logos; see [TRADEMARKS.md](../TRADEMARKS.md).
