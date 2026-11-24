import { NextResponse } from "next/server";
import { fehler, leseFormular, mitMitglied } from "@/lib/konto-http";

type Kontext = { params: Promise<{ id: string }> };

// Form actions from /admin/konten/[id]. Responds with a redirect back to the admin page.
export async function POST(req: Request, { params }: Kontext) {
  const { id } = await params;
  return mitMitglied(req, async ({ dienste }) => {
    const aktion = (await leseFormular(req)).get("aktion");
    const konto = await dienste.admin.konto(id);
    if (!konto) return fehler(404, "NICHT_GEFUNDEN", "Konto nicht gefunden.");
    let ziel = `/admin/konten/${encodeURIComponent(id)}`;
    switch (aktion) {
      case "abmelden": await dienste.konten.meldeAb(id); break;
      case "loeschen": await dienste.konten.beantrageLoeschung(id); break;
      case "wiederherstellen": await dienste.konten.stelleWiederHer(id); break;
      case "endgueltig-loeschen":
        if (!await dienste.konten.loescheEndgueltig(id)) return fehler(409, "NICHT_VORGEMERKT", "Nur vorgemerkte Konten können endgültig gelöscht werden.");
        ziel = "/admin";
        break;
      default: return fehler(400, "UNGUELTIG", "Unbekannte Aktion.");
    }
    return NextResponse.redirect(new URL(ziel, dienste.baseURL), 303);
  }, { nurAdmin: true });
}
