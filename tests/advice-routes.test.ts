import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { POST as chat } from "../src/app/api/chat/route";
import { POST as erklaerung } from "../src/app/api/erklaerung/route";
import { POST as katalogRoute } from "../src/app/api/katalog/route";
import { beratungHttp } from "../src/lib/beratung-http";
import { readAdvicePrompt } from "../src/lib/beratung-prompt";
import { ANTWORTPROTOKOLL } from "../src/lib/beratung-protokoll";
import { katalog, kontext, setzeEnv } from "./fixtures";
import { setzeKommunalpolitikFuerTests, type Kommunalpolitik } from "../src/lib/kommunalpolitik";

const politik: Kommunalpolitik = { ags: "01001000", abgerufenAm: "2026-11-05T12:00:00.000Z", ratsinfoBekannt: false, verwaltungsspitze: [{ name: "Test Person", partei: null, seit: null }], ratsdokumente: null };
setzeKommunalpolitikFuerTests({ lade: async () => politik, vorabladen() {}, fuerBeratung: async () => politik });

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

type SystemBlock = { type: string; text: string; cache_control?: unknown };
type ProviderBody = Record<string, unknown> & { system?: SystemBlock[]; messages: { content: string }[]; input?: { role: string; content: string }[] };

function assertAdvicePrompt(system: string) {
  for (const filename of ["system-prompt.md", "knowledge-base.md"]) {
    const content = readFileSync(new URL(`../inhalte/${filename}`, import.meta.url), "utf-8");
    assert.ok(content.trim().length > 0, `${filename} must not be empty`);
    assert.ok(system.includes(content), `the complete ${filename} must reach the provider`);
  }
  assert.ok(system.includes(ANTWORTPROTOKOLL), "the reply protocol must reach the provider");
  for (const token of ["RÜCKFRAGE:", "OPTION_A:", "OPTION_B:", "OPTION_C:", "[KATALOG_AKTUALISIEREN]"]) {
    assert.ok(system.includes(token), `missing advice protocol token: ${token}`);
  }
}

/** The advice prompt must be the first, unchanged and cache-marked block; request context follows it. */
function assertCachedAdvicePrompt(body: ProviderBody) {
  const [gemeinsam, anfrage] = body.system ?? [];
  assert.equal(gemeinsam.text, readAdvicePrompt());
  assert.deepEqual(gemeinsam.cache_control, { type: "ephemeral" });
  assert.equal(anfrage.cache_control, undefined, "request context is not cached");
  assertAdvicePrompt(body.system!.map((block) => block.text).join("\n\n"));
  return body.system!.map((block) => block.text).join("\n\n");
}

/** Captures the usage lines the provider module logs. */
function nutzungsLog(t: { mock: { method: (object: Console, name: "info", fn: (...args: unknown[]) => void) => unknown } }) {
  const zeilen: Record<string, unknown>[] = [];
  t.mock.method(console, "info", (zeile: unknown) => {
    if (typeof zeile === "string" && zeile.startsWith("KI-Nutzung ")) zeilen.push(JSON.parse(zeile.slice("KI-Nutzung ".length)));
  });
  return zeilen;
}

async function loopback(t: { after: (fn: () => Promise<void>) => void }, antworte: (body: ProviderBody, res: import("node:http").ServerResponse) => void) {
  const captured: ProviderBody[] = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    captured.push(body);
    antworte(body, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { captured, url: `http://127.0.0.1:${address.port}` };
}

const sse = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test("advice routes use canonical evidence, a cached advice prompt and the configured model through the real Anthropic SDK", async (t) => {
  let output = "Antwort";
  const { captured, url } = await loopback(t, (body, res) => {
    assert.equal(body.stream, true, "all advice calls stream");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    res.write(sse("message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "test", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 120, cache_read_input_tokens: 15000, cache_creation_input_tokens: 300, output_tokens: 1 } } }));
    res.write(sse("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
    res.write(sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: output } }));
    res.write(sse("content_block_stop", { type: "content_block_stop", index: 0 }));
    res.write(sse("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 42 } }));
    res.write(sse("message_stop", { type: "message_stop" }));
    res.end();
  });
  // Both keys and no explicit provider: Anthropic is the default.
  setzeEnv(t, { ANTHROPIC_BASE_URL: url, ANTHROPIC_API_KEY: "architecture-test-only", OPENAI_API_KEY: "must-not-be-used", AI_PROVIDER: undefined, AI_MODEL: "test-modell", AI_EFFORT: undefined });
  const nutzung = nutzungsLog(t);

  const assessment = { antworten: kontext.antworten, score_prozent: 99, stufe: "5", kategorie_scores: {} };
  const response = await chat(request("chat", { ...kontext, assessment, messages: [{ role: "user", content: "Beratung" }] }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "Antwort");
  const chatBody = captured.at(-1)!;
  assert.equal(chatBody.model, "test-modell");
  assert.equal(chatBody.output_config, undefined, "no effort is sent unless AI_EFFORT is set");
  assert.deepEqual(chatBody.cache_control, { type: "ephemeral" }, "chat caches the growing conversation");
  const chatSystem = assertCachedAdvicePrompt(chatBody);
  assert.match(chatSystem, /Gesamtreifegrad: 100% \(Stufe 1\)/);
  assert.match(chatSystem, /2 von 3 Fragen übersprungen/);
  assert.deepEqual(nutzung.at(-1), { ...nutzung.at(-1), route: "chat", anbieter: "anthropic", modell: "test-modell", eingabeGesamt: 15420, cacheGelesen: 15000, cacheGeschrieben: 300, ausgabe: 42, ende: "end_turn" });
  assert.equal(typeof nutzung.at(-1)!.dauerMs, "number");
  assert.match(chatSystem, /Für „Testkommune“ liegen keine amtlichen Grunddaten vor/);
  assert.match(chatSystem, /## Recherche im Web/);
  assert.deepEqual((chatBody.tools as { type: string }[]).map((tool) => tool.type), ["web_search_20260209"], "only chat may search the web");

  const flensburg = await chat(request("chat", { ...kontext, orgName: "Flensburg, Stadt (Schleswig-Holstein)", assessment, messages: [{ role: "user", content: "Beratung" }] }));
  await flensburg.text();
  const flensburgSystem = captured.at(-1)!.system!.map((block) => block.text).join("\n\n");
  assert.match(flensburgSystem, /Amtlicher Gemeindeschlüssel 01001000/);
  assert.match(flensburgSystem, /Quellen:\n- Statistisches Bundesamt \(Destatis\)/);
  assert.match(flensburgSystem, /## Kommunalpolitik \(automatisch abgerufen am 05\.11\.2026\)\n\n- Verwaltungsspitze laut Wikidata: Test Person/);

  const explanation = await erklaerung(request("erklaerung", { ...kontext, kategorie: "strategie", kategorieLabel: "Forged", score: { score: 99 }, fragen: [] }));
  assert.equal(explanation.status, 200);
  assert.deepEqual(await explanation.json(), { erklaerung: "Antwort" });
  assert.match(captured.at(-1)!.messages[0].content, /Strategie und Wirkung: 100% \(4\/4 Punkte\)/);
  assert.ok(!captured.at(-1)!.messages[0].content.includes("Forged"));
  assert.equal(captured.at(-1)!.system, undefined);
  assert.equal(captured.at(-1)!.cache_control, undefined, "short one-off prompts are not cached");
  assert.equal(nutzung.at(-1)!.route, "erklaerung");

  output = JSON.stringify({ massnahmen: katalog().massnahmen });
  const accepted = await katalogRoute(request("katalog", { ...kontext, assessment, chatHistory: [{ role: "user", content: "Kein Budget" }], nurAktualisieren: true, bisherigerKatalog: katalog("Bewährte Maßnahme") }));
  assert.equal(accepted.status, 200);
  assert.equal(captured.at(-1)!.tools, undefined, "the catalogue does not search the web");
  const katalogBody = captured.at(-1)!;
  const katalogSystem = assertCachedAdvicePrompt(katalogBody);
  assert.equal(katalogBody.system![0].text, chatBody.system![0].text, "chat and catalogue share one cache prefix");
  assert.equal(katalogBody.cache_control, undefined, "the unique catalogue request is not cached as a whole");
  assert.equal((await accepted.json()).massnahmen.length, 1);
  assert.match(katalogSystem, /Eine der Kategorien: Strategie und Wirkung; Führung und Kultur; Personal; Bürger:innen im Mittelpunkt; Offenheit, Zusammenarbeit, Demokratie/);
  assert.match(katalogBody.messages[0].content, /Kein Budget/);
  assert.match(katalogBody.messages[0].content, /Amtsleitung, Fachbereich Personal/);
  assert.match(katalogBody.messages[0].content, /Bewährte Maßnahme/);
  assert.equal(nutzung.at(-1)!.route, "katalog");

  process.env.AI_EFFORT = "low";
  await (await chat(request("chat", { ...kontext, assessment, messages: [{ role: "user", content: "Beratung" }] }))).text();
  assert.deepEqual(captured.at(-1)!.output_config, { effort: "low" });

  t.mock.method(console, "error", () => {});
  output = JSON.stringify({ massnahmen: [null] });
  assert.equal((await katalogRoute(request("katalog", { ...kontext, assessment }))).status, 500);

  const calls = captured.length;
  assert.equal((await erklaerung(request("erklaerung", { ...kontext, kategorie: "personal" }))).status, 200);
  assert.equal((await chat(request("chat", { assessment: { antworten: { f1: 99 } } }))).status, 400);
  assert.equal(captured.length, calls);

  for (const fehlend of [{ ANTHROPIC_API_KEY: " ", OPENAI_API_KEY: "" }, { AI_MODEL: " " }, { AI_PROVIDER: "andere" }]) {
    const vorher = { ...process.env };
    Object.assign(process.env, fehlend);
    for (const [path, handler] of [["chat", chat], ["erklaerung", erklaerung], ["katalog", katalogRoute]] as const) {
      assert.equal((await handler(request(path, {}))).status, 503, `${path} with ${JSON.stringify(fehlend)}`);
    }
    Object.assign(process.env, { ANTHROPIC_API_KEY: vorher.ANTHROPIC_API_KEY, OPENAI_API_KEY: vorher.OPENAI_API_KEY, AI_MODEL: vorher.AI_MODEL });
    delete process.env.AI_PROVIDER;
  }
  assert.equal(captured.length, calls);
});

test("OpenAI receives the same cached advice prompt, the effort and the conversation through the Responses API", async (t) => {
  let output = "Antwort von OpenAI";
  const { captured, url } = await loopback(t, (body, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const response = { id: "resp_test", object: "response", created_at: 0, model: "test", status: "in_progress", output: [], incomplete_details: null, error: null, usage: null };
    res.write(sse("response.created", { type: "response.created", sequence_number: 0, response }));
    res.write(sse("response.output_text.delta", { type: "response.output_text.delta", sequence_number: 1, item_id: "msg_test", output_index: 0, content_index: 0, delta: output, logprobs: [] }));
    res.write(sse("response.completed", { type: "response.completed", sequence_number: 2, response: { ...response, status: "completed", usage: { input_tokens: 15500, input_tokens_details: { cached_tokens: 15000, cache_write_tokens: 0 }, output_tokens: 80, output_tokens_details: { reasoning_tokens: 30 }, total_tokens: 15580 } } }));
    res.end();
  });
  setzeEnv(t, { OPENAI_BASE_URL: url, OPENAI_API_KEY: "openai-test-only", ANTHROPIC_API_KEY: "must-not-be-used", AI_PROVIDER: "OpenAI", AI_MODEL: "openai-test-modell", AI_EFFORT: "medium" });
  const nutzung = nutzungsLog(t);

  const assessment = { antworten: kontext.antworten };
  const messages = [{ role: "user", content: "Beratung" }, { role: "assistant", content: "Rückfrage" }, { role: "user", content: "Antwort" }];
  const response = await chat(request("chat", { ...kontext, assessment, messages }));
  assert.equal(await response.text(), "Antwort von OpenAI");
  const chatBody = captured.at(-1)!;
  assert.equal(chatBody.model, "openai-test-modell");
  assert.equal(chatBody.store, false, "responses are not stored by the provider");
  assert.equal(chatBody.stream, true);
  assert.equal(chatBody.prompt_cache_key, "reform-kompass-beratung");
  assert.deepEqual(chatBody.reasoning, { effort: "medium" });
  assert.equal(chatBody.max_output_tokens, 5000);
  const [gemeinsam, anfrage, ...verlauf] = chatBody.input!;
  assert.deepEqual(gemeinsam, { role: "developer", content: readAdvicePrompt() });
  assert.equal(anfrage.role, "developer");
  assertAdvicePrompt(`${gemeinsam.content}\n\n${anfrage.content}`);
  assert.match(anfrage.content, /Gesamtreifegrad: 100% \(Stufe 1\)/);
  assert.deepEqual(verlauf, messages);
  assert.deepEqual(nutzung.at(-1), { ...nutzung.at(-1), route: "chat", anbieter: "openai", modell: "openai-test-modell", eingabeGesamt: 15500, cacheGelesen: 15000, cacheGeschrieben: 0, ausgabe: 80, ende: "completed" });

  output = JSON.stringify({ massnahmen: katalog().massnahmen });
  const accepted = await katalogRoute(request("katalog", { ...kontext, assessment }));
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).massnahmen.length, 1);
  assert.deepEqual(captured.at(-1)!.input![0], gemeinsam, "chat and catalogue share one cache prefix");
  assert.equal(nutzung.at(-1)!.route, "katalog");
});

test("an OpenAI stream that is cut off never counts as a finished answer", async (t) => {
  const abbruch = new AbortController();
  const { url } = await loopback(t, (_body, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(sse("response.output_text.delta", { type: "response.output_text.delta", sequence_number: 1, item_id: "msg_test", output_index: 0, content_index: 0, delta: "Halbe Antw", logprobs: [] }));
    // The client gives up (timeout or disconnect) before the response completes.
    setTimeout(() => { abbruch.abort(); res.end(); }, 50);
  });
  setzeEnv(t, { OPENAI_BASE_URL: url, OPENAI_API_KEY: "openai-test-only", ANTHROPIC_API_KEY: undefined, AI_PROVIDER: undefined, AI_MODEL: "openai-test-modell", AI_EFFORT: undefined });
  const nutzung = nutzungsLog(t);
  t.mock.method(console, "error", () => {});
  const body = JSON.stringify({ ...kontext, kategorie: "strategie" });
  const response = await erklaerung(new NextRequest("http://localhost/api/erklaerung", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: abbruch.signal }));
  assert.equal(response.status, 500, "partial text must not be returned as an explanation");
  assert.equal(nutzung.at(-1)!.ende, "abgebrochen");
});

test("every advice request gives its provider slot back: finished, cancelled, failed or with invalid output", async (t) => {
  let modus: "antwort" | "haengt" | "fehler" = "antwort";
  let output = "Antwort";
  const haengend: import("node:http").ServerResponse[] = [];
  const { url } = await loopback(t, (_body, res) => {
    if (modus === "fehler") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "Provider kaputt" } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(sse("message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "test", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }));
    res.write(sse("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
    res.write(sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: output } }));
    if (modus === "haengt") { haengend.push(res); return; }
    res.write(sse("content_block_stop", { type: "content_block_stop", index: 0 }));
    res.write(sse("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 2 } }));
    res.write(sse("message_stop", { type: "message_stop" }));
    res.end();
  });
  t.after(() => { for (const res of haengend) res.end(); });
  // One provider call at a time: a request that finds the slot taken answers 429.
  setzeEnv(t, { ANTHROPIC_BASE_URL: url, ANTHROPIC_API_KEY: "architecture-test-only", OPENAI_API_KEY: undefined, AI_PROVIDER: undefined, AI_MODEL: "test-modell", AI_EFFORT: undefined, KI_MAX_PARALLEL: "1" });
  t.mock.method(console, "info", () => {});
  const fehler = t.mock.method(console, "error", () => {});
  const assessment = { antworten: kontext.antworten };
  const chatAnfrage = () => chat(request("chat", { ...kontext, assessment, messages: [{ role: "user", content: "Beratung" }] }));
  const erklaere = () => erklaerung(request("erklaerung", { ...kontext, kategorie: "strategie" }));
  async function slotFrei() {
    const vorher = { modus, output };
    modus = "antwort"; output = "Antwort";
    const antwort = await erklaere();
    assert.equal(antwort.status, 200, "the slot is free again");
    ({ modus, output } = vorher);
  }

  assert.equal(await (await chatAnfrage()).text(), "Antwort");
  await slotFrei();

  modus = "haengt";
  const offen = await chatAnfrage();
  const leser = offen.body!.getReader();
  assert.equal(new TextDecoder().decode((await leser.read()).value), "Antwort");
  assert.equal((await erklaere()).status, 429, "a streaming reply holds the slot");
  await leser.cancel();
  await slotFrei();

  modus = "fehler";
  await assert.rejects((await chatAnfrage()).text());
  await slotFrei();
  assert.equal((await katalogRoute(request("katalog", { ...kontext, assessment }))).status, 500);
  await slotFrei();
  assert.ok(fehler.mock.calls.some((call) => String(call.arguments[0]).startsWith("KI-Anbieter-Fehler (katalog)")));

  modus = "antwort";
  output = JSON.stringify({ massnahmen: [null] });
  assert.equal((await katalogRoute(request("katalog", { ...kontext, assessment }))).status, 500);
  await slotFrei();
  assert.ok(fehler.mock.calls.some((call) => String(call.arguments[0]).startsWith("Ungültige KI-Antwort (katalog)")), "invalid model output is logged apart from provider failures");
});

test("browser transport sends current answers and conversation without duplicated score or question definitions", async (t) => {
  const calls: { url: string; body: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)), signal: init?.signal });
    return String(url).includes("chat")
      ? new Response("Antwort", { headers: { "Content-Type": "text/plain" } })
      : Response.json(String(url).includes("erklaerung") ? { erklaerung: "Einschätzung" } : katalog());
  });
  const signal = new AbortController().signal;
  const messages = [{ role: "user" as const, content: "Neue Frage" }, { role: "assistant" as const, content: "Neue Antwort" }];
  await beratungHttp.erklaerung(kontext, "strategie", signal);
  await beratungHttp.chat(kontext, messages, signal, () => {});
  await beratungHttp.katalog(kontext, messages, signal, null);
  const previous = katalog();
  await beratungHttp.katalog(kontext, messages, signal, previous);
  assert.deepEqual(calls[0].body.antworten, kontext.antworten);
  assert.equal(calls[0].body.fragen, undefined);
  assert.equal(calls[0].body.score, undefined);
  assert.deepEqual(calls[1].body.assessment, { antworten: kontext.antworten, ebene: kontext.ebene });
  assert.deepEqual(calls[2].body.chatHistory, messages);
  assert.equal(calls[2].body.nurAktualisieren, false);
  assert.equal(calls[3].body.nurAktualisieren, true);
  assert.deepEqual(calls[3].body.bisherigerKatalog, previous);
  assert.ok(calls.every((call) => call.signal === signal));
});
