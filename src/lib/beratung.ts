import { berechneScore, EBENEN, type Ebene, type Kategorie } from "./reifegrad-model";
import { leseKatalog, type Katalog } from "./massnahmenkatalog";

export interface BeratungKontext {
  orgName: string;
  orgTyp: string;
  funktion: string;
  positionFachbereich: string;
  ebene: Ebene;
  antworten: Record<string, number>;
}

export interface Nachricht {
  role: "user" | "assistant";
  content: string;
  rueckfrage?: { frage: string; optionen: string[] };
  error?: boolean;
}

export interface BeratungTransport {
  erklaerung(kontext: BeratungKontext, kategorie: Kategorie, signal: AbortSignal): Promise<string>;
  chat(kontext: BeratungKontext, messages: Nachricht[], signal: AbortSignal, onChunk: (partial: string) => void): Promise<string>;
  katalog(kontext: BeratungKontext, messages: Nachricht[], signal: AbortSignal, bisherigerKatalog: Katalog | null): Promise<unknown>;
}

interface BeratungStand {
  messages: Nachricht[];
  chatLaed: boolean;
  /** The reply being streamed, already safe to show (see `sichtbarerStream`). */
  streamContent: string | null;
  katalog: Katalog | null;
  katalogLoading: boolean;
  katalogError: string | null;
  katalogRevision: number;
  erklaerungen: Record<string, string>;
  erklaerungLaed: Record<string, boolean>;
}

function leererStand(): BeratungStand {
  return { messages: [], chatLaed: false, streamContent: null, katalog: null, katalogLoading: false, katalogError: null, katalogRevision: 0, erklaerungen: {}, erklaerungLaed: {} };
}

// The reply protocol from beratung-protokoll.ts. This module is the only place that parses it.
const RUECKFRAGE = "RÜCKFRAGE:";
const KATALOG_MARKER = "[KATALOG_AKTUALISIEREN]";

/** Text of an advice reply before its follow-up question; the question and its options render separately. */
export function einleitung(nachricht: Nachricht): string {
  return nachricht.content.split(/(?:^|\n)RÜCKFRAGE:/)[0].replaceAll(KATALOG_MARKER, "").trim();
}

// Start of a token cut off at the end of a partial reply, or -1.
function angeschnittenesToken(text: string, token: string) {
  for (let l = Math.min(token.length - 1, text.length); l >= 2; l--) {
    if (text.endsWith(token.slice(0, l))) return text.length - l;
  }
  return -1;
}

/**
 * The part of a streaming reply that can be shown: everything before the follow-up
 * question, without catalogue markers, and without a token that is still arriving.
 */
export function sichtbarerStream(teil: string): string {
  const text = teil.replaceAll(KATALOG_MARKER, "");
  const schnitte = [text.indexOf(RUECKFRAGE), angeschnittenesToken(text, RUECKFRAGE), angeschnittenesToken(text, KATALOG_MARKER)].filter((i) => i >= 0);
  return schnitte.length > 0 ? text.slice(0, Math.min(...schnitte)).trimEnd() : text;
}

function interpretiereAntwort(raw: string) {
  const content = raw.replaceAll(KATALOG_MARKER, "").trim();
  if (!content) throw new Error("Leere Beratungsantwort");
  const frage = content.match(/(?:^|\n)RÜCKFRAGE:\s*([^\n]+)/)?.[1]?.trim();
  const optionen = Array.from(content.matchAll(/(?:^|\n)OPTION_[ABC]:\s*([^\n]+)/g), (match) => match[1].trim());
  const rueckfrage = frage && optionen.length >= 2 ? { frage, optionen } : undefined;
  return {
    nachricht: { role: "assistant", content, ...(rueckfrage ? { rueckfrage } : {}) } satisfies Nachricht,
    aktualisieren: !rueckfrage && raw.includes(KATALOG_MARKER),
  };
}

// Callers submit intentions. This module owns the conversation and request ordering.
export function createBeratung(transport: BeratungTransport) {
  let stand = leererStand();
  let kontext: BeratungKontext | null = null;
  let enabled = false;
  let gestartet = false;
  let revision = 0;
  let katalogRequest = 0;
  let katalogController: AbortController | null = null;
  let refreshPending = false;
  const controllers = new Set<AbortController>();
  const listeners = new Set<() => void>();
  const fehlgeschlageneErklaerungen = new Set<Kategorie>();

  function publish(update: Partial<BeratungStand>) {
    stand = { ...stand, ...update };
    listeners.forEach((listener) => listener());
  }

  function controller() {
    const c = new AbortController();
    controllers.add(c);
    return c;
  }

  function cancel() {
    revision++;
    katalogRequest++;
    controllers.forEach((c) => c.abort());
    controllers.clear();
    katalogController = null;
    refreshPending = false;
    publish({ chatLaed: false, streamContent: null, katalogLoading: false, erklaerungLaed: {} });
  }

  function gleicherKontext(value: BeratungKontext) {
    if (!kontext) return false;
    return kontext.orgName === value.orgName && kontext.orgTyp === value.orgTyp
      && kontext.funktion === value.funktion && kontext.positionFachbereich === value.positionFachbereich
      && kontext.ebene === value.ebene
      && Object.keys(kontext.antworten).length === Object.keys(value.antworten).length
      && Object.entries(value.antworten).every(([id, antwort]) => kontext!.antworten[id] === antwort);
  }

  function ladeErklaerungen() {
    if (!enabled || !kontext) return;
    const ergebnis = berechneScore(kontext.antworten, kontext.ebene);
    for (const kat of Object.keys(ergebnis.kategorieScores) as Kategorie[]) {
      if (ergebnis.kategorieScores[kat].beantwortet > 0 && (!stand.erklaerungen[kat] || fehlgeschlageneErklaerungen.has(kat)) && !stand.erklaerungLaed[kat]) void ladeErklaerung(kat);
    }
  }

  async function ladeErklaerung(kategorie: Kategorie) {
    if (!enabled || !kontext) return;
    const current = revision;
    const c = controller();
    publish({ erklaerungLaed: { ...stand.erklaerungLaed, [kategorie]: true } });
    try {
      const text = await transport.erklaerung(kontext, kategorie, c.signal);
      if (current === revision) {
        fehlgeschlageneErklaerungen.delete(kategorie);
        publish({ erklaerungen: { ...stand.erklaerungen, [kategorie]: text } });
      }
    } catch {
      if (current === revision) {
        fehlgeschlageneErklaerungen.add(kategorie);
        publish({ erklaerungen: { ...stand.erklaerungen, [kategorie]: "KI-Einschätzung ist derzeit nicht verfügbar." } });
      }
    } finally {
      controllers.delete(c);
      if (current === revision) publish({ erklaerungLaed: { ...stand.erklaerungLaed, [kategorie]: false } });
    }
  }

  async function refreshKatalog() {
    if (!enabled || !kontext) return;
    if (stand.chatLaed) {
      refreshPending = true;
      return;
    }
    refreshPending = false;
    katalogController?.abort();
    const c = controller();
    katalogController = c;
    const current = revision;
    const request = ++katalogRequest;
    const isCurrent = () => current === revision && request === katalogRequest;
    publish({ katalogLoading: true, katalogError: null });
    try {
      const messages = stand.messages.filter((m) => !m.error);
      let katalog!: ReturnType<typeof leseKatalog>;
      const delays = [2000, 4000, 8000];
      let lastError: unknown;
      let success = false;
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (!isCurrent() || c.signal.aborted) return;
        try {
          katalog = leseKatalog(await transport.katalog(kontext, messages, c.signal, stand.katalog));
          success = true;
          break;
        } catch (e) {
          lastError = e;
          if (attempt < delays.length && !c.signal.aborted) {
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
      }
      if (!success) throw lastError;
      if (isCurrent()) publish({ katalog, katalogRevision: stand.katalogRevision + 1 });
    } catch {
      if (isCurrent()) publish({ katalogError: "Der Maßnahmenkatalog konnte nicht erstellt werden. Bitte später erneut versuchen." });
    } finally {
      controllers.delete(c);
      if (isCurrent()) {
        katalogController = null;
        publish({ katalogLoading: false });
      }
    }
  }

  async function sendeAntwort(messages: Nachricht[]) {
    if (!enabled || !kontext || stand.chatLaed || messages.at(-1)?.role !== "user") return;
    const current = revision;
    const c = controller();
    // A pending catalogue from a prior turn belongs to the older conversation — abort and re-request.
    // But when the catalogue was started alongside the first user message,
    // let it run: both the initial chat and the initial catalogue should complete in parallel.
    const abortKatalog = stand.katalogLoading && messages.length > 1;
    if (abortKatalog) {
      katalogController?.abort();
      katalogRequest++;
      refreshPending = true;
    }
    publish({ messages, chatLaed: true, streamContent: null, ...(abortKatalog ? { katalogLoading: false } : {}) });
    let aktualisieren = false;
    try {
      const raw = await transport.chat(
        kontext,
        stand.messages.filter((m) => !m.error),
        c.signal,
        (partial) => { if (current === revision) publish({ streamContent: sichtbarerStream(partial) }); },
      );
      if (current !== revision) return;
      const antwort = interpretiereAntwort(raw);
      aktualisieren = antwort.aktualisieren;
      publish({ messages: [...stand.messages, antwort.nachricht], streamContent: null });
    } catch {
      if (current === revision) publish({ messages: [...stand.messages, { role: "assistant", content: "KI-Beratung ist derzeit nicht verfügbar. Bitte später erneut versuchen.", error: true }], streamContent: null });
    } finally {
      controllers.delete(c);
      if (current === revision) {
        publish({ chatLaed: false });
        if (aktualisieren || refreshPending) await refreshKatalog();
      }
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (content) await sendeAntwort([...stand.messages, { role: "user", content }]);
  }

  return {
    getSnapshot: () => stand,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setKontext(value: BeratungKontext, aiEnabled: boolean) {
      cancel();
      fehlgeschlageneErklaerungen.clear();
      kontext = { ...value, antworten: { ...value.antworten } };
      enabled = aiEnabled;
      gestartet = false;
      stand = leererStand();
      publish({});
      ladeErklaerungen();
    },
    verwerfeAuswertung() {
      cancel();
      fehlgeschlageneErklaerungen.clear();
      publish({ katalog: null, katalogError: null, erklaerungen: {} });
    },
    aktualisiereKontext(value: BeratungKontext, aiEnabled: boolean) {
      if (gleicherKontext(value) && enabled === aiEnabled) {
        ladeErklaerungen();
        if (gestartet && !stand.katalog && !stand.katalogLoading && !stand.katalogError) void refreshKatalog();
        return;
      }
      const messages = stand.messages;
      cancel();
      fehlgeschlageneErklaerungen.clear();
      kontext = { ...value, antworten: { ...value.antworten } };
      enabled = aiEnabled;
      // Preserve the conversation, but discard output derived from older answers.
      stand = { ...leererStand(), messages };
      publish({});
      ladeErklaerungen();
      if (gestartet) void refreshKatalog();
    },
    restoreKontext(value: BeratungKontext, savedMessages: Nachricht[], savedKatalog: Katalog | null, aiEnabled: boolean) {
      cancel();
      fehlgeschlageneErklaerungen.clear();
      kontext = { ...value, antworten: { ...value.antworten } };
      enabled = aiEnabled;
      // A restored conversation must not get a second introduction; an assessment
      // restored before advice began can still start it.
      gestartet = savedMessages.length > 0;
      stand = { ...leererStand(), messages: savedMessages, katalog: savedKatalog };
      publish({});
      ladeErklaerungen();
      if (gestartet && !savedKatalog) void refreshKatalog();
    },
    start() {
      if (!enabled || !kontext) return;
      if (gestartet) {
        // Resume an unanswered turn without adding another user introduction.
        void sendeAntwort(stand.messages);
        return;
      }
      gestartet = true;
      const rolle = [kontext.funktion, kontext.positionFachbereich].filter(Boolean).join(" im Bereich ") || "Verwaltungsmitarbeitende:r";
      const ebeneLabel = EBENEN[kontext.ebene].label;
      void refreshKatalog(); // start catalog immediately, before chat sets chatLaed=true
      void sendMessage(`Ich bin ${rolle} bei der ${kontext.orgName}. Ich bewerte die Ebene: ${ebeneLabel}. Ich möchte jetzt mit der Beratung starten.`);
    },
    sendMessage,
    refreshKatalog,
    cancel,
  };
}
