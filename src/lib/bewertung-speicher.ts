import { gespeicherteForm, type BewertungStand } from "./bewertung";
import type { kontoBrowser } from "./konto-browser";

export type SpeicherStatus = "aus" | "speichert" | "gespeichert" | "fehler" | "voll" | "konflikt";

/**
 * Saved-assessment requests: `kontoBrowser` in the browser, an in-memory server in tests.
 * Failed requests throw an error with the HTTP `status` and the server's `code`.
 */
export type SpeicherTransport = Pick<typeof kontoBrowser, "erstelleBewertung" | "speichereBewertung" | "ladeBewertung" | "speichereProfil">;

export interface SpeicherZustand {
  /** The saved assessment this tab belongs to. Kept during a conflict so the page can offer the saved version. */
  bewertungId: string | null;
  /** Revision of that assessment this tab last wrote or loaded. */
  revision: number | null;
  status: SpeicherStatus;
}

const VERZOEGERUNG_MS = 1200;
const WIEDERHOLUNG_MS = 10_000;
// Browsers refuse keepalive request bodies above 64 KiB.
const MAX_KEEPALIVE_BYTES = 60_000;

// `json` is the state in the form the server stores it, for comparisons.
type Auftrag = { stand: BewertungStand; json: string };
type Ziel = { id: string; revision: number };
/** Saves whose outcome is unknown (the request failed), all built on revision `basis`. */
type Unbestaetigt = { basis: number; jsons: string[] };

const passtInKeepalive = (auftrag: Auftrag) => new TextEncoder().encode(JSON.stringify(auftrag.stand)).length < MAX_KEEPALIVE_BYTES;

function fehlerFeld(error: unknown, feld: "status" | "code"): unknown {
  return error && typeof error === "object" && feld in error ? (error as Record<string, unknown>)[feld] : undefined;
}

// 401, 403 and 404: signed out, marked for deletion, or the assessment is gone. The tab stops saving to it.
const nichtMehrErreichbar = (error: unknown) => [401, 403, 404].includes(fehlerFeld(error, "status") as number);
// The account has no room left until the member deletes assessments, so no timed retry.
const kontoVoll = (error: unknown) => ["ZU_VIELE", "SPEICHER_VOLL"].includes(fehlerFeld(error, "code") as string);

/**
 * After a 409: whether the server's newer state came from this tab, either because
 * it already holds exactly what was sent, or because an earlier save whose response
 * was lost went through. Otherwise another tab saved in between.
 */
function stammtVonDiesemFenster(server: { revision: number; json: string }, gesendet: string, unbestaetigt: Unbestaetigt | null): boolean {
  if (server.json === gesendet) return true;
  return !!unbestaetigt && server.revision === unbestaetigt.basis + 1 && unbestaetigt.jsons.includes(server.json);
}

/**
 * Keeps a member's saved assessment in sync with the state of this tab.
 * - Saves are debounced and sent one after another.
 * - Each save names the revision it builds on. If another tab saved in between,
 *   the server answers 409 and syncing stops with status "konflikt". A 409 caused by
 *   this tab's own save whose response was lost is recognized and not a conflict.
 * - Failed saves, and failed checks of a restored link, are retried. A tab never
 *   creates a second saved assessment while it belongs to one.
 */
export function createBewertungSpeicher(transport: SpeicherTransport) {
  let zustand: SpeicherZustand = { bewertungId: null, revision: null, status: "aus" };
  const listeners = new Set<() => void>();
  // The assessment this tab writes to. Null while not linked, while a restored link is checked, and after a conflict.
  let ziel: Ziel | null = null;
  // A restored link whose check failed; it is checked again instead of saving.
  let pruefung: { id: string; revision: number | null; lokal: BewertungStand } | null = null;
  let eingabe: { stand: BewertungStand | null; aktiv: boolean; pausiert: boolean } = { stand: null, aktiv: false, pausiert: false };
  let beendet = false;
  let zuletztGespeichert: string | null = null;
  let kette: Promise<void> = Promise.resolve();
  let offen: Auftrag | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wiederholung: ReturnType<typeof setTimeout> | null = null;
  let erstellung: Promise<void> | null = null;
  let unbestaetigt: Unbestaetigt | null = null;

  function setze(update: Partial<SpeicherZustand>) {
    zustand = { ...zustand, ...update };
    listeners.forEach((listener) => listener());
  }

  function setzeZiel(neu: Ziel | null) {
    ziel = neu;
    setze({ bewertungId: neu?.id ?? null, revision: neu?.revision ?? null });
  }

  function trenne() {
    pruefung = null;
    offen = null;
    zuletztGespeichert = null;
    setzeZiel(null);
    setze({ status: "aus" });
  }

  function konflikt() {
    // Keep the id so the page can offer the saved version, but stop writing to it.
    ziel = null;
    offen = null;
    setze({ status: "konflikt" });
  }

  function stoppeTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function spaeterNochmal() {
    if (wiederholung) clearTimeout(wiederholung);
    wiederholung = setTimeout(() => { wiederholung = null; nachholen(); }, WIEDERHOLUNG_MS);
  }

  // Schedules a debounced save of the current state when it differs from the saved copy.
  function plane() {
    stoppeTimer();
    const { stand, aktiv, pausiert } = eingabe;
    if (beendet || !aktiv || pausiert || !stand || !ziel) return;
    const json = gespeicherteForm(stand);
    if (json === zuletztGespeichert) {
      // Changed and changed back before the save ran: nothing is pending any more.
      offen = null;
      return;
    }
    offen = { stand, json };
    timer = setTimeout(() => {
      timer = null;
      const auftrag = offen;
      offen = null;
      if (auftrag) sende(auftrag, false);
    }, VERZOEGERUNG_MS);
  }

  function nachholen() {
    if (beendet) return;
    if (pruefung) void pruefeUndVerknuepfe(pruefung.id, pruefung.revision, pruefung.lokal);
    else plane();
  }

  function sende(auftrag: Auftrag, keepalive: boolean) {
    kette = kette.then(async () => {
      const basis = ziel;
      if (!basis || zuletztGespeichert === auftrag.json) return;
      setze({ status: "speichert" });
      try {
        const neueRevision = await transport.speichereBewertung(basis.id, auftrag.stand, basis.revision, keepalive);
        if (ziel?.id !== basis.id) return;
        unbestaetigt = null;
        zuletztGespeichert = auftrag.json;
        setzeZiel({ id: basis.id, revision: neueRevision });
        setze({ status: "gespeichert" });
        // The tab may have changed back to an earlier state while this save was in flight.
        plane();
      } catch (error) {
        if (fehlerFeld(error, "status") === 409) {
          await klaereKonflikt(basis.id, auftrag);
        } else if (kontoVoll(error)) {
          // The server refused the save, so it cannot appear later as this tab's own. It is sent again with
          // the next change or when the page becomes visible, for example after deleting assessments elsewhere.
          setze({ status: "voll" });
        } else if (nichtMehrErreichbar(error)) {
          trenne();
        } else {
          // The save may still have reached the server; remember it for a later 409.
          const bisher = unbestaetigt?.basis === basis.revision ? unbestaetigt.jsons : [];
          unbestaetigt = { basis: basis.revision, jsons: [...bisher, auftrag.json] };
          setze({ status: "fehler" });
          spaeterNochmal();
        }
      }
    });
  }

  async function klaereKonflikt(id: string, auftrag: Auftrag) {
    try {
      const server = await transport.ladeBewertung(id);
      const json = gespeicherteForm(server.stand);
      if (stammtVonDiesemFenster({ revision: server.revision, json }, auftrag.json, unbestaetigt)) {
        unbestaetigt = null;
        zuletztGespeichert = json;
        setzeZiel({ id, revision: server.revision });
        setze({ status: "gespeichert" });
        // Send the tab's current state on top of the recovered revision if it differs;
        // it may also have changed back while this save was in flight.
        plane();
        return;
      }
    } catch {
      // Treat as a conflict below; the saved version stays available.
    }
    konflikt();
  }

  /**
   * Re-links a tab restored from sessionStorage. The stored revision can be outdated,
   * for example when the last save finished while the page was closing.
   */
  async function pruefeUndVerknuepfe(id: string, revision: number | null, lokal: BewertungStand) {
    pruefung = null;
    setze({ bewertungId: id, revision, status: "speichert" });
    try {
      const server = await transport.ladeBewertung(id);
      const gespeichert = gespeicherteForm(server.stand);
      if (server.revision === revision || gespeichert === gespeicherteForm(lokal)) {
        zuletztGespeichert = gespeichert;
        setzeZiel({ id, revision: server.revision });
        setze({ status: "gespeichert" });
        // Send local changes the saved copy does not have yet.
        plane();
      } else {
        konflikt();
      }
    } catch (error) {
      if (nichtMehrErreichbar(error)) {
        trenne();
        return;
      }
      // Whether the saved copy changed is unknown. The tab stays with this assessment
      // and checks again later, so "Speichern" cannot create a duplicate meanwhile.
      pruefung = { id, revision, lokal };
      setze({ status: "fehler" });
      spaeterNochmal();
    }
  }

  function sendeSofort() {
    const auftrag = offen;
    if (!auftrag) return;
    stoppeTimer();
    offen = null;
    sende(auftrag, passtInKeepalive(auftrag));
  }

  return {
    getSnapshot: () => zustand,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** The tab's current state, and whether it may be saved now. Schedules a save when it differs from the saved copy. */
    aktualisiere(stand: BewertungStand | null, optionen: { aktiv: boolean; pausiert: boolean }) {
      eingabe = { stand, ...optionen };
      beendet = false;
      plane();
    },
    /** Links this tab to an assessment loaded from the server. */
    verknuepfe(id: string, revision: number, gespeichert: BewertungStand) {
      pruefung = null;
      zuletztGespeichert = gespeicherteForm(gespeichert);
      setzeZiel({ id, revision });
      setze({ status: "gespeichert" });
      plane();
    },
    pruefeUndVerknuepfe,
    /**
     * Creates a saved assessment from the given state, links this tab to it, and makes its
     * context the member's profile. Repeated calls (double clicks, effects run twice) create
     * at most one assessment, and a tab that already belongs to one creates none.
     */
    erstelle(neu: BewertungStand) {
      if (zustand.bewertungId) return Promise.resolve();
      erstellung ??= (async () => {
        setze({ status: "speichert" });
        try {
          const erstellt = await transport.erstelleBewertung(neu);
          zuletztGespeichert = gespeicherteForm(neu);
          setzeZiel(erstellt);
          setze({ status: "gespeichert" });
          plane();
          await transport.speichereProfil({ kommune: neu.kontext.orgName, funktion: neu.kontext.funktion, fachbereich: neu.kontext.positionFachbereich }).catch(() => {});
        } catch (error) {
          setze({ status: kontoVoll(error) ? "voll" : "fehler" });
        } finally {
          erstellung = null;
        }
      })();
      return erstellung;
    },
    /** Sends a pending change now, as a keepalive request when it fits, for example when the page is hidden. */
    sendeSofort,
    /** Tries a failed save or check again now, for example when the page becomes visible. */
    nachholen,
    /** The page leaves /check: sends a pending change and schedules nothing more until `aktualisiere` runs again. */
    beende() {
      sendeSofort();
      beendet = true;
      stoppeTimer();
      if (wiederholung) clearTimeout(wiederholung);
      wiederholung = null;
    },
  };
}
