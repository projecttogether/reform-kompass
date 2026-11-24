import type { BewertungStand } from "./bewertung";
import type { Profil } from "./konten";

// Browser transport for the account and saved-assessment routes.

export class KontoAnfrageFehler extends Error {
  constructor(public status: number, public code: string, meldung: string) { super(meldung); }
}

async function senden(url: string, methode: string, body?: unknown, keepalive = false): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: methode,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  const daten = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new KontoAnfrageFehler(res.status, String(daten.code ?? ""), String(daten.error ?? "Die Anfrage ist fehlgeschlagen."));
  return daten;
}

export const kontoBrowser = {
  async erstelleBewertung(stand: BewertungStand): Promise<{ id: string; revision: number }> {
    const daten = await senden("/api/bewertungen", "POST", { stand });
    return { id: String(daten.id), revision: Number(daten.revision) };
  },
  /** Saves on top of `revision` and returns the new revision. `keepalive` lets the request outlive the page. */
  async speichereBewertung(id: string, stand: BewertungStand, revision: number, keepalive = false): Promise<number> {
    const daten = await senden(`/api/bewertungen/${encodeURIComponent(id)}`, "PUT", { stand, revision }, keepalive);
    return Number(daten.revision);
  },
  async ladeBewertung(id: string): Promise<{ revision: number; stand: BewertungStand }> {
    const daten = await senden(`/api/bewertungen/${encodeURIComponent(id)}`, "GET");
    return { revision: Number(daten.revision), stand: daten.stand as BewertungStand };
  },
  async loescheBewertung(id: string) {
    await senden(`/api/bewertungen/${encodeURIComponent(id)}`, "DELETE");
  },
  async speichereProfil(profil: Profil) {
    await senden("/api/konto", "PUT", { profil });
  },
  async fordereLoeschcodeAn() {
    await senden("/api/konto/loeschcode", "POST", {});
  },
  async loescheKonto(code: string): Promise<string | null> {
    const daten = await senden("/api/konto/loeschen", "POST", { code });
    return typeof daten.endgueltigAm === "string" ? daten.endgueltigAm : null;
  },
  async stelleWiederHer() {
    await senden("/api/konto/wiederherstellen", "POST", {});
  },
};

const INTERN = "http://intern.invalid";

/**
 * Only paths on this site are allowed as redirect targets after sign-in. Parsing
 * like a browser rejects tricks such as "//host", "/\\host", or "/<tab>/host".
 */
export function sicheresZiel(ziel: string | null | undefined, standard = "/konto"): string {
  if (!ziel?.startsWith("/")) return standard;
  try {
    const url = new URL(ziel, INTERN);
    const pfad = url.pathname;
    // "/.//host" normalizes to the path "//host", which a browser reads as another host.
    if (url.origin !== INTERN || pfad.startsWith("//") || pfad.startsWith("/\\")) return standard;
    return `${pfad}${url.search}${url.hash}`;
  } catch {
    return standard;
  }
}

const DATUM = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const DATUM_ZEIT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatiereDatum = (d: Date | string) => DATUM.format(new Date(d));
export const formatiereDatumZeit = (d: Date | string) => DATUM_ZEIT.format(new Date(d));
