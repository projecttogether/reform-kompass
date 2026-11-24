import { antwort, begrenzeSpeichern, fehler, leseStandAusAnfrage, mitMitglied, speicherVoll } from "@/lib/konto-http";

type Kontext = { params: Promise<{ id: string }> };
const nichtGefunden = () => fehler(404, "NICHT_GEFUNDEN", "Bewertung nicht gefunden.");

export async function GET(req: Request, { params }: Kontext) {
  const { id } = await params;
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const bewertung = await dienste.bewertungen.lade(mitglied.id, id);
    if (!bewertung) return nichtGefunden();
    if (!bewertung.stand) return fehler(409, "NICHT_LESBAR", "Diese Bewertung passt nicht mehr zum aktuellen Fragebogen.");
    return antwort(bewertung);
  });
}

export async function PUT(req: Request, { params }: Kontext) {
  const { id } = await params;
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const begrenzt = begrenzeSpeichern(mitglied.id);
    if (begrenzt) return begrenzt;
    const eingabe = await leseStandAusAnfrage(req);
    if (eingabe instanceof Response) return eingabe;
    if (eingabe.revision === null) return fehler(400, "UNGUELTIG", "Die Revision fehlt.");
    const ergebnis = await dienste.bewertungen.aktualisiere(mitglied.id, id, eingabe.stand, eingabe.revision);
    if (ergebnis === "nicht-gefunden") return nichtGefunden();
    if (ergebnis === "konflikt") return fehler(409, "KONFLIKT", "Die Bewertung wurde inzwischen in einem anderen Fenster geändert.");
    if (ergebnis === "voll") return speicherVoll();
    return antwort({ gespeichert: true, revision: ergebnis.revision });
  });
}

export async function DELETE(req: Request, { params }: Kontext) {
  const { id } = await params;
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    if (!await dienste.bewertungen.loesche(mitglied.id, id)) return nichtGefunden();
    return antwort({ geloescht: true });
  });
}
