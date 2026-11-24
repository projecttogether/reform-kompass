import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { KiEinstellungen } from "./ai-config";
import { WEBSUCHE, WEBSUCHE_ANLEITUNG, MAX_FORTSETZUNGEN, quellenAnhang } from "./websuche";

// Provider calls for the advice routes. Both adapters put the shared advice prompt first,
// unchanged, so the provider can serve it from its prompt cache across requests, routes
// and users. Every call logs one usage line without user content.

export type KiRoute = "chat" | "katalog" | "erklaerung";

export interface KiAuftrag {
  route: KiRoute;
  /** Identical for every request and route; providers cache it as a shared prefix. */
  gemeinsameAnweisungen?: string;
  /** Instructions for this request only, placed after the shared prefix. */
  anweisungen?: string;
  nachrichten: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  /** Also cache the conversation so the next turn of a chat can reuse it. */
  verlaufCachen?: boolean;
  /**
   * Anthropic's server-side web search with its instructions. OpenAI requests ignore it
   * and answer without searching.
   */
  websuche?: boolean;
  signal: AbortSignal;
}

/** Token counts as the provider reported them; null when the call ended before it reported. */
export interface KiNutzung {
  /** All input tokens of the request, including cached ones. */
  eingabeGesamt: number | null;
  cacheGelesen: number | null;
  cacheGeschrieben: number | null;
  /** Output tokens, including any reasoning tokens. */
  ausgabe: number | null;
  /** Provider stop reason, or "abgebrochen"/"fehler" when the call did not finish. */
  ende: string | null;
}

/** OpenAI routes requests with the same key and prefix to the same cache. */
const OPENAI_CACHE_SCHLUESSEL = "reform-kompass-beratung";

async function* anthropicText(ki: KiEinstellungen, auftrag: KiAuftrag, nutzung: KiNutzung): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: ki.apiKey, timeout: 120_000, maxRetries: 0 });
  const system: Anthropic.TextBlockParam[] = [];
  if (auftrag.gemeinsameAnweisungen?.trim()) system.push({ type: "text", text: auftrag.gemeinsameAnweisungen, cache_control: { type: "ephemeral" } });
  if (auftrag.anweisungen?.trim()) system.push({ type: "text", text: auftrag.anweisungen });
  if (auftrag.websuche) system.push({ type: "text", text: WEBSUCHE_ANLEITUNG });
  let verlauf: Anthropic.MessageParam[] = auftrag.nachrichten;
  let text = "";
  const zitate = new Map<string, string | null>();
  const summe = { eingabe: 0, gelesen: 0, geschrieben: 0, ausgabe: 0 };
  // A reply paused by the web search (pause_turn) continues with the content so far.
  for (let runde = 0; runde <= (auftrag.websuche ? MAX_FORTSETZUNGEN : 0); runde++) {
    const stream = client.messages.stream({
      model: ki.modell,
      max_tokens: auftrag.maxTokens,
      messages: verlauf,
      ...(system.length > 0 ? { system } : {}),
      ...(auftrag.websuche ? { tools: [WEBSUCHE] } : {}),
      // Moves a second breakpoint to the end of the conversation on every turn.
      ...(auftrag.verlaufCachen ? { cache_control: { type: "ephemeral" as const } } : {}),
      ...(ki.effort ? { output_config: { effort: ki.effort as NonNullable<Anthropic.OutputConfig["effort"]> } } : {}),
    }, { signal: auftrag.signal });
    let ausgabeRunde = 0;
    for await (const event of stream) {
      if (event.type === "message_start") {
        const usage = event.message.usage;
        summe.gelesen += usage.cache_read_input_tokens ?? 0;
        summe.geschrieben += usage.cache_creation_input_tokens ?? 0;
        summe.eingabe += usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
        ausgabeRunde = usage.output_tokens;
        Object.assign(nutzung, { eingabeGesamt: summe.eingabe, cacheGelesen: summe.gelesen, cacheGeschrieben: summe.geschrieben, ausgabe: summe.ausgabe + ausgabeRunde });
      } else if (event.type === "message_delta") {
        ausgabeRunde = event.usage.output_tokens;
        nutzung.ausgabe = summe.ausgabe + ausgabeRunde;
        nutzung.ende = event.delta.stop_reason ?? nutzung.ende;
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          text += event.delta.text;
          yield event.delta.text;
        } else if (event.delta.type === "citations_delta" && event.delta.citation.type === "web_search_result_location") {
          zitate.set(event.delta.citation.url, event.delta.citation.title);
        }
      }
    }
    summe.ausgabe += ausgabeRunde;
    const antwort = await stream.finalMessage();
    if (antwort.stop_reason !== "pause_turn") break;
    verlauf = [...verlauf, { role: "assistant", content: antwort.content }];
  }
  // Follow-up questions end with answer options; there the sources stay as links in the text.
  if (auftrag.websuche && !text.includes("RÜCKFRAGE:")) {
    const anhang = quellenAnhang(text, zitate);
    if (anhang) yield anhang;
  }
}

async function* openaiText(ki: KiEinstellungen, auftrag: KiAuftrag, nutzung: KiNutzung): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey: ki.apiKey, timeout: 120_000, maxRetries: 0 });
  const input: OpenAI.Responses.EasyInputMessage[] = [];
  if (auftrag.gemeinsameAnweisungen?.trim()) input.push({ role: "developer", content: auftrag.gemeinsameAnweisungen });
  if (auftrag.anweisungen?.trim()) input.push({ role: "developer", content: auftrag.anweisungen });
  input.push(...auftrag.nachrichten);
  const stream = await client.responses.create({
    model: ki.modell,
    input,
    max_output_tokens: auftrag.maxTokens,
    // Prompt prefixes of 1,024 tokens or more are cached automatically; responses need no server-side storage.
    prompt_cache_key: OPENAI_CACHE_SCHLUESSEL,
    store: false,
    stream: true,
    ...(ki.effort ? { reasoning: { effort: ki.effort as OpenAI.ReasoningEffort } } : {}),
  }, { signal: auftrag.signal });
  let beendet = false;
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    } else if (event.type === "response.completed" || event.type === "response.incomplete" || event.type === "response.failed") {
      const usage = event.response.usage;
      if (usage) {
        nutzung.eingabeGesamt = usage.input_tokens;
        nutzung.cacheGelesen = usage.input_tokens_details?.cached_tokens ?? 0;
        nutzung.cacheGeschrieben = usage.input_tokens_details?.cache_write_tokens ?? 0;
        nutzung.ausgabe = usage.output_tokens;
      }
      nutzung.ende = event.response.incomplete_details?.reason ?? event.response.status ?? null;
      beendet = true;
      if (event.type === "response.failed") throw new Error(`OpenAI-Antwort fehlgeschlagen: ${event.response.error?.message ?? "ohne Angabe"}`);
    } else if (event.type === "error") {
      throw new Error(`OpenAI-Stream-Fehler: ${event.message}`);
    }
  }
  // The SDK ends iteration quietly on abort; partial text must not count as an answer.
  if (!beendet) throw new Error(auftrag.signal.aborted ? "OpenAI-Anfrage abgebrochen" : "OpenAI-Stream ohne Abschluss beendet");
}

/** Streams the answer text and logs token usage when the call ends, also after an abort. */
export async function* streameKiText(ki: KiEinstellungen, auftrag: KiAuftrag): AsyncGenerator<string> {
  const start = Date.now();
  const nutzung: KiNutzung = { eingabeGesamt: null, cacheGelesen: null, cacheGeschrieben: null, ausgabe: null, ende: null };
  try {
    yield* (ki.anbieter === "anthropic" ? anthropicText : openaiText)(ki, auftrag, nutzung);
  } finally {
    nutzung.ende ??= auftrag.signal.aborted ? "abgebrochen" : "fehler";
    console.info(`KI-Nutzung ${JSON.stringify({ route: auftrag.route, anbieter: ki.anbieter, modell: ki.modell, ...nutzung, dauerMs: Date.now() - start })}`);
  }
}

export async function erzeugeKiText(ki: KiEinstellungen, auftrag: KiAuftrag): Promise<string> {
  let text = "";
  for await (const teil of streameKiText(ki, auftrag)) text += teil;
  return text;
}
