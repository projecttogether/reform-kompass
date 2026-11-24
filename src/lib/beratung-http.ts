import { waehleKiVerlauf } from "./ki-verlauf";
import type { BeratungTransport, BeratungKontext, Nachricht } from "./beratung";

async function post(url: string, body: object, signal: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error("KI-Beratung ist derzeit nicht verfügbar.");
  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Ungültige KI-Antwort");
  return data as Record<string, unknown>;
}

function payload(kontext: BeratungKontext, messages: Nachricht[]) {
  return { ...kontext, assessment: { antworten: kontext.antworten, ebene: kontext.ebene }, messages: waehleKiVerlauf(messages) };
}

export const beratungHttp: BeratungTransport = {
  async erklaerung(kontext, kategorie, signal) {
    const data = await post("/api/erklaerung", { ...kontext, kategorie }, signal);
    if (typeof data.erklaerung !== "string" || !data.erklaerung.trim()) throw new Error("Leere Einschätzung");
    return data.erklaerung;
  },
  async chat(kontext, messages, signal, onChunk) {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(kontext, messages)), signal });
    if (!res.ok) throw new Error("KI-Beratung ist derzeit nicht verfügbar.");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Kein Stream");
    const dec = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += dec.decode(value, { stream: true });
      onChunk(full);
    }
    return full;
  },
  async katalog(kontext, messages, signal, bisherigerKatalog) {
    const { messages: chatHistory, ...body } = payload(kontext, messages);
    return post("/api/katalog", { ...body, chatHistory, bisherigerKatalog, nurAktualisieren: bisherigerKatalog !== null }, signal);
  },
};
