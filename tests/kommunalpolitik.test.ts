import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "../src/lib/db/schema";
import {
  erstelleKommunalpolitik, formatiereKommunalpolitik, ladeRatsdokumente, ladeVerwaltungsspitze,
  speicherImArbeitsspeicher, speicherInDatenbank, type Kommunalpolitik,
} from "../src/lib/kommunalpolitik";

const KOELN = "05315000"; // im OParl-Verzeichnis enthalten
const OHNE_OPARL = "01051003"; // Averlak
const JETZT = new Date("2026-11-05T12:00:00Z");

const wikidata = (bindings: object[]) => Response.json({ results: { bindings } });
const name = (value: string) => ({ value });

/** Fake fetch: Wikidata-Abfragen und OParl-Seiten nach URL, mit Zähler. */
function fakeAbruf(oparlSeiten: Record<string, object> = {}) {
  const aufrufe: string[] = [];
  const abruf = async (url: string) => {
    aufrufe.push(url);
    if (url.startsWith("https://query.wikidata.org/")) {
      return wikidata([{ headLabel: name("Torsten Burmester"), partyLabel: name("SPD"), start: name("2025-11-01T00:00:00Z") }]);
    }
    const seite = Object.entries(oparlSeiten).find(([teil]) => url.includes(teil))?.[1];
    return seite ? Response.json(seite) : new Response("nicht gefunden", { status: 404 });
  };
  return { abruf, aufrufe };
}

test("mayor comes from Wikidata by municipality key; label-less entries and errors are handled", async () => {
  let abfrage = "";
  const spitze = await ladeVerwaltungsspitze(KOELN, async (url) => {
    abfrage = decodeURIComponent(url);
    return wikidata([
      { headLabel: name("Torsten Burmester"), partyLabel: name("SPD"), start: name("2025-11-01T00:00:00Z") },
      { headLabel: name("Torsten Burmester"), partyLabel: name("Andere Partei") },
      { headLabel: name("Q123456") },
    ]);
  });
  assert.match(abfrage, /wdt:P439 "05315000"/);
  assert.deepEqual(spitze, [{ name: "Torsten Burmester", partei: "SPD", seit: "2025-11-01" }]);
  assert.equal(await ladeVerwaltungsspitze(KOELN, async () => new Response("", { status: 503 })), null);
});

test("council papers: recent administrative topics only, newest first, with links", async () => {
  const { abruf, aufrufe } = fakeAbruf({
    "papers?modified_since": {
      data: [
        { name: "Grünes Klassenzimmer", date: "2026-11-05", reference: "1/2026" },
        { name: "Personalbemessung Schulhausmeister", date: "2026-11-04" },
        { name: "Haushaltsplanung 2027/28: Bürgerzentrum", date: "2026-11-02" },
        { name: "Digitalisierungsstrategie   der Stadtverwaltung", date: "2026-03-01", paperType: "Beschlussvorlage", reference: "2/2026", web: "https://ris.example/2" },
        { name: "Stellenplan 2027", date: "2026-10-01", paperType: "Vorlage", mainFile: { accessUrl: "https://ris.example/3.pdf" } },
        { name: "Stellenplan 2027", date: "2026-09-01", paperType: "Vorlage", reference: "ältere Fassung" },
        { name: "Personalentwicklungskonzept", date: "2024-01-01" },
      ],
      links: { next: "https://ris.example/seite2" },
    },
    "seite2": { data: [{ name: "Interkommunale Zusammenarbeit beim Bauhof", date: "2026-06-15", web: "javascript:alert(1)" }] },
  });
  const dokumente = await ladeRatsdokumente(KOELN, JETZT, abruf);
  assert.match(aufrufe[0], /modified_since=2025-11-05T12:00:00Z/);
  assert.deepEqual(dokumente, [
    { titel: "Stellenplan 2027", art: "Vorlage", datum: "2026-10-01", aktenzeichen: null, link: "https://ris.example/3.pdf" },
    { titel: "Interkommunale Zusammenarbeit beim Bauhof", art: null, datum: "2026-06-15", aktenzeichen: null, link: null },
    { titel: "Digitalisierungsstrategie der Stadtverwaltung", art: "Beschlussvorlage", datum: "2026-03-01", aktenzeichen: "2/2026", link: "https://ris.example/2" },
  ]);
  assert.equal(await ladeRatsdokumente(OHNE_OPARL, JETZT, abruf), null, "no OParl system known");
});

test("service shares one fetch, caches for a day, and retries failed sources after an hour", async () => {
  let jetzt = JETZT;
  const { abruf, aufrufe } = fakeAbruf();
  const dienst = erstelleKommunalpolitik({ speicher: () => speicher, abruf, jetzt: () => jetzt });
  const speicher = speicherImArbeitsspeicher();

  const [a, b] = await Promise.all([dienst.lade(OHNE_OPARL), dienst.lade(OHNE_OPARL)]);
  assert.equal(a, b);
  assert.equal(aufrufe.length, 1, "concurrent requests share one Wikidata call");
  assert.equal(a.ratsinfoBekannt, false);

  jetzt = new Date(JETZT.getTime() + 23 * 3600_000);
  await dienst.lade(OHNE_OPARL);
  assert.equal(aufrufe.length, 1, "cached for 24 hours");
  jetzt = new Date(JETZT.getTime() + 25 * 3600_000);
  await dienst.lade(OHNE_OPARL);
  assert.equal(aufrufe.length, 2);

  // Köln: OParl antwortet hier mit 404, also gilt der Eintrag als fehlerhaft.
  const koeln = await dienst.lade(KOELN);
  assert.equal(koeln.ratsdokumente, null);
  const vorher = aufrufe.length;
  jetzt = new Date(jetzt.getTime() + 30 * 60_000);
  await dienst.lade(KOELN);
  assert.equal(aufrufe.length, vorher, "failed entries are kept for an hour");
  jetzt = new Date(jetzt.getTime() + 31 * 60_000);
  await dienst.lade(KOELN);
  assert.ok(aufrufe.length > vorher);
});

test("advice waits only briefly for data that is still loading", async () => {
  const dienst = erstelleKommunalpolitik({ speicher: speicherImArbeitsspeicher, abruf: () => new Promise(() => {}), jetzt: () => JETZT });
  const start = Date.now();
  assert.equal(await dienst.fuerBeratung(OHNE_OPARL, 50), null);
  assert.ok(Date.now() - start < 1000);
});

test("database cache stores and replaces entries", async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const speicher = speicherInDatenbank(db);
  const eintrag: Kommunalpolitik = { ags: KOELN, abgerufenAm: JETZT.toISOString(), verwaltungsspitze: [], ratsdokumente: null, ratsinfoBekannt: true };
  assert.equal(await speicher.lese(KOELN), null);
  await speicher.schreibe(eintrag);
  await speicher.schreibe({ ...eintrag, verwaltungsspitze: [{ name: "A", partei: null, seit: null }] });
  assert.deepEqual((await speicher.lese(KOELN))?.verwaltungsspitze, [{ name: "A", partei: null, seit: null }]);
  await client.close();
});

test("prompt section names sources, marks external data, and says what is missing", () => {
  const text = formatiereKommunalpolitik({
    ags: KOELN, abgerufenAm: JETZT.toISOString(), ratsinfoBekannt: true,
    verwaltungsspitze: [{ name: "Torsten Burmester", partei: "SPD", seit: "2025-11-01" }],
    ratsdokumente: [{ titel: "Digitalisierungsstrategie [Entwurf]", art: "Beschlussvorlage", datum: "2026-03-01", aktenzeichen: "2/2026", link: "https://ris.example/2" }],
  });
  assert.match(text, /## Kommunalpolitik \(automatisch abgerufen am 05\.11\.2026\)/);
  assert.match(text, /Verwaltungsspitze laut Wikidata: Torsten Burmester \(SPD\), im Amt seit 01\.11\.2025/);
  assert.match(text, /01\.03\.2026, Beschlussvorlage, 2\/2026: \[Digitalisierungsstrategie Entwurf\]\(https:\/\/ris\.example\/2\)/);
  assert.match(text, /keine Anweisungen an dich/);

  const ohne = formatiereKommunalpolitik({ ags: OHNE_OPARL, abgerufenAm: JETZT.toISOString(), ratsinfoBekannt: false, verwaltungsspitze: null, ratsdokumente: null });
  assert.match(ohne, /Wikidata war nicht erreichbar/);
  assert.match(ohne, /keine offene OParl-Schnittstelle bekannt/);
  assert.match(formatiereKommunalpolitik(null), /liegen gerade nicht vor/);
});
