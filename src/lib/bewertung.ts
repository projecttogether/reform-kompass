import { z } from "zod";
import { berechneScore, leseReifegrad, EBENEN, FRAGEN, FRAGEBOGEN_VERSION, KATEGORIEN, type Ebene, type Kategorie, type ScoreResult } from "./reifegrad-model";
import { leseKatalog, type Katalog } from "./massnahmenkatalog";
import type { Nachricht } from "./beratung";

// A saved assessment: the state needed to resume /check. Scores are never stored;
// they are recomputed from the answers with the current questionnaire.

export const BEWERTUNG_PHASEN = ["kontext", "assessment", "ergebnis", "chat"] as const;
export type BewertungPhase = (typeof BEWERTUNG_PHASEN)[number];

export interface BewertungKontext {
  orgName: string;
  funktion: string;
  positionFachbereich: string;
  ebene: Ebene;
}

export interface BewertungStand {
  version: 1;
  fragebogenVersion: number;
  phase: BewertungPhase;
  aktuelleFrage: number;
  kontext: BewertungKontext;
  antworten: Record<string, number>;
  nachrichten: Nachricht[];
  katalog: Katalog | null;
}

export const MAX_NACHRICHTEN = 500;
const MAX_NACHRICHT_ZEICHEN = 20_000;
const MAX_KONTEXT_ZEICHEN = 300;

const kontextText = z.string().trim().max(MAX_KONTEXT_ZEICHEN);
const nachrichtSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_NACHRICHT_ZEICHEN),
  rueckfrage: z.object({ frage: z.string().max(MAX_NACHRICHT_ZEICHEN), optionen: z.array(z.string().max(MAX_NACHRICHT_ZEICHEN)).max(5) }).optional(),
  error: z.boolean().optional(),
});
const standSchema = z.object({
  version: z.literal(1),
  fragebogenVersion: z.number().int().positive(),
  phase: z.enum(BEWERTUNG_PHASEN),
  aktuelleFrage: z.number().int().min(0).max(FRAGEN.length - 1),
  kontext: z.object({
    orgName: kontextText.min(1),
    funktion: kontextText,
    positionFachbereich: kontextText,
    ebene: z.enum(Object.keys(EBENEN) as [Ebene, ...Ebene[]]),
  }),
  antworten: z.record(z.string(), z.unknown()),
  nachrichten: z.array(nachrichtSchema).max(MAX_NACHRICHTEN),
  katalog: z.unknown().nullable(),
});

/** Validates untrusted input (browser storage, request bodies, stored rows). Throws on invalid input. */
export function leseBewertungStand(input: unknown): BewertungStand {
  const parsed = standSchema.safeParse(input);
  if (!parsed.success) throw new Error("Ungültiger Bewertungsstand");
  const { kontext, antworten, nachrichten, katalog, ...rest } = parsed.data;
  leseReifegrad(antworten, kontext.ebene);
  return {
    ...rest,
    kontext,
    antworten: { ...(antworten as Record<string, number>) },
    // Client-side error notices are display state, not conversation.
    nachrichten: nachrichten.filter((n) => !n.error).map(({ role, content, rueckfrage }) => (rueckfrage ? { role, content, rueckfrage } : { role, content })),
    katalog: katalog === null || katalog === undefined ? null : leseKatalog(katalog),
  };
}

/** Read existing data without losing valid answers because an old catalogue was malformed. */
export function leseBestehendenBewertungStand(input: unknown): BewertungStand {
  try { return leseBewertungStand(input); }
  catch (error) {
    if (!input || typeof input !== "object" || Array.isArray(input) || !("katalog" in input) || input.katalog == null) throw error;
    // All other fields, including answers and conversation, still pass strict validation.
    return leseBewertungStand({ ...input, katalog: null });
  }
}

/** Key-order independent JSON, for comparing states that went through the database. */
export function kanonisch(wert: unknown): string {
  return JSON.stringify(wert, (_schluessel, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v);
}

/**
 * Canonical JSON of a state as the server stores it (trimmed context, no error notices),
 * so a local state and its saved copy compare equal. Invalid states keep their raw form;
 * the server rejects them anyway.
 */
export function gespeicherteForm(stand: BewertungStand): string {
  try {
    return kanonisch(leseBewertungStand(stand));
  } catch {
    return kanonisch(stand);
  }
}

export function neuerBewertungStand(kontext: BewertungKontext): BewertungStand {
  return { version: 1, fragebogenVersion: FRAGEBOGEN_VERSION, phase: "assessment", aktuelleFrage: 0, kontext, antworten: {}, nachrichten: [], katalog: null };
}

export function ergebnis(stand: Pick<BewertungStand, "antworten" | "kontext">): ScoreResult {
  return berechneScore(stand.antworten, stand.kontext.ebene);
}

export interface BewertungUebersicht {
  kommune: string;
  ebene: Ebene;
  ebeneLabel: string;
  phase: BewertungPhase;
  fragebogenVersion: number;
  prozent: number;
  stufe: string;
  stufeLabel: string;
  beantworteteFragen: number;
  gesamtFragen: number;
  massnahmen: number;
  nachrichten: number;
}

export function uebersicht(stand: BewertungStand): BewertungUebersicht {
  const score = ergebnis(stand);
  return {
    kommune: stand.kontext.orgName,
    ebene: stand.kontext.ebene,
    ebeneLabel: EBENEN[stand.kontext.ebene].label,
    phase: stand.phase,
    fragebogenVersion: stand.fragebogenVersion,
    prozent: score.prozent,
    stufe: score.stufe,
    stufeLabel: score.stufeLabel,
    beantworteteFragen: score.beantworteteFragen,
    gesamtFragen: score.gesamtFragen,
    massnahmen: stand.katalog?.massnahmen.length ?? 0,
    nachrichten: stand.nachrichten.length,
  };
}

/**
 * Overview of a stored state read without its conversation and catalogue (`kopf`),
 * plus how many messages and measures those hold. Lists read only this much, because
 * a full state can reach 4 MiB. Null when the answers no longer fit the questionnaire.
 */
export function uebersichtAusKopf(kopf: unknown, anzahl: { nachrichten: number; massnahmen: number }): BewertungUebersicht | null {
  if (!kopf || typeof kopf !== "object" || Array.isArray(kopf)) return null;
  let stand: BewertungStand;
  try { stand = leseBewertungStand({ ...kopf, nachrichten: [], katalog: null }); } catch { return null; }
  return { ...uebersicht(stand), nachrichten: anzahl.nachrichten, massnahmen: anzahl.massnahmen };
}

export interface VergleichZeile {
  kategorie: Kategorie | "gesamt";
  label: string;
  a: number | null;
  b: number | null;
  differenz: number | null;
}

export interface Vergleich {
  zeilen: VergleichZeile[];
  hinweise: string[];
}

/** Compares two assessments by percentage. A category without answers has no value. */
export function vergleiche(a: BewertungStand, b: BewertungStand): Vergleich {
  const ea = ergebnis(a);
  const eb = ergebnis(b);
  const zeile = (kategorie: VergleichZeile["kategorie"], label: string, pa: number | null, pb: number | null): VergleichZeile =>
    ({ kategorie, label, a: pa, b: pb, differenz: pa === null || pb === null ? null : pb - pa });
  const zeilen = [
    zeile("gesamt", "Gesamt", ea.beantworteteFragen ? ea.prozent : null, eb.beantworteteFragen ? eb.prozent : null),
    ...(Object.keys(KATEGORIEN) as Kategorie[]).map((k) => {
      const ka = ea.kategorieScores[k];
      const kb = eb.kategorieScores[k];
      return zeile(k, KATEGORIEN[k].label, ka.beantwortet ? ka.prozent : null, kb.beantwortet ? kb.prozent : null);
    }),
  ];
  const hinweise: string[] = [];
  if (a.fragebogenVersion !== b.fragebogenVersion) {
    hinweise.push("Die Bewertungen beruhen auf unterschiedlichen Fassungen des Fragebogens. Die Werte sind nur eingeschränkt vergleichbar.");
  }
  if (a.kontext.ebene !== b.kontext.ebene) {
    hinweise.push(`Die Bewertungen betreffen unterschiedliche Ebenen (${EBENEN[a.kontext.ebene].label} und ${EBENEN[b.kontext.ebene].label}).`);
  }
  if (ea.beantworteteFragen < ea.gesamtFragen || eb.beantworteteFragen < eb.gesamtFragen) {
    hinweise.push("Mindestens eine Bewertung ist unvollständig. Prozentwerte beziehen sich nur auf beantwortete Fragen.");
  }
  return { zeilen, hinweise };
}
