import { NextResponse } from "next/server";
import type { z } from "zod";
import { leseKiEinstellungen } from "./ai-config";
import { erzeugeKiText, streameKiText, type KiAuftrag, type KiRoute } from "./ki-anbieter";
import { leseKiAnfrage } from "./beratung-anfrage";
import { pruefeKiLimit, reserviereKiAnfrage } from "./ki-limit";
import { readAdvicePrompt } from "./beratung-prompt";

/** What an advice route asks the provider for. */
export interface KiAufgabe {
  /**
   * Send the advice prompt (beratung-prompt.ts) as the first, unchanged block, so providers
   * can cache it across requests, routes and users.
   */
  mitBeratungsPrompt?: boolean;
  /** Instructions for this request only; they follow the advice prompt. */
  anweisungen?: string;
  nachrichten: KiAuftrag["nachrichten"];
  maxTokens: number;
  /** Also cache the conversation so the next chat turn can reuse it. */
  verlaufCachen?: boolean;
  /** Let the model search the web; only Anthropic supports it, other providers answer without. */
  websuche?: boolean;
}

export interface KiRouteAuftrag<S extends z.ZodType> {
  route: KiRoute;
  schema: S;
  /**
   * Derives the evidence and builds the provider request from a valid body, or answers
   * directly, for example with 400 for invalid answers. Runs before a provider slot is taken,
   * so waiting for municipal data does not hold one.
   */
  vorbereiten(body: z.output<S>): KiAufgabe | Response | Promise<KiAufgabe | Response>;
  /** Turns the complete reply into the response; an error answers 500. Without it, the reply streams as text. */
  antwort?(text: string, body: z.output<S>): Response;
}

const nichtVerfuegbar = () => NextResponse.json({ error: "KI-Beratung ist derzeit nicht verfügbar." }, { status: 500 });

/**
 * Answers an advice request in a fixed order: AI settings (503), request budget (429),
 * body and schema (413/400), the route's preparation, a provider slot (429), the provider
 * call, and the response. The slot is given back on every path, also when the browser
 * cancels a streamed reply.
 */
export async function beantworteKiAnfrage<S extends z.ZodType>(req: Request, auftrag: KiRouteAuftrag<S>): Promise<Response> {
  const ki = leseKiEinstellungen();
  if (!ki) {
    return NextResponse.json({ code: "AI_UNAVAILABLE", error: "KI-Beratung ist hier nicht aktiviert." }, { status: 503 });
  }
  const limit = await pruefeKiLimit(req);
  if (limit) return limit;

  const body = await leseKiAnfrage(req, auftrag.schema);
  if (body instanceof Response) return body;
  const aufgabe = await auftrag.vorbereiten(body);
  if (aufgabe instanceof Response) return aufgabe;

  const slot = reserviereKiAnfrage(req);
  if (slot instanceof Response) return slot;
  const anfrage: Omit<KiAuftrag, "signal"> = {
    route: auftrag.route,
    gemeinsameAnweisungen: aufgabe.mitBeratungsPrompt ? readAdvicePrompt() : undefined,
    anweisungen: aufgabe.anweisungen,
    nachrichten: aufgabe.nachrichten,
    maxTokens: aufgabe.maxTokens,
    verlaufCachen: aufgabe.verlaufCachen,
    websuche: aufgabe.websuche,
  };

  if (!auftrag.antwort) {
    const abbruch = new AbortController();
    const text = streameKiText(ki, { ...anfrage, signal: AbortSignal.any([slot.signal, abbruch.signal]) });
    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const teil of text) controller.enqueue(enc.encode(teil));
          controller.close();
        } catch (error) {
          console.error(`KI-Anbieter-Fehler (${auftrag.route}):`, error);
          controller.error(error);
        } finally {
          slot.beenden();
        }
      },
      cancel() { abbruch.abort(); slot.beenden(); },
    });
    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  }

  let text: string;
  try {
    text = await erzeugeKiText(ki, { ...anfrage, signal: slot.signal });
  } catch (error) {
    console.error(`KI-Anbieter-Fehler (${auftrag.route}):`, error);
    return nichtVerfuegbar();
  } finally {
    slot.beenden();
  }
  try {
    return auftrag.antwort(text, body);
  } catch (error) {
    // For example a catalogue that fails validation; the browser keeps its last accepted one.
    console.error(`Ungültige KI-Antwort (${auftrag.route}):`, error);
    return nichtVerfuegbar();
  }
}
