import { antwort, fehler, leseJson, mitMitglied } from "@/lib/konto-http";

// Confirms deletion with the emailed code. The account can be restored for 30 days.
export function POST(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const code = (await leseJson(req) as { code?: unknown } | undefined)?.code;
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return fehler(400, "UNGUELTIG", "Bitte geben Sie den sechsstelligen Code ein.");
    const ergebnis = await dienste.konten.bestaetigeLoeschung(mitglied.id, code);
    if (ergebnis === "falscher-code") return fehler(400, "FALSCHER_CODE", "Der Code ist nicht korrekt.");
    if (ergebnis === "kein-code") return fehler(400, "KEIN_CODE", "Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.");
    const status = await dienste.konten.status(mitglied.id);
    return antwort({ geloescht: true, endgueltigAm: status.endgueltigAm });
  });
}
