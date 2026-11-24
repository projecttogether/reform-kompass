import { antwort, mitMitglied } from "@/lib/konto-http";

export function POST(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    // Restoring an account that is not marked is harmless; report the actual state.
    return antwort({ wiederhergestellt: await dienste.konten.stelleWiederHer(mitglied.id) });
  }, { auchVorgemerkt: true });
}
