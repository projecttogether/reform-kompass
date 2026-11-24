import fs from "fs";
import path from "path";
import { z } from "zod";

// The operator's content: advice texts, product name, and footer. It lives in one folder
// outside the code, so one image serves any operator. Read at request time.

export const PROMPT_DATEI = "system-prompt.md";
export const WISSEN_DATEI = "knowledge-base.md";
export const BETREIBER_DATEI = "betreiber.json";

const link = z.strictObject({
  text: z.string().trim().min(1).max(120),
  // Rendered as href, so only web and mail links are accepted.
  url: z.string().regex(/^(https:\/\/|mailto:)\S+$/).max(500),
});

const betreiberSchema = z.strictObject({
  /** Product name in titles, logo text, emails, and PDFs. */
  name: z.string().trim().min(1).max(60),
  /** Footer lines on the start page. */
  fusszeile: z.array(z.strictObject({ text: z.string().trim().min(1).max(300), link: link.optional() })).max(6).default([]),
});

export type Betreiber = z.output<typeof betreiberSchema>;

const STANDARD: Betreiber = { name: "Reform-Kompass", fusszeile: [] };

/** KOMPASS_INHALTE_DIR, or inhalte/ in the working directory. */
export function inhalteOrdner(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.KOMPASS_INHALTE_DIR?.trim() || "inhalte");
}

/** An unreadable file counts as empty, so missing advice texts never break the assessment. */
export function leseInhalt(datei: string): string {
  try {
    return fs.readFileSync(path.join(/* turbopackIgnore: true */ inhalteOrdner(), datei), "utf-8");
  } catch {
    return "";
  }
}

function pruefeBetreiber(): Betreiber | null {
  try {
    const ergebnis = betreiberSchema.safeParse(JSON.parse(leseInhalt(BETREIBER_DATEI)));
    return ergebnis.success ? ergebnis.data : null;
  } catch {
    return null;
  }
}

/** Name and footer; neutral defaults when betreiber.json is missing or invalid. */
export function leseBetreiber(): Betreiber {
  return pruefeBetreiber() ?? STANDARD;
}

/** Returns content files that are missing, empty, or invalid. */
export function fehlendeInhalte(): string[] {
  const fehlend = [PROMPT_DATEI, WISSEN_DATEI].filter((datei) => !leseInhalt(datei).trim());
  if (!pruefeBetreiber()) fehlend.push(`${BETREIBER_DATEI} (gültiges JSON mit "name")`);
  return fehlend;
}

/** Logs the content folder at server start, or which files are unusable. */
export function meldeInhalte() {
  const fehlend = fehlendeInhalte();
  if (fehlend.length === 0) console.info(`Inhalte: ${inhalteOrdner()} (${leseBetreiber().name}).`);
  else console.warn(`Inhalte unvollständig in ${inhalteOrdner()}: ${fehlend.join(", ")}`);
}
