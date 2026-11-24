import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { FRAGEN, EBENEN, FRAGEBOGEN_VERSION } from "../src/lib/reifegrad-model";
import { gespeicherteForm, kanonisch, leseBewertungStand, uebersicht, vergleiche } from "../src/lib/bewertung";
import { beispielStand } from "./konto-fixtures";
import { katalog } from "./fixtures";

test("questionnaire changes require a new FRAGEBOGEN_VERSION", () => {
  // If this fails after editing questions or options, increase FRAGEBOGEN_VERSION in
  // reifegrad-model.ts and update both values here. Saved assessments rely on it.
  const fingerprint = createHash("sha256").update(JSON.stringify({ FRAGEN, EBENEN })).digest("hex");
  assert.deepEqual({ FRAGEBOGEN_VERSION, fingerprint }, { FRAGEBOGEN_VERSION: 1, fingerprint: "4f30e8bdb59c10b365b63cd30fa314eaf973ff911a1e0c3467ef83d5c7b855da" });
});

test("saved state is validated with the canonical answer and catalogue rules", () => {
  const stand = beispielStand({
    katalog: katalog(),
    nachrichten: [
      { role: "user", content: "Frage" },
      { role: "assistant", content: "KI-Beratung ist derzeit nicht verfügbar.", error: true },
      { role: "assistant", content: "Antwort", rueckfrage: { frage: "Was?", optionen: ["A", "B"] } },
    ],
  });
  const gelesen = leseBewertungStand(JSON.parse(JSON.stringify(stand)));
  assert.deepEqual(gelesen.nachrichten.map((n) => n.content), ["Frage", "Antwort"], "error notices are not saved");
  assert.equal(gelesen.katalog?.massnahmen.length, 1);

  for (const ungueltig of [
    { ...stand, antworten: { f1: 5 } },
    { ...stand, antworten: { unbekannt: 1 } },
    { ...stand, phase: "fertig" },
    { ...stand, kontext: { ...stand.kontext, orgName: " " } },
    { ...stand, kontext: { ...stand.kontext, ebene: "land" } },
    { ...stand, katalog: { massnahmen: [] } },
    { ...stand, aktuelleFrage: 15 },
    { ...stand, version: 2 },
  ]) {
    assert.throws(() => leseBewertungStand(ungueltig), /Ungültig/);
  }
});

test("overview recomputes scores from answers instead of trusting stored values", () => {
  const stand = beispielStand({ antworten: { f1: 4, f2: 4 } });
  const manipuliert = { ...stand, prozent: 3, scoreResult: { prozent: 3 } } as unknown;
  const u = uebersicht(leseBewertungStand(manipuliert));
  assert.equal(u.prozent, 100);
  assert.equal(u.stufe, "1", "absolute cutoffs apply to partial assessments");
  assert.equal(u.beantworteteFragen, 2);
});

test("comparison shows per-category differences and notes on limited comparability", () => {
  const a = beispielStand({ antworten: { f1: 2, f2: 2 } });
  const b = beispielStand({ antworten: { f1: 4, f2: 4, f7: 4 }, fragebogenVersion: 2, kontext: { ...a.kontext, ebene: "amt" } });
  const v = vergleiche(a, b);
  const zeile = (k: string) => v.zeilen.find((z) => z.kategorie === k)!;
  assert.deepEqual(zeile("strategie"), { kategorie: "strategie", label: "Strategie und Wirkung", a: 50, b: 100, differenz: 50 });
  assert.deepEqual(zeile("personal"), { kategorie: "personal", label: zeile("personal").label, a: null, b: 100, differenz: null });
  assert.equal(v.hinweise.length, 3);
  assert.match(v.hinweise.join(" "), /Fassungen des Fragebogens/);
  assert.match(v.hinweise.join(" "), /unterschiedliche Ebenen/);
});

test("tab state keeps answers when only the conversation is invalid", async () => {
  const speicher = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => speicher.get(k) ?? null,
    setItem: (k: string, v: string) => void speicher.set(k, v),
    removeItem: (k: string) => void speicher.delete(k),
  };
  try {
    const { ladeSitzung, speichereSitzung, SITZUNGS_SCHLUESSEL } = await import("../src/components/check/sitzungsspeicher");
    speichereSitzung({ stand: beispielStand({ phase: "chat" }), bewertungId: "b1", revision: 3 });
    assert.deepEqual({ ...ladeSitzung(), stand: undefined }, { stand: undefined, bewertungId: "b1", revision: 3 });

    const zuLang = { ...beispielStand({ phase: "chat" }), nachrichten: [{ role: "user", content: "x".repeat(25_000) }] };
    speicher.set(SITZUNGS_SCHLUESSEL, JSON.stringify({ stand: zuLang, bewertungId: null }));
    const gerettet = ladeSitzung();
    assert.equal(gerettet?.stand.phase, "ergebnis");
    assert.deepEqual(gerettet?.stand.antworten, { f1: 4, f2: 2, f7: 1 });
    assert.deepEqual(gerettet?.stand.nachrichten, []);

    speicher.set(SITZUNGS_SCHLUESSEL, JSON.stringify({ stand: { ...beispielStand(), antworten: { f1: 99 } } }));
    assert.equal(ladeSitzung(), null, "invalid answers start a fresh assessment");
  } finally {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

test("canonical JSON ignores key order from the database", () => {
  assert.equal(kanonisch({ b: 1, a: { d: [{ y: 1, x: 2 }], c: null } }), kanonisch({ a: { c: null, d: [{ x: 2, y: 1 }] }, b: 1 }));
  assert.notEqual(kanonisch({ a: [1, 2] }), kanonisch({ a: [2, 1] }));
});

test("a local state compares equal to the copy the server stored", () => {
  const lokal = beispielStand({ katalog: katalog() });
  lokal.kontext = { ...lokal.kontext, orgName: " Musterstadt ", funktion: "Leitung " };
  // PUT validates the body; reading the row validates it again.
  const gespeichert = leseBewertungStand(JSON.parse(JSON.stringify(leseBewertungStand(JSON.parse(JSON.stringify(lokal))))));
  assert.notEqual(kanonisch(gespeichert), kanonisch(lokal), "the server trims context fields");
  assert.equal(gespeicherteForm(gespeichert), gespeicherteForm(lokal));
  // States the server would reject keep their raw form.
  const ungueltig = { ...lokal, antworten: { f1: 5 } };
  assert.equal(gespeicherteForm(ungueltig), kanonisch(ungueltig));
});

test("existing answers survive a legacy malformed catalogue without weakening write validation", async () => {
  const { leseBestehendenBewertungStand } = await import("../src/lib/bewertung");
  const stand = beispielStand();
  const legacy = { ...stand, katalog: { version: 1, org_name: "Test", erstellt_am: "2026-11-04", disclaimer: "Test", massnahmen: [{ titel: "Test", beschreibung: "Test", bereich: "Unknown", aufwand: "niedrig", verantwortung: "eigen" }] } };
  assert.throws(() => leseBewertungStand(legacy));
  const restored = leseBestehendenBewertungStand(legacy);
  assert.deepEqual(restored.antworten, stand.antworten);
  assert.deepEqual(restored.nachrichten, stand.nachrichten);
  assert.equal(restored.katalog, null);
  assert.throws(() => leseBestehendenBewertungStand({ ...legacy, antworten: { f1: 99 } }));
});
