import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { seitenKonto } from "@/lib/konto-seite";
import { Mitgliederbereich } from "@/components/konto/mitgliederbereich";
import { KontoVorgemerkt } from "@/components/konto/konto-vorgemerkt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mein Bereich" };

export default async function KontoSeite() {
  const { dienste, mitglied } = await seitenKonto();
  if (!dienste) notFound();
  if (!mitglied) redirect("/anmelden?weiter=/konto");
  if (mitglied.loeschungBeantragtAm) {
    return <KontoVorgemerkt email={mitglied.email} endgueltigAm={mitglied.endgueltigAm!.toISOString()} />;
  }
  const [profil, bewertungen] = await Promise.all([dienste.konten.profil(mitglied.id), dienste.bewertungen.liste(mitglied.id)]);
  return (
    <Mitgliederbereich
      email={mitglied.email}
      admin={mitglied.admin || mitglied.adminNeuAnmelden}
      profil={profil}
      bewertungen={bewertungen.map((b) => ({ id: b.id, erstelltAm: b.erstelltAm.toISOString(), aktualisiertAm: b.aktualisiertAm.toISOString(), uebersicht: b.uebersicht }))}
    />
  );
}
