import { NextRequest, NextResponse } from "next/server";
import { leseReifegrad, formatiereKategorie, type KategorieErgebnis } from "@/lib/reifegrad-model";
import { erklaerungAnfrage } from "@/lib/beratung-anfrage";
import { beantworteKiAnfrage } from "@/lib/ki-anfrage";
import { formatiereKommunaldaten } from "@/lib/kommunaldaten";

export async function POST(req: NextRequest) {
  return beantworteKiAnfrage(req, {
    route: "erklaerung",
    schema: erklaerungAnfrage,
    vorbereiten({ orgName, kategorie, antworten, funktion, positionFachbereich, ebene }) {
      let ergebnis: KategorieErgebnis;
      try {
        ergebnis = leseReifegrad(antworten, ebene).kategorieScores[kategorie];
      } catch {
        return NextResponse.json({ error: "Ungültige Reifegradantworten oder Kategorie" }, { status: 400 });
      }
      if (ergebnis.beantwortet === 0) {
        return NextResponse.json({ erklaerung: "Keine Fragen beantwortet. Es liegt keine Auswertung vor." });
      }

      const prompt = `Du bist Berater:in für Verwaltungsmodernisierung. Antworte knapp, direkt und ohne Floskeln.

Person: ${funktion || "Verwaltungsmitarbeitende:r"}, Fachbereich ${positionFachbereich || "unbekannt"}, ${orgName}
${formatiereKategorie(ergebnis)}

${formatiereKommunaldaten(orgName)}

Aufgabe: Schreibe maximal 3 bis 4 Sätze. Regeln:
- Nenn konkret, was die beantworteten Fragen zeigen
- Falls Fragen übersprungen wurden: weise im Text darauf hin, dass die Einschätzung nicht vollständig ist
- Nutze die Grunddaten zu ${orgName} nur dann, wenn sie die Interpretation wirklich verändern, nicht standardmäßig
- Kein Lob, keine Motivation, keine Floskeln
- Keine Gedankenstriche verwenden
- Fließtext, keine Aufzählung
- Gendern mit Doppelpunkt (Bürger:innen), nie mit Sternchen`;

      // Short and different for every category, so below the providers' cache minimum.
      return { nachrichten: [{ role: "user", content: prompt }], maxTokens: 1500 };
    },
    antwort: (erklaerung) => NextResponse.json({ erklaerung }),
  });
}
