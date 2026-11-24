import test from "node:test";
import assert from "node:assert/strict";
import { erstelleKatalog, leseKatalog, gruppiereKatalog, exportiereKatalog } from "../src/lib/massnahmenkatalog";
import { katalog } from "./fixtures";

test("invalid catalogue entries are rejected without silently changing classifications", () => {
  const valid = katalog();
  const item = valid.massnahmen[0];

  // entries that cannot be parsed at all → whole catalogue throws
  for (const invalid of [null, { ...item, titel: " " }]) {
    assert.throws(() => leseKatalog({ ...valid, massnahmen: [invalid] }));
    assert.throws(() => erstelleKatalog(JSON.stringify({ massnahmen: [invalid] }), "Testkommune"));
  }
  for (const massnahmen of [[], {}, undefined]) assert.throws(() => leseKatalog({ ...valid, massnahmen }));
  assert.throws(() => leseKatalog({ ...valid, erstellt_am: "yesterday" }));
  assert.throws(() => erstelleKatalog("kein JSON", "Testkommune"));

  for (const invalid of [
    { ...item, aufwand: "mittel" },
    { ...item, verantwortung: "unbekannt" },
    { ...item, bereich: "Digitalisierung" },
    { ...item, bereich: "" },
    { ...item, verantwortung: "fremd" },
    { ...item, verantwortung: "fremd", wer: "Leitung", eigener_beitrag: " " },
  ]) {
    assert.throws(() => leseKatalog({ ...valid, massnahmen: [item, invalid] }));
    assert.throws(() => erstelleKatalog(JSON.stringify({ massnahmen: [invalid] }), "Testkommune"));
  }
  // Generation asks for 8–12; acceptance is intentionally independent of that target.
  assert.equal(leseKatalog({ ...valid, massnahmen: Array.from({ length: 15 }, () => item) }).massnahmen.length, 15);
});

test("every accepted measure appears once in both grouping and export", () => {
  const massnahmen = ["eigen", "fremd"].flatMap((verantwortung) => ["niedrig", "hoch"].map((aufwand) => ({
    titel: `${verantwortung} ${aufwand}`, beschreibung: "Konkrete Maßnahme", bereich: "Personal", aufwand, verantwortung,
    ...(verantwortung === "fremd" ? { wer: "Amtsleitung", eigener_beitrag: "Vorschlag vorbereiten" } : {}),
  })));
  const accepted = erstelleKatalog("```json\n" + JSON.stringify({ massnahmen }) + "\n```", "Testkommune");
  const groups = gruppiereKatalog(accepted);
  assert.equal(groups.length, 4);
  assert.ok(groups.every((g) => g.massnahmen.length === 1));
  assert.deepEqual(groups.flatMap((g) => g.massnahmen), accepted.massnahmen);
  const exported = exportiereKatalog(accepted);
  for (const m of accepted.massnahmen) assert.equal(exported.split(`### ${m.titel}\n`).length - 1, 1);
  assert.match(exported, /\*\*Entscheidet:\*\* Amtsleitung/);
  assert.match(exported, /\*\*Dein Beitrag:\*\* Vorschlag vorbereiten/);
});
