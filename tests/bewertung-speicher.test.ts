import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createBewertungSpeicher, type SpeicherTransport } from "../src/lib/bewertung-speicher";
import { leseBewertungStand, neuerBewertungStand, type BewertungStand } from "../src/lib/bewertung";
import { KontoAnfrageFehler } from "../src/lib/konto-browser";
import type { Profil } from "../src/lib/konten";
import { settle } from "./fixtures";

/**
 * "netz": the request fails before it reaches the server. "antwort-verloren": the server saves, but the reply is lost.
 * "voll": the account's storage budget refuses the save.
 */
type Stoerung = "netz" | "antwort-verloren" | 404 | "voll";

/** Stands in for the saved-assessment routes: validates like the server, counts revisions, answers 409 on stale writes. */
function server(optionen: { voll?: "ZU_VIELE" | "SPEICHER_VOLL" } = {}) {
  const zeilen = new Map<string, { revision: number; stand: BewertungStand }>();
  const anfragen: { art: "erstelle" | "speichere" | "lade"; id?: string; revision?: number; keepalive?: boolean }[] = [];
  const profile: Profil[] = [];
  const stoerungen: Partial<Record<"speichere" | "lade", Stoerung[]>> = {};
  // While set, saves wait until the test lets them through.
  let tor: Promise<void> | null = null;
  const wieGespeichert = (stand: BewertungStand) => leseBewertungStand(JSON.parse(JSON.stringify(stand)));
  const fehler = (status: number, code: string) => new KontoAnfrageFehler(status, code, code);
  function stoerung(art: "speichere" | "lade") {
    const s = stoerungen[art]?.shift();
    if (s === "netz") throw new TypeError("Failed to fetch");
    if (s === 404) throw fehler(404, "NICHT_GEFUNDEN");
    if (s === "voll") throw fehler(413, "SPEICHER_VOLL");
    return s;
  }
  const transport: SpeicherTransport = {
    async erstelleBewertung(stand) {
      anfragen.push({ art: "erstelle" });
      if (optionen.voll) throw fehler(optionen.voll === "ZU_VIELE" ? 409 : 413, optionen.voll);
      const id = `b${zeilen.size + 1}`;
      zeilen.set(id, { revision: 1, stand: wieGespeichert(stand) });
      return { id, revision: 1 };
    },
    async speichereBewertung(id, stand, revision, keepalive = false) {
      anfragen.push({ art: "speichere", id, revision, keepalive });
      await tor;
      const s = stoerung("speichere");
      const zeile = zeilen.get(id);
      if (!zeile) throw fehler(404, "NICHT_GEFUNDEN");
      if (zeile.revision !== revision) throw fehler(409, "KONFLIKT");
      zeilen.set(id, { revision: revision + 1, stand: wieGespeichert(stand) });
      if (s === "antwort-verloren") throw new TypeError("Failed to fetch");
      return revision + 1;
    },
    async ladeBewertung(id) {
      anfragen.push({ art: "lade", id });
      stoerung("lade");
      const zeile = zeilen.get(id);
      if (!zeile) throw fehler(404, "NICHT_GEFUNDEN");
      return { revision: zeile.revision, stand: wieGespeichert(zeile.stand) };
    },
    async speichereProfil(profil) { profile.push(profil); },
  };
  return {
    transport, zeilen, anfragen, profile,
    stoere(art: "speichere" | "lade", ...s: Stoerung[]) { (stoerungen[art] ??= []).push(...s); },
    /** Holds saves in flight; returns the function that lets them through. */
    halteSpeichern() {
      let frei!: () => void;
      tor = new Promise((resolve) => { frei = () => { tor = null; resolve(); }; });
      return frei;
    },
    /** Another tab or device saves the assessment. */
    andererTab(id: string, stand: BewertungStand) {
      const zeile = zeilen.get(id)!;
      zeilen.set(id, { revision: zeile.revision + 1, stand: wieGespeichert(stand) });
    },
    speicherungen: () => anfragen.filter((a) => a.art === "speichere"),
  };
}

function stand(antworten: Record<string, number> = {}): BewertungStand {
  return { ...neuerBewertungStand({ orgName: "Musterstadt", funktion: "Amtsleitung", positionFachbereich: "Personal", ebene: "team" }), antworten };
}

const aktiv = { aktiv: true, pausiert: false };

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = server();
  const speicher = createBewertungSpeicher(s.transport);
  /** Lets the debounce or retry delay pass and the requests it starts finish. */
  async function warte(ms: number) {
    t.mock.timers.tick(ms);
    await settle();
  }
  return { s, speicher, warte };
}

/** A tab linked to a freshly created saved assessment, with `start` as its saved state. */
async function verknuepft(t: TestContext, start = stand()) {
  const umgebung = setup(t);
  const { id, revision } = await umgebung.s.transport.erstelleBewertung(start);
  umgebung.speicher.aktualisiere(start, aktiv);
  umgebung.speicher.verknuepfe(id, revision, start);
  return { ...umgebung, id };
}

test("changes are saved once after a pause, one after another, each on the latest revision", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await warte(1199);
  assert.equal(s.speicherungen().length, 0, "nothing is sent before the pause ends");
  await warte(1);
  assert.deepEqual(s.speicherungen(), [{ art: "speichere", id, revision: 1, keepalive: false }]);
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f1: 2 });
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 2, status: "gespeichert" });

  // Paused while a reply streams, and changed back before the pause ended: nothing to send.
  speicher.aktualisiere(stand({ f1: 3 }), { aktiv: true, pausiert: true });
  await warte(5000);
  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await warte(1200);
  assert.equal(s.speicherungen().length, 1);

  speicher.aktualisiere(stand({ f1: 4 }), aktiv);
  await warte(1200);
  assert.equal(s.speicherungen().at(-1)!.revision, 2);
  assert.equal(speicher.getSnapshot().revision, 3);
});

test("a save whose reply was lost is recognized after the 409, and newer changes follow on top", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  s.stoere("speichere", "antwort-verloren");
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await warte(1200);
  assert.equal(speicher.getSnapshot().status, "fehler");
  assert.equal(s.zeilen.get(id)!.revision, 2, "the server did save");

  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await warte(1200);
  assert.equal(speicher.getSnapshot().status, "gespeichert", "a 409 caused by this tab is no conflict");
  await warte(1200);
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f1: 2 });
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 3, status: "gespeichert" });
});

test("after a resent lost save is recognized, the tab's newer state follows even if it changed back meanwhile", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  s.stoere("speichere", "antwort-verloren");
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await warte(1200);
  assert.equal(s.zeilen.get(id)!.revision, 2, "the server saved, the tab does not know it");

  // The retry resends the same state; while it is in flight, the tab changes back.
  const frei = s.halteSpeichern();
  await warte(10_000);
  await warte(1200);
  speicher.aktualisiere(stand(), aktiv);
  frei();
  await settle();
  assert.equal(speicher.getSnapshot().status, "gespeichert", "the 409 is this tab's own save");
  await warte(1200);
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, {}, "the server ends up with the tab's state");
});

test("another tab's save stops this tab from writing, but keeps the link to the saved version", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  s.andererTab(id, stand({ f9: 4 }));
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await warte(1200);
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 1, status: "konflikt" });
  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await warte(1200);
  assert.equal(s.speicherungen().length, 1);
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f9: 4 }, "the other tab's state survives");
});

test("failed saves are retried later, and nothing is scheduled after leaving the page", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  s.stoere("speichere", "netz");
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await warte(1200);
  assert.equal(speicher.getSnapshot().status, "fehler");
  await warte(10_000);
  await warte(1200);
  assert.equal(speicher.getSnapshot().status, "gespeichert");
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f1: 1 });

  s.stoere("speichere", "netz");
  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  speicher.sendeSofort();
  await settle();
  assert.equal(s.speicherungen().at(-1)!.keepalive, true, "a hidden page sends at once and may outlive the page");
  speicher.beende();
  await warte(20_000);
  assert.equal(s.speicherungen().length, 3, "no retry after leaving /check");
});

test("a restored tab relinks only when its saved assessment has not changed elsewhere", async (t) => {
  const { s, speicher, warte } = setup(t);
  const { id } = await s.transport.erstelleBewertung(stand({ f1: 1 }));
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await speicher.pruefeUndVerknuepfe(id, 1, stand({ f1: 1 }));
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 1, status: "gespeichert" });

  // The last save finished while the page closed: newer revision, same content.
  s.andererTab(id, stand({ f1: 1, f2: 2 }));
  const neu = createBewertungSpeicher(s.transport);
  neu.aktualisiere(stand({ f1: 1, f2: 2 }), aktiv);
  await neu.pruefeUndVerknuepfe(id, 1, stand({ f1: 1, f2: 2 }));
  assert.equal(neu.getSnapshot().status, "gespeichert");

  s.andererTab(id, stand({ f3: 3 }));
  const veraltet = createBewertungSpeicher(s.transport);
  veraltet.aktualisiere(stand({ f1: 1, f2: 2 }), aktiv);
  await veraltet.pruefeUndVerknuepfe(id, 2, stand({ f1: 1, f2: 2 }));
  assert.deepEqual(veraltet.getSnapshot(), { bewertungId: id, revision: 2, status: "konflikt" });
  await warte(1200);
  assert.equal(s.speicherungen().length, 0);
});

test("a failed check after reload keeps the link and checks again instead of allowing a duplicate", async (t) => {
  const { s, speicher, warte } = setup(t);
  const { id } = await s.transport.erstelleBewertung(stand({ f1: 1 }));
  s.stoere("lade", "netz");
  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await speicher.pruefeUndVerknuepfe(id, 1, stand({ f1: 1 }));
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 1, status: "fehler" }, "the tab still belongs to its saved assessment");
  await speicher.erstelle(stand({ f1: 2 }));
  assert.equal(s.zeilen.size, 1, "no second saved assessment");

  await warte(10_000);
  assert.equal(speicher.getSnapshot().status, "gespeichert");
  await warte(1200);
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f1: 2 }, "local changes follow once linked");

  // The assessment was deleted elsewhere: the tab lets go of it.
  const geloescht = createBewertungSpeicher(s.transport);
  s.stoere("lade", 404);
  await geloescht.pruefeUndVerknuepfe(id, 2, stand({ f1: 2 }));
  assert.deepEqual(geloescht.getSnapshot(), { bewertungId: null, revision: null, status: "aus" });
});

test("creating twice makes one saved assessment and a profile; the account limit has its own status", async (t) => {
  const { s, speicher } = setup(t);
  speicher.aktualisiere(stand(), aktiv);
  await Promise.all([speicher.erstelle(stand()), speicher.erstelle(stand())]);
  assert.equal(s.anfragen.filter((a) => a.art === "erstelle").length, 1);
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: "b1", revision: 1, status: "gespeichert" });
  assert.deepEqual(s.profile, [{ kommune: "Musterstadt", funktion: "Amtsleitung", fachbereich: "Personal" }]);

  for (const grund of ["ZU_VIELE", "SPEICHER_VOLL"] as const) {
    const voll = createBewertungSpeicher(server({ voll: grund }).transport);
    await voll.erstelle(stand());
    assert.deepEqual(voll.getSnapshot(), { bewertungId: null, revision: null, status: "voll" }, grund);
  }
});

test("a save refused for lack of space shows the full status and is resent on the next change or visit, not on a timer", async (t) => {
  const { s, speicher, warte, id } = await verknuepft(t);
  s.stoere("speichere", "voll", "voll");
  speicher.aktualisiere(stand({ f1: 1 }), aktiv);
  await warte(1200);
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 1, status: "voll" });
  await warte(30_000);
  assert.equal(s.speicherungen().length, 1, "retrying on a timer cannot help");

  speicher.aktualisiere(stand({ f1: 2 }), aktiv);
  await warte(1200);
  assert.equal(s.speicherungen().length, 2, "the next change tries again");
  assert.equal(speicher.getSnapshot().status, "voll");

  // The member deleted older assessments in another tab and returns: the page becomes visible.
  speicher.nachholen();
  await warte(1200);
  assert.deepEqual(speicher.getSnapshot(), { bewertungId: id, revision: 2, status: "gespeichert" });
  assert.deepEqual(s.zeilen.get(id)!.stand.antworten, { f1: 2 });
});
