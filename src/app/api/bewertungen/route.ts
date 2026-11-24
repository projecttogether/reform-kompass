import { antwort, begrenzeSpeichern, fehler, leseStandAusAnfrage, mitMitglied, speicherVoll } from "@/lib/konto-http";

export function GET(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => antwort({ bewertungen: await dienste.bewertungen.liste(mitglied.id) }));
}

export function POST(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const begrenzt = begrenzeSpeichern(mitglied.id);
    if (begrenzt) return begrenzt;
    const eingabe = await leseStandAusAnfrage(req);
    if (eingabe instanceof Response) return eingabe;
    const ergebnis = await dienste.bewertungen.erstelle(mitglied.id, eingabe.stand);
    if (ergebnis === "zu-viele") return fehler(409, "ZU_VIELE", "Sie haben die Höchstzahl gespeicherter Bewertungen erreicht. Bitte löschen Sie ältere Bewertungen.");
    if (ergebnis === "voll") return speicherVoll();
    return antwort(ergebnis, 201);
  });
}
