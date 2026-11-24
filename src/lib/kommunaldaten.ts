import daten from "@/data/kommunen-grunddaten.json";
import wegweiser from "@/data/kommunen-wegweiser.json";
import { anzeigeText, type Kommune } from "./kommunen";

// Amtliche Grunddaten je Gemeinde, erzeugt mit scripts/kommunen-aktualisieren.py,
// ergänzt um Strukturdaten aus dem Wegweiser Kommune (scripts/wegweiser-aktualisieren.py).
export interface Grunddaten extends Kommune {
  ags: string;
  art: string;
  kreisArt: string | null;
  verband: string | null;
  verbandArt: string | null;
  /** Neunstelliger Regionalschlüssel des Gemeindeverbands. */
  verbandArs: string | null;
  einwohner: number | null;
  flaecheKm2: number | null;
  einwohnerJeKm2: number | null;
  verstaedterung: string | null;
  /** Integrierte Schulden pro Kopf in Euro, Veränderung im Jahr in Prozent. */
  schulden: { proKopf: number | null; veraenderungProzent: number | null; landProKopf: number | null } | null;
  /** Sozialversicherungspflichtig Beschäftigte nach Wohn- und Arbeitsort. */
  beschaeftigung: { wohnort: number | null; arbeitsort: number | null; einpendler: number | null; auspendler: number | null; betriebe: number | null } | null;
}

export const GRUNDDATEN_STAND = { quelle: daten.quelle, gebietsstand: daten.gebietsstand, datenstand: daten.datenstand };

let index: Map<string, Grunddaten> | undefined;

/** Findet die Gemeinde zum Anzeigetext der Kommunenauswahl. Freitext und Landkreise ergeben null. */
export function findeGrunddaten(orgName: string): Grunddaten | null {
  index ??= new Map((daten.gemeinden as Grunddaten[]).map((g) => [anzeigeText(g), g]));
  return index.get(orgName.trim()) ?? null;
}

const zahl = (n: number, stellen = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: stellen });

/** Kurzfassung für die Anzeige unter der Kommunenauswahl. */
export function kurzfassung(g: Grunddaten): string {
  return [
    g.einwohner != null && `${zahl(g.einwohner)} Einwohner:innen`,
    g.flaecheKm2 != null && `${zahl(g.flaecheKm2, 1)} km²`,
    g.verstaedterung,
  ].filter(Boolean).join(" · ");
}

/** Prompt-Abschnitt mit belegten Grunddaten oder dem Hinweis, dass keine vorliegen. */
export function formatiereKommunaldaten(orgName: string): string {
  const g = findeGrunddaten(orgName);
  if (!g) {
    return `## Amtliche Grunddaten zur Kommune

Für „${orgName}“ liegen keine amtlichen Grunddaten vor, weil keine einzelne Gemeinde aus dem Gemeindeverzeichnis gewählt wurde (etwa bei einem Landkreis oder einer freien Eingabe). Nenne keine Einwohnerzahlen oder anderen Kennzahlen zu dieser Verwaltung, die nicht im Gespräch genannt wurden.`;
  }
  const zeilen = [
    `Gemeinde: ${g.name} (${g.art}), Amtlicher Gemeindeschlüssel ${g.ags}`,
    `Bundesland: ${g.bundesland}`,
    g.kreis && g.kreis !== g.name && `Kreis: ${g.kreis}${g.kreisArt ? ` (${g.kreisArt})` : ""}`,
    g.verband && `Gemeindeverband: ${g.verbandArt} ${g.verband}`,
    g.einwohner != null && `Einwohner:innen: ${zahl(g.einwohner)}`,
    g.flaecheKm2 != null && `Fläche: ${zahl(g.flaecheKm2, 2)} km²${g.einwohnerJeKm2 != null ? `, ${zahl(g.einwohnerJeKm2)} Einwohner:innen je km²` : ""}`,
    g.verstaedterung && `Grad der Verstädterung: ${g.verstaedterung}`,
    schuldenZeile(g),
    beschaeftigungZeile(g),
  ].filter(Boolean);
  const struktur = strukturZeilen(g);
  const quellen = [
    `${daten.quelle}: Gebietsstand ${daten.gebietsstand}; Fläche und Bevölkerung Stand ${daten.datenstand}, Bevölkerung auf Grundlage des Zensus 2022 (kurz: „Destatis, Stand ${daten.datenstand}“)`,
    g.schulden && `${daten.schulden.quelle}, Stand ${daten.schulden.stand}. ${daten.schulden.hinweis} (kurz: „Destatis, Schulden Stand ${daten.schulden.stand}“)`,
    g.beschaeftigung && `${daten.beschaeftigung.quelle}, Stichtag ${daten.beschaeftigung.stand} (kurz: „Bundesagentur für Arbeit, Stand ${daten.beschaeftigung.stand}“)`,
    struktur && `${wegweiser.quelle}, abgerufen am ${datum(wegweiser.abgerufenAm)}, auf Grundlage der Statistischen Ämter, der Bundesagentur für Arbeit und des Breitbandatlas; das Jahr steht jeweils am Wert (kurz: „Wegweiser Kommune, Jahr“)`,
  ].filter(Boolean);
  return `## Amtliche Grunddaten zur Kommune

${zeilen.map((z) => `- ${z}`).join("\n")}
${struktur ? `\n${struktur}\n` : ""}
Quellen:
${quellen.map((q) => `- ${q}`).join("\n")}

Nutze diese Angaben nur, wenn sie eine Empfehlung tatsächlich verändern, etwa durch die Größe der Verwaltung, ländliche oder städtische Lage, Alterung und Bevölkerungsentwicklung, den finanziellen Spielraum, die soziale Lage, die Rolle als Arbeitsort oder die Zusammenarbeit in Gemeindeverband und Kreis. Wenn du dich darauf stützt, nenne den Befund und die jeweilige Quelle in Kurzform. Ergänze keine weiteren Kennzahlen aus eigenem Wissen und stelle keine Vermutungen als Fakten dar.`;
}

function schuldenZeile(g: Grunddaten): string | false {
  const s = g.schulden;
  if (s?.proKopf == null) return "Schulden pro Kopf: keine Angabe in der amtlichen Schuldenstatistik";
  const vergleich = s.landProKopf != null ? ` (Durchschnitt der Kommunen in ${g.bundesland}: ${zahl(s.landProKopf)} €)` : "";
  const veraenderung = s.veraenderungProzent != null ? `, Veränderung im Jahr ${daten.schulden.stand.slice(-4)}: ${s.veraenderungProzent > 0 ? "+" : ""}${zahl(s.veraenderungProzent, 1)} %` : "";
  return `Schulden pro Kopf: ${zahl(s.proKopf)} €${vergleich}${veraenderung}`;
}

function beschaeftigungZeile(g: Grunddaten): string | false {
  const b = g.beschaeftigung;
  if (b?.arbeitsort == null || b.wohnort == null) return "Arbeitsmarkt: keine Angabe in der Beschäftigungsstatistik";
  const rolle = b.wohnort > 0 && b.arbeitsort / b.wohnort >= 1.1 ? "mehr Arbeitsplätze als beschäftigte Einwohner:innen (Einpendlerort)"
    : b.wohnort > 0 && b.arbeitsort / b.wohnort <= 0.9 ? "weniger Arbeitsplätze als beschäftigte Einwohner:innen (Auspendlerort)"
    : "ungefähr so viele Arbeitsplätze wie beschäftigte Einwohner:innen";
  const teile = [
    `${zahl(b.arbeitsort)} sozialversicherungspflichtig Beschäftigte mit Arbeitsort in der Gemeinde`,
    `${zahl(b.wohnort)} mit Wohnort in der Gemeinde`,
    b.einpendler != null && b.auspendler != null && `${zahl(b.einpendler)} Einpendler:innen, ${zahl(b.auspendler)} Auspendler:innen`,
    b.betriebe != null && `${zahl(b.betriebe)} Betriebe`,
  ].filter(Boolean);
  return `Arbeitsmarkt: ${teile.join(", ")}; ${rolle}`;
}

type Wert = [number, number];
type Region = { name: string; werte: Partial<Record<keyof typeof wegweiser.indikatoren, Wert>>; demografietyp?: number };
const regionen = wegweiser as unknown as Record<"gemeinden" | "verbaende" | "kreise" | "laender", Record<string, Region>>;

const datum = (iso: string) => iso.split("-").reverse().join(".");
const mitVorzeichen = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${zahl(Math.abs(n), 1)}`;

/**
 * Strukturdaten aus dem Wegweiser Kommune. Gemeinden unter 5.000 Einwohner:innen haben dort keine
 * eigenen Werte; dann gelten die des Gemeindeverbands oder, ohne Finanzwerte, die des Kreises.
 */
function strukturZeilen(g: Grunddaten): string | null {
  const eigene = regionen.gemeinden[g.ags];
  const verband = !eigene && g.verbandArs ? regionen.verbaende[g.verbandArs] : undefined;
  const kreis = !eigene && !verband ? regionen.kreise[g.ags.slice(0, 5)] : undefined;
  const r = eigene ?? verband ?? kreis;
  if (!r) return null;
  const land = regionen.laender[g.bundesland]?.werte ?? {};
  const w = r.werte;
  const vergleich = (schluessel: keyof Region["werte"], format: (n: number) => string) =>
    land[schluessel] ? `; ${g.bundesland}: ${format(land[schluessel][0])}` : "";

  const zeilen = [
    r.demografietyp && `Demografietyp ${r.demografietyp} der Bertelsmann Stiftung: ${wegweiser.demografietypen[String(r.demografietyp) as keyof typeof wegweiser.demografietypen]}`,
    w.entwicklung5Jahre && `Bevölkerungsentwicklung der letzten fünf Jahre: ${mitVorzeichen(w.entwicklung5Jahre[0])} % (${w.entwicklung5Jahre[1]}${vergleich("entwicklung5Jahre", (n) => `${mitVorzeichen(n)} %`)})`,
    w.medianalter && `Medianalter der Bevölkerung: ${zahl(w.medianalter[0], 1)} Jahre (${w.medianalter[1]}${vergleich("medianalter", (n) => `${zahl(n, 1)} Jahre`)})`,
    (w.entwicklungBis2040 || w.medianalter2040) && `Vorausberechnung bis 2040: ${[
      w.entwicklungBis2040 && `Bevölkerung ${mitVorzeichen(w.entwicklungBis2040[0])} % gegenüber 2020`,
      w.medianalter2040 && `Medianalter der Bevölkerung ${zahl(w.medianalter2040[0], 1)} Jahre`,
    ].filter(Boolean).join(", ")}`,
    !kreis && w.steuernProKopf && `Steuereinnahmen pro Kopf, Mittel der letzten vier Jahre: ${zahl(w.steuernProKopf[0])} € (${w.steuernProKopf[1]}${vergleich("steuernProKopf", (n) => `${zahl(n)} €`)})`,
    !kreis && w.personalProKopf && `Personalausgaben pro Kopf: ${zahl(w.personalProKopf[0])} € (${w.personalProKopf[1]}). Sie hängen stark davon ab, welche Aufgaben selbst erledigt, ausgelagert oder vom Gemeindeverband oder Kreis übernommen werden; vergleiche sie nur vorsichtig.`,
    w.sgb2Quote && `SGB-II-Quote, Anteil der unter 65-Jährigen mit Bürgergeld: ${zahl(w.sgb2Quote[0], 1)} % (${w.sgb2Quote[1]}${vergleich("sgb2Quote", (n) => `${zahl(n, 1)} %`)})`,
    w.breitband && `Haushalte mit mindestens 100 Mbit/s: ${zahl(w.breitband[0], 1)} % (${w.breitband[1]}${vergleich("breitband", (n) => `${zahl(n, 1)} %`)})`,
  ].filter(Boolean);
  const kopf = eigene ? "Strukturdaten (Wegweiser Kommune, Landeswerte zum Vergleich):"
    : `Strukturdaten (Wegweiser Kommune): Für Gemeinden unter 5.000 Einwohner:innen gibt es dort keine eigenen Werte. Die folgenden gelten für ${verband ? `${g.verbandArt} ${g.verband}` : `${g.kreisArt ?? "Kreis"} ${g.kreis}`}, nicht für die Gemeinde allein:`;
  return `${kopf}\n${zeilen.map((z) => `- ${z}`).join("\n")}`;
}
