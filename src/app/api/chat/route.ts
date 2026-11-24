import { NextRequest, NextResponse } from "next/server";
import { chatAnfrage } from "@/lib/beratung-anfrage";
import { beantworteKiAnfrage } from "@/lib/ki-anfrage";
import { findeGrunddaten, formatiereKommunaldaten } from "@/lib/kommunaldaten";
import { getKommunalpolitik, formatiereKommunalpolitik, WARTEZEIT_BERATUNG_MS } from "@/lib/kommunalpolitik";
import { leseReifegrad, formatiereReifegrad, EBENEN } from "@/lib/reifegrad-model";

export async function POST(req: NextRequest) {
  return beantworteKiAnfrage(req, {
    route: "chat",
    schema: chatAnfrage,
    async vorbereiten({ orgName, orgTyp, assessment, messages, funktion, positionFachbereich }) {
      let assessmentContext: string;
      try {
        assessmentContext = formatiereReifegrad(leseReifegrad(assessment.antworten, assessment.ebene));
      } catch {
        return NextResponse.json({ error: "Ungültige Reifegradantworten" }, { status: 400 });
      }

      let anweisungen = `---\n\n## Kontext: Aktuelle Beratungssituation\n\nDu berätst gerade: ${orgTyp} "${orgName}"`;
      anweisungen += `\n\nBewertete Ebene: ${EBENEN[assessment.ebene].label}`;
      anweisungen += `\n\nPerson: ${funktion || "Verwaltungsmitarbeitende:r"}, Fachbereich ${positionFachbereich || "unbekannt"}`;
      anweisungen += `\n\n${formatiereKommunaldaten(orgName)}`;
      const ags = findeGrunddaten(orgName)?.ags;
      if (ags) anweisungen += `\n\n${formatiereKommunalpolitik(await getKommunalpolitik().fuerBeratung(ags, WARTEZEIT_BERATUNG_MS))}`;
      anweisungen += `\n\n## Assessment-Ergebnisse\n\n${assessmentContext}\n\nNutze diese Daten als Ausgangspunkt der Beratung. Beziehe dich konkret auf Stärken und Schwächen. Priorisiere: Was hat den größten Hebel für diese Organisation?`;

      return { mitBeratungsPrompt: true, anweisungen, nachrichten: messages, maxTokens: 5000, verlaufCachen: true, websuche: true };
    },
  });
}
