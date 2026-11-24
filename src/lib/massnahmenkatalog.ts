import { KATEGORIEN } from "./reifegrad-model";

type MassnahmeInhalt = {
  titel: string;
  beschreibung: string;
  bereich: string;
  aufwand: "niedrig" | "hoch";
};
export type Massnahme = MassnahmeInhalt & (
  | { verantwortung: "eigen" }
  | { verantwortung: "fremd"; wer: string; eigener_beitrag: string }
);

export interface Katalog {
  version: number;
  org_name: string;
  erstellt_am: string;
  disclaimer: string;
  massnahmen: Massnahme[];
}

const GRUPPEN = [
  { id: "eigen-niedrig", label: "Direkt umsetzbar · niedriger Aufwand", aufwand: "niedrig", verantwortung: "eigen" },
  { id: "eigen-hoch", label: "Direkt umsetzbar · höherer Aufwand", aufwand: "hoch", verantwortung: "eigen" },
  { id: "fremd-niedrig", label: "Braucht andere · niedrigschwellig anstoßen", aufwand: "niedrig", verantwortung: "fremd" },
  { id: "fremd-hoch", label: "Braucht andere · größere Initiative nötig", aufwand: "hoch", verantwortung: "fremd" },
] as const;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültiger Maßnahmenkatalog");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Unvollständige Maßnahme");
  return value.trim();
}

function leseMassnahmen(value: unknown): Massnahme[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Der Maßnahmenkatalog enthält keine Maßnahmen");
  const bereiche = new Set(Object.values(KATEGORIEN).map((k) => k.label));
  return value.map((entry) => {
    const m = object(entry);
    const bereich = text(m.bereich);
    if (!bereiche.has(bereich)) throw new Error("Unbekannter Maßnahmenbereich");
    if (m.aufwand !== "niedrig" && m.aufwand !== "hoch") throw new Error("Ungültiger Aufwand");
    const inhalt: MassnahmeInhalt = { titel: text(m.titel), beschreibung: text(m.beschreibung), bereich, aufwand: m.aufwand };
    if (m.verantwortung === "fremd") {
      return { ...inhalt, verantwortung: "fremd", wer: text(m.wer), eigener_beitrag: text(m.eigener_beitrag) };
    }
    if (m.verantwortung !== "eigen") throw new Error("Ungültige Verantwortung");
    return { ...inhalt, verantwortung: "eigen" };
  });
}

export function leseKatalog(value: unknown): Katalog {
  const k = object(value);
  if (typeof k.version !== "number" || !Number.isFinite(k.version)) throw new Error("Ungültige Katalogversion");
  const erstellt_am = text(k.erstellt_am);
  if (!Number.isFinite(Date.parse(erstellt_am))) throw new Error("Ungültiges Katalogdatum");
  return { version: k.version, org_name: text(k.org_name), erstellt_am, disclaimer: text(k.disclaimer), massnahmen: leseMassnahmen(k.massnahmen) };
}

export function erstelleKatalog(antwort: string, orgName: string): Katalog {
  const json = antwort.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Kein JSON in Katalogantwort");
  const parsed = object(JSON.parse(json));
  return leseKatalog({
    version: Date.now(),
    org_name: orgName,
    erstellt_am: new Date().toISOString(),
    disclaimer: "KI-generierter Maßnahmenkatalog auf Basis Ihrer Selbsteinschätzung im Modernisierungs-Check. Die Maßnahmen können im Gespräch mit der KI-Beratung weiter vertieft, verfeinert und ergänzt werden.",
    massnahmen: parsed.massnahmen,
  });
}

export function gruppiereKatalog(katalog: Katalog) {
  return GRUPPEN.map((gruppe) => ({
    ...gruppe,
    massnahmen: katalog.massnahmen.filter((m) => m.aufwand === gruppe.aufwand && m.verantwortung === gruppe.verantwortung),
  }));
}

export function exportiereKatalog(katalog: Katalog): string {
  const lines = [`# Maßnahmenkatalog: ${katalog.org_name}`, `Erstellt: ${new Date(katalog.erstellt_am).toLocaleDateString("de-DE")}`, "", `> ${katalog.disclaimer}`, ""];
  for (const gruppe of gruppiereKatalog(katalog)) {
    if (!gruppe.massnahmen.length) continue;
    lines.push(`## ${gruppe.label}`, "");
    for (const m of gruppe.massnahmen) {
      lines.push(`### ${m.titel}`, `**Bereich:** ${m.bereich}`, "", m.beschreibung);
      if (m.verantwortung === "fremd") lines.push(`**Entscheidet:** ${m.wer}`, `**Dein Beitrag:** ${m.eigener_beitrag}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
