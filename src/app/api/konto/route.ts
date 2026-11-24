import { z } from "zod";
import { antwort, fehler, leseJson, mitMitglied } from "@/lib/konto-http";

const profilSchema = z.object({
  kommune: z.string().trim().max(300),
  funktion: z.string().trim().max(300),
  fachbereich: z.string().trim().max(300),
});

export function GET(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => antwort({
    email: mitglied.email,
    admin: mitglied.admin,
    profil: await dienste.konten.profil(mitglied.id),
    loeschungBeantragtAm: mitglied.loeschungBeantragtAm,
    endgueltigAm: mitglied.endgueltigAm,
  }), { auchVorgemerkt: true });
}

export function PUT(req: Request) {
  return mitMitglied(req, async ({ dienste, mitglied }) => {
    const profil = profilSchema.safeParse((await leseJson(req) as { profil?: unknown } | undefined)?.profil);
    if (!profil.success) return fehler(400, "UNGUELTIG", "Ungültige Profilangaben.");
    await dienste.konten.speichereProfil(mitglied.id, profil.data);
    return antwort({ profil: profil.data });
  });
}
