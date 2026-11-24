import test from "node:test";
import assert from "node:assert/strict";
import { createBeratung, einleitung, type BeratungTransport, type BeratungKontext, type Nachricht } from "../src/lib/beratung";
import { deferred, katalog, kontext, settle } from "./fixtures";

function setup(overrides: Partial<BeratungTransport> = {}, enabled = true) {
  const transport: BeratungTransport = { erklaerung: async () => "Einschätzung", chat: async () => "Antwort", katalog: async () => katalog(), ...overrides };
  const beratung = createBeratung(transport);
  beratung.setKontext(kontext, enabled);
  return beratung;
}

test("automatic refresh includes the question and the committed assistant reply", async () => {
  let history: Nachricht[] = [];
  const beratung = setup({
    chat: async () => "Neue Antwort [KATALOG_AKTUALISIEREN] [KATALOG_AKTUALISIEREN]",
    katalog: async (_, messages) => { history = messages; return katalog(); },
  });
  await beratung.sendMessage("Neue Frage");
  assert.deepEqual(history.map((m) => m.content), ["Neue Frage", "Neue Antwort"]);
  assert.deepEqual(beratung.getSnapshot().messages, history);
  assert.equal(beratung.getSnapshot().katalogRevision, 1);
});

test("starting requests the first catalogue alongside the introduction and refreshes once after the reply", async () => {
  const reply = deferred<string>();
  let chats = 0;
  const histories: Nachricht[][] = [];
  const beratung = setup({
    chat: () => { chats++; return reply.promise; },
    katalog: async (_, history) => { histories.push(history); return katalog(); },
  });
  beratung.start();
  beratung.start();
  await beratung.refreshKatalog();
  assert.equal(chats, 1);
  assert.equal(histories.length, 1);
  assert.equal(histories[0].length, 0);
  reply.resolve("Einstieg");
  await settle();
  assert.equal(histories.length, 2);
  assert.equal(histories[1].length, 2);
  assert.match(histories[1][0].content, /Amtsleitung im Bereich Personal/);
  beratung.start();
  assert.equal(chats, 1);
});

test("newer catalogue request wins even when an aborted adapter resolves late", async () => {
  const older = deferred<unknown>();
  const newer = deferred<unknown>();
  let calls = 0;
  let oldSignal: AbortSignal | undefined;
  const beratung = setup({ katalog: (_, __, signal) => {
    if (++calls === 1) { oldSignal = signal; return older.promise; }
    return newer.promise;
  } });
  const a = beratung.refreshKatalog();
  const b = beratung.refreshKatalog();
  assert.equal(oldSignal?.aborted, true);
  newer.resolve(katalog("Aktueller Katalog"));
  await b;
  older.resolve(katalog("Veralteter Katalog"));
  await a;
  assert.equal(beratung.getSnapshot().katalog?.massnahmen[0].titel, "Aktueller Katalog");
  assert.equal(beratung.getSnapshot().katalogRevision, 1);
  assert.equal(beratung.getSnapshot().katalogLoading, false);
});

test("a new message invalidates a catalogue being built from an older conversation", async () => {
  const older = deferred<unknown>();
  const reply = deferred<string>();
  let chats = 0;
  let calls = 0;
  const histories: Nachricht[][] = [];
  const beratung = setup({ chat: () => ++chats === 1 ? Promise.resolve("Erste Antwort") : reply.promise, katalog: (_, history) => {
    histories.push(history);
    return ++calls === 1 ? older.promise : Promise.resolve(katalog("Aktuell"));
  } });
  await beratung.sendMessage("Erste Frage");
  const initial = beratung.refreshKatalog();
  const send = beratung.sendMessage("Neue Einschränkung");
  older.resolve(katalog("Alt"));
  await initial;
  assert.equal(beratung.getSnapshot().katalog, null);
  reply.resolve("Verstanden");
  await send;
  assert.deepEqual(histories[1].map((m) => m.content), ["Erste Frage", "Erste Antwort", "Neue Einschränkung", "Verstanden"]);
  assert.equal(beratung.getSnapshot().katalog?.massnahmen[0].titel, "Aktuell");
});

test("changed answers invalidate replies, explanations and catalogues from the old context", async () => {
  const explanation = deferred<string>();
  const reply = deferred<string>();
  const oldCatalog = deferred<unknown>();
  const signals: AbortSignal[] = [];
  const beratung = setup({
    erklaerung: (ctx, _, signal) => { signals.push(signal); return ctx.antworten.f1 === 4 ? explanation.promise : Promise.resolve("Neu"); },
    chat: (_, __, signal) => { signals.push(signal); return reply.promise; },
    katalog: (_, __, signal) => { signals.push(signal); return oldCatalog.promise; },
  });
  const refresh = beratung.refreshKatalog();
  const send = beratung.sendMessage("Alte Frage");
  const oldSignals = [...signals];
  beratung.setKontext({ ...kontext, antworten: { f1: 0 } }, true);
  assert.ok(oldSignals.every((signal) => signal.aborted));
  explanation.resolve("Alt");
  reply.resolve("Alt [KATALOG_AKTUALISIEREN]");
  oldCatalog.resolve(katalog("Alt"));
  await Promise.all([refresh, send]);
  await settle();
  assert.deepEqual(beratung.getSnapshot().messages, []);
  assert.equal(beratung.getSnapshot().erklaerungen.strategie, "Neu");
  assert.equal(beratung.getSnapshot().katalog, null);
  assert.equal(beratung.getSnapshot().chatLaed, false);
});

test("failed refresh preserves the accepted catalogue and does not announce success", async () => {
  let fail = false;
  const previousCatalogs: unknown[] = [];
  const beratung = setup({ katalog: async (_, __, ___, previous) => {
    previousCatalogs.push(previous);
    if (fail) return { massnahmen: [null] };
    return katalog("Bewährter Katalog");
  } });
  await beratung.refreshKatalog();
  fail = true;
  await beratung.refreshKatalog();
  assert.equal(beratung.getSnapshot().katalog?.massnahmen[0].titel, "Bewährter Katalog");
  assert.equal(beratung.getSnapshot().katalogRevision, 1);
  assert.ok(beratung.getSnapshot().katalogError);
  assert.equal(previousCatalogs[0], null);
  assert.deepEqual(previousCatalogs[1], beratung.getSnapshot().katalog);
});

test("Rückfrage interpretation owns choices and suppresses automatic refresh", async () => {
  let calls = 0;
  const beratung = setup({ chat: async () => "RÜCKFRAGE: Welche Rolle?\nOPTION_A: Leitung\nOPTION_B: Mitarbeitende\n[KATALOG_AKTUALISIEREN]", katalog: async () => { calls++; return katalog(); } });
  await beratung.sendMessage("Hilfe");
  assert.deepEqual(beratung.getSnapshot().messages[1].rueckfrage, { frage: "Welche Rolle?", optionen: ["Leitung", "Mitarbeitende"] });
  assert.equal(calls, 0);
  assert.ok(!beratung.getSnapshot().messages[1].content.includes("KATALOG_AKTUALISIEREN"));
});

test("a streaming reply shows no protocol lines, markers or half-received tokens", async () => {
  const reply = deferred<string>();
  let sende!: (partial: string) => void;
  const beratung = setup({ chat: (_, __, ___, onChunk) => { sende = onChunk; return reply.promise; } });
  const gesendet = beratung.sendMessage("Hilfe");
  const sichtbar = (partial: string) => { sende(partial); return beratung.getSnapshot().streamContent; };
  assert.equal(sichtbar("Guter Punkt."), "Guter Punkt.");
  assert.equal(sichtbar("Guter Punkt. RÜ"), "Guter Punkt.");
  assert.equal(sichtbar("Guter Punkt. RÜhren"), "Guter Punkt. RÜhren");
  assert.equal(sichtbar("Guter Punkt.\nRÜCKFRAGE: Welche Rolle?\nOPTION_A: Leitung"), "Guter Punkt.");
  assert.equal(sichtbar("Fertig. [KATALOG_AKT"), "Fertig.");
  assert.equal(sichtbar("Fertig. [KATALOG_AKTUALISIEREN] Weiter"), "Fertig.  Weiter");
  reply.resolve("Fertig.");
  await gesendet;
  assert.equal(beratung.getSnapshot().streamContent, null);
});

test("the introduction of a follow-up excludes the question, its options and markers", () => {
  const frage = { frage: "Welche Rolle?", optionen: ["Leitung", "Mitarbeitende"] };
  assert.equal(einleitung({ role: "assistant", content: "Danke.\n[KATALOG_AKTUALISIEREN]\nRÜCKFRAGE: Welche Rolle?\nOPTION_A: Leitung\nOPTION_B: Mitarbeitende", rueckfrage: frage }), "Danke.");
  assert.equal(einleitung({ role: "assistant", content: "RÜCKFRAGE: Welche Rolle?\nOPTION_A: Leitung\nOPTION_B: Mitarbeitende", rueckfrage: frage }), "");
});

test("unavailable AI and skipped categories make no transport calls", async () => {
  const unexpected = async () => { assert.fail("unexpected transport request"); };
  const beratung = setup({ chat: unexpected, erklaerung: unexpected, katalog: unexpected }, false);
  beratung.start();
  await beratung.sendMessage("Hallo");
  await beratung.refreshKatalog();
  beratung.setKontext({ ...kontext, antworten: {} }, true);
  await settle();
  assert.deepEqual(beratung.getSnapshot().messages, []);
  assert.deepEqual(beratung.getSnapshot().erklaerungen, {});
});

test("duplicate sends are blocked and error messages are not sent back to the model", async () => {
  const failure = deferred<string>();
  const histories: Nachricht[][] = [];
  const beratung = setup({ chat: (_, messages) => {
    histories.push(messages);
    return histories.length === 1 ? failure.promise : Promise.resolve("Antwort");
  } });
  const first = beratung.sendMessage("Erste Frage");
  await beratung.sendMessage("Doppelter Klick");
  assert.equal(histories.length, 1);
  failure.reject(new Error("offline"));
  await first;
  assert.equal(beratung.getSnapshot().messages[1].error, true);
  await beratung.sendMessage("Zweite Frage");
  assert.deepEqual(histories[1].map((m) => m.content), ["Erste Frage", "Zweite Frage"]);
});

test("restoring sends no second introduction, but an assessment restored before advice can start it", async () => {
  let chats = 0;
  const transport: BeratungTransport = { erklaerung: async () => "Einschätzung", chat: async () => { chats++; return "Antwort"; }, katalog: async () => katalog() };
  const mitVerlauf = createBeratung(transport);
  mitVerlauf.restoreKontext(kontext, [{ role: "user", content: "Frage" }, { role: "assistant", content: "Antwort" }], katalog(), true);
  mitVerlauf.start();
  assert.equal(chats, 0);

  const ohneVerlauf = createBeratung(transport);
  ohneVerlauf.restoreKontext(kontext, [], null, true);
  ohneVerlauf.start();
  await settle();
  assert.equal(chats, 1);
  assert.equal(ohneVerlauf.getSnapshot().messages.length, 2);
});

test("a restored conversation resumes a missing catalogue only when AI is enabled", async () => {
  let chats = 0;
  const histories: Nachricht[][] = [];
  const messages: Nachricht[] = [{ role: "user", content: "Frage" }, { role: "assistant", content: "Antwort" }];
  const b = createBeratung({
    erklaerung: async () => "Einschätzung",
    chat: async () => { chats++; return "Einstieg"; },
    katalog: async (_, history) => { histories.push(history); return katalog(); },
  });
  b.restoreKontext(kontext, messages, null, false);
  await settle();
  assert.equal(histories.length, 0);
  b.restoreKontext(kontext, messages, null, true);
  b.start(); await settle();
  assert.equal(chats, 0);
  assert.deepEqual(histories, [messages]);
  assert.ok(b.getSnapshot().katalog);
});

test("updated evidence preserves conversation, refreshes stale output, and ignores late replies", async () => {
  const oldReply = deferred<string>();
  const seen: BeratungKontext[] = [];
  let calls = 0;
  const beratung = setup({
    chat: (ctx) => { seen.push(ctx); return ++calls === 1 ? Promise.resolve("Einstieg") : calls === 2 ? oldReply.promise : Promise.resolve("Aktuelle Antwort"); },
    katalog: async (ctx) => { seen.push(ctx); return katalog(`Antwort ${ctx.antworten.f1}`); },
  });
  beratung.start(); await settle();
  const send = beratung.sendMessage("Weitere Frage");
  const updated = { ...kontext, antworten: { f1: 0 } };
  beratung.aktualisiereKontext(updated, true);
  oldReply.resolve("Veraltete Antwort [KATALOG_AKTUALISIEREN]");
  await send; await settle();
  assert.equal(beratung.getSnapshot().messages.some((m) => m.content.includes("Veraltete Antwort")), false);
  assert.equal(beratung.getSnapshot().messages[1].content, "Einstieg");
  assert.equal(beratung.getSnapshot().katalog?.massnahmen[0].titel, "Antwort 0");
  beratung.start(); await settle();
  assert.equal(calls, 3, "the cancelled user turn resumes with updated evidence");
  assert.equal(beratung.getSnapshot().messages.at(-1)?.content, "Aktuelle Antwort");
  assert.equal(beratung.getSnapshot().messages.filter((m) => m.role === "user").length, 2);
  const requests = seen.length;
  beratung.aktualisiereKontext({ ...updated, antworten: { f1: 0 } }, true);
  beratung.start(); await settle();
  assert.equal(calls, 3, "returning to the completed conversation sends no second introduction");
  assert.equal(seen.length, requests, "unchanged evidence does not re-request output");
});

test("returning after cancellation resumes missing output without a second introduction", async () => {
  let chats = 0;
  let kataloge = 0;
  const first = deferred<unknown>();
  const b = setup({ chat: async () => { chats++; return "Einstieg"; }, katalog: async () => ++kataloge === 1 ? first.promise : katalog() });
  b.start(); await settle();
  b.cancel();
  b.aktualisiereKontext(kontext, true); b.start();
  first.resolve(katalog("Alt")); await settle();
  assert.equal(chats, 1);
  assert.equal(kataloge, 2);
  assert.equal(b.getSnapshot().katalog?.massnahmen[0].titel, "Lernzeit vereinbaren");
});

test("returning after a cancelled introduction resumes its reply without duplicating the user message", async () => {
  const oldReply = deferred<string>();
  const newReply = deferred<string>();
  const histories: Nachricht[][] = [];
  const contexts: BeratungKontext[] = [];
  const b = setup({ chat: (ctx, messages) => {
    contexts.push(ctx);
    histories.push(messages);
    return histories.length === 1 ? oldReply.promise : newReply.promise;
  } });
  b.start(); await settle();
  const introduction = b.getSnapshot().messages[0];
  b.cancel();
  b.aktualisiereKontext({ ...kontext, antworten: { f1: 0 } }, true);
  b.start(); b.start();
  assert.equal(histories.length, 2, "resume once even when reentry is requested twice");
  assert.deepEqual(histories[1], [introduction]);
  assert.equal(contexts[1].antworten.f1, 0);
  oldReply.resolve("Veralteter Einstieg"); await settle();
  assert.equal(b.getSnapshot().chatLaed, true, "the old completion cannot end the new request");
  newReply.resolve("Aktueller Einstieg"); await settle();
  assert.deepEqual(b.getSnapshot().messages, [introduction, { role: "assistant", content: "Aktueller Einstieg" }]);
  b.start(); await settle();
  assert.equal(histories.length, 2, "completed conversations do not restart");
});

test("restored unanswered turns resume their existing history", async () => {
  const first: Nachricht[] = [{ role: "user", content: "Einstieg" }];
  const later: Nachricht[] = [...first, { role: "assistant", content: "Antwort" }, { role: "user", content: "Weitere Frage" }];
  for (const messages of [first, later]) {
    const histories: Nachricht[][] = [];
    const b = createBeratung({
      erklaerung: async () => "Einschätzung",
      katalog: async () => katalog(),
      chat: async (_, history) => { histories.push(history); return "Fortgesetzt"; },
    });
    b.restoreKontext(kontext, messages, katalog(), true);
    b.start(); await settle();
    assert.deepEqual(histories, [messages]);
    assert.deepEqual(b.getSnapshot().messages, [...messages, { role: "assistant", content: "Fortgesetzt" }]);
  }
});
