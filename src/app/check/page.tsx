import Check, { type KontoStart } from "@/components/check/check";
import { getAiCapabilities } from "@/lib/ai-config";
import { seitenKonto } from "@/lib/konto-seite";

export const dynamic = "force-dynamic";

type Parameter = { bewertung?: string; neu?: string; speichern?: string };

export default async function CheckPage({ searchParams }: { searchParams: Promise<Parameter> }) {
  const parameter = await searchParams;
  const { dienste, mitglied } = await seitenKonto();
  const konto: KontoStart = {
    aktiv: dienste !== null,
    mitglied: null,
    bewertung: null,
    angefragt: dienste && parameter.bewertung ? parameter.bewertung : null,
    neu: parameter.neu === "1",
    speichern: parameter.speichern === "1",
  };
  if (dienste && mitglied) {
    const vorgemerkt = mitglied.loeschungBeantragtAm !== null;
    konto.mitglied = { vorgemerkt, profil: null };
    if (!vorgemerkt) {
      try {
        konto.mitglied.profil = await dienste.konten.profil(mitglied.id);
        if (parameter.bewertung) {
          const gespeichert = await dienste.bewertungen.lade(mitglied.id, parameter.bewertung);
          if (gespeichert?.stand) konto.bewertung = { id: gespeichert.id, revision: gespeichert.revision, stand: gespeichert.stand };
        }
      } catch (error) {
        // The assessment must keep working when the database is unavailable.
        console.error("Kontodaten für /check nicht lesbar:", error);
      }
    }
  }
  return <Check aiEnabled={getAiCapabilities().advice} konto={konto} />;
}
