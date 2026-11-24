import { leseBestehendenBewertungStand, leseBewertungStand, type BewertungStand } from "@/lib/bewertung";
import { FRAGEBOGEN_VERSION } from "@/lib/reifegrad-model";

// The current assessment in this browser tab. A reload restores it; closing the tab discards it.
// `bewertungId` links the tab to a saved assessment of the signed-in member.

export const SITZUNGS_SCHLUESSEL = "kompass_sitzung";
const ALTER_SCHLUESSEL = "kompass_state";

export interface Sitzung {
  stand: BewertungStand;
  bewertungId: string | null;
  /** Revision of the saved assessment this tab last wrote or loaded. */
  revision: number | null;
}

// Keeps context and answers when the conversation no longer passes validation.
function ohneBeratung(stand: unknown): BewertungStand {
  const roh = (stand ?? {}) as Record<string, unknown>;
  return leseBewertungStand({ ...roh, phase: roh.phase === "chat" ? "ergebnis" : roh.phase, nachrichten: [], katalog: null });
}

// Format written before saved assessments existed (until November 2026).
function ausAltemFormat(alt: Record<string, unknown>): BewertungStand {
  return leseBestehendenBewertungStand({
    version: 1,
    fragebogenVersion: FRAGEBOGEN_VERSION,
    phase: alt.phase,
    aktuelleFrage: alt.aktuelleFrageIndex ?? 0,
    kontext: { orgName: alt.kommune, funktion: alt.funktion ?? "", positionFachbereich: alt.positionFachbereich ?? "", ebene: alt.ebene ?? "gesamtverwaltung" },
    antworten: alt.antworten ?? {},
    nachrichten: alt.messages ?? [],
    katalog: alt.katalog ?? null,
  });
}

export function ladeSitzung(): Sitzung | null {
  try {
    const roh = sessionStorage.getItem(SITZUNGS_SCHLUESSEL);
    if (roh) {
      const gespeichert = JSON.parse(roh) as { stand?: unknown; bewertungId?: unknown; revision?: unknown };
      let stand: BewertungStand;
      try { stand = leseBestehendenBewertungStand(gespeichert.stand); } catch { stand = ohneBeratung(gespeichert.stand); }
      return {
        stand,
        bewertungId: typeof gespeichert.bewertungId === "string" ? gespeichert.bewertungId : null,
        revision: Number.isInteger(gespeichert.revision) ? gespeichert.revision as number : null,
      };
    }
    const alt = sessionStorage.getItem(ALTER_SCHLUESSEL);
    if (alt) {
      return { stand: ausAltemFormat(JSON.parse(alt)), bewertungId: null, revision: null };
    }
  } catch {
    // Invalid or outdated tab state starts a fresh assessment.
  }
  return null;
}

export function speichereSitzung(sitzung: Sitzung) {
  try { sessionStorage.setItem(SITZUNGS_SCHLUESSEL, JSON.stringify(sitzung)); sessionStorage.removeItem(ALTER_SCHLUESSEL); } catch {}
}

export function loescheSitzung() {
  try {
    sessionStorage.removeItem(SITZUNGS_SCHLUESSEL);
    sessionStorage.removeItem(ALTER_SCHLUESSEL);
  } catch {}
}
