import { NextResponse } from "next/server";
import { fehler, leseFormular, mitMitglied } from "@/lib/konto-http";

type Kontext = { params: Promise<{ id: string }> };

// Form action from the admin assessment page: deletes the assessment.
export async function POST(req: Request, { params }: Kontext) {
  const { id } = await params;
  return mitMitglied(req, async ({ dienste }) => {
    if ((await leseFormular(req)).get("aktion") !== "loeschen") return fehler(400, "UNGUELTIG", "Unbekannte Aktion.");
    const userId = await dienste.admin.loescheBewertung(id);
    if (!userId) return fehler(404, "NICHT_GEFUNDEN", "Bewertung nicht gefunden.");
    return NextResponse.redirect(new URL(`/admin/konten/${encodeURIComponent(userId)}`, dienste.baseURL), 303);
  }, { nurAdmin: true });
}
