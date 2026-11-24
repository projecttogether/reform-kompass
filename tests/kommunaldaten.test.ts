import test from "node:test";
import assert from "node:assert/strict";
import kommunen from "../src/data/kommunen.json";
import grunddaten from "../src/data/kommunen-grunddaten.json";
import { anzeigeText, type Kommune } from "../src/lib/kommunen";
import { findeGrunddaten, formatiereKommunaldaten, GRUNDDATEN_STAND } from "../src/lib/kommunaldaten";
import { GET } from "../src/app/api/kommunaldaten/route";

test("every selectable municipality has a unique display text and official base data", () => {
  const texte = (kommunen as Kommune[]).map(anzeigeText);
  assert.equal(new Set(texte).size, texte.length, "display texts must identify one municipality");
  for (const text of texte) assert.ok(findeGrunddaten(text), `no base data for ${text}`);
});

test("same-named municipalities in one district are told apart by their association", () => {
  const anklam = findeGrunddaten("Neuenkirchen (Amt Anklam-Land), Vorpommern-Greifswald (Mecklenburg-Vorpommern)");
  const landhagen = findeGrunddaten("Neuenkirchen (Amt Landhagen), Vorpommern-Greifswald (Mecklenburg-Vorpommern)");
  assert.ok(anklam && landhagen);
  assert.notEqual(anklam.ags, landhagen.ags);
});

test("base data prompt cites source and date; free text and districts get no invented figures", () => {
  const prompt = formatiereKommunaldaten("Flensburg, Stadt (Schleswig-Holstein)");
  assert.match(prompt, /Amtlicher Gemeindeschlüssel 01001000/);
  assert.match(prompt, new RegExp(`Stand ${GRUNDDATEN_STAND.datenstand.replaceAll(".", "\\.")}`));
  assert.match(prompt, /Einwohner:innen: \d{1,3}(\.\d{3})*/);
  assert.ok(!prompt.includes("Kreis:"), "a district-free city has no separate district line");
  assert.match(prompt, /Schulden pro Kopf: \d{1,3}(\.\d{3})* € \(Durchschnitt der Kommunen in Schleswig-Holstein: /);
  assert.match(prompt, /Arbeitsmarkt: .*sozialversicherungspflichtig Beschäftigte mit Arbeitsort/);
  assert.match(prompt, /Bundesagentur für Arbeit, Stand \d\d\.\d\d\.\d{4}/);

  // Stadtstaaten fehlen in der Schuldenstatistik: kein Wert, ausdrücklich gekennzeichnet, keine Quelle dafür.
  const berlin = formatiereKommunaldaten("Berlin, Stadt (Berlin)");
  assert.match(berlin, /Schulden pro Kopf: keine Angabe/);
  assert.ok(!berlin.includes("Integrierte Schulden"));

  const landkreis = formatiereKommunaldaten("Landkreis Oder-Spree");
  assert.match(landkreis, /keine amtlichen Grunddaten vor/);
  assert.ok(!/Einwohner:innen: \d/.test(landkreis));
});

test("structure data come from the municipality, else its association, else its district without finances", () => {
  const prompt = (ags: string) => formatiereKommunaldaten(anzeigeText(grunddaten.gemeinden.find((g) => g.ags === ags)!));

  const flensburg = prompt("01001000");
  assert.match(flensburg, /Strukturdaten \(Wegweiser Kommune, Landeswerte zum Vergleich\):/);
  assert.match(flensburg, /- Demografietyp \d+ der Bertelsmann Stiftung: /);
  assert.match(flensburg, /- Medianalter der Bevölkerung: \d+(,\d)? Jahre \(20\d\d; Schleswig-Holstein: \d+(,\d)? Jahre\)/);
  assert.match(flensburg, /- Vorausberechnung bis 2040: Bevölkerung [+−±]/);
  assert.match(flensburg, /- Steuereinnahmen pro Kopf/);
  assert.match(flensburg, /Bertelsmann Stiftung, Wegweiser Kommune, abgerufen am/);

  // Kleine Gemeinde in einer Samtgemeinde: Werte der Samtgemeinde, ausdrücklich so benannt.
  const verband = prompt("03360001");
  assert.match(verband, /gelten für Samtgemeinde Bevensen-Ebstorf, nicht für die Gemeinde allein/);
  assert.match(verband, /- Personalausgaben pro Kopf/);

  // Kleine amtsangehörige Gemeinde ohne Werte für das Amt: nur Kreiswerte zur Bevölkerung.
  const kreis = prompt("01051003");
  assert.match(kreis, /gelten für Kreis Dithmarschen, nicht für die Gemeinde allein/);
  assert.match(kreis, /- Medianalter der Bevölkerung: /);
  assert.ok(!kreis.includes("Steuereinnahmen") && !kreis.includes("Personalausgaben"), "district budgets say nothing about the municipality");
});

test("base data route answers without AI and reports unknown names", async () => {
  const bekannt = await (await GET(new Request("http://localhost/api/kommunaldaten?name=" + encodeURIComponent("Flensburg, Stadt (Schleswig-Holstein)")))).json();
  assert.equal(bekannt.gefunden, true);
  assert.equal(bekannt.ags, "01001000");
  assert.match(bekannt.quelle, /^Destatis, Stand /);
  assert.deepEqual(await (await GET(new Request("http://localhost/api/kommunaldaten?name=Irgendwo"))).json(), { gefunden: false });
});
