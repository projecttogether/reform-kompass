import { antwort, fehler, kontoLimiter, mitMitglied } from "@/lib/konto-http";

// Sends a one-time code that confirms account deletion.
export function POST(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const warten = kontoLimiter().zaehle(`loeschcode:${mitglied.id}`, { max: 5, fensterMs: 10 * 60_000 });
    if (warten !== null) return fehler(429, "RATE_LIMITED", "Zu viele Codes angefordert. Bitte warten Sie einige Minuten.");
    await dienste.konten.fordereLoeschcodeAn(mitglied.id, mitglied.email);
    return antwort({ gesendet: true });
  });
}
