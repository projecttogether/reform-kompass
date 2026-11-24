import { NextRequest, NextResponse } from "next/server";
import { katalogAnfrage } from "@/lib/beratung-anfrage";
import { beantworteKiAnfrage } from "@/lib/ki-anfrage";
import { findeGrunddaten, formatiereKommunaldaten } from "@/lib/kommunaldaten";
import { getKommunalpolitik, formatiereKommunalpolitik, WARTEZEIT_BERATUNG_MS } from "@/lib/kommunalpolitik";
import { KATEGORIEN, EBENEN, leseReifegrad, formatiereReifegrad } from "@/lib/reifegrad-model";
import { erstelleKatalog, leseKatalog } from "@/lib/massnahmenkatalog";

export async function POST(req: NextRequest) {
  return beantworteKiAnfrage(req, {
    route: "katalog",
    schema: katalogAnfrage,
    async vorbereiten({ orgName, orgTyp, assessment, chatHistory, nurAktualisieren, funktion, positionFachbereich, bisherigerKatalog }) {
      const ebeneLabel = EBENEN[assessment.ebene].label;
      let assessmentContext: string;
      let katalogContext = "";
      try {
        assessmentContext = formatiereReifegrad(leseReifegrad(assessment.antworten, assessment.ebene));
        if (bisherigerKatalog) katalogContext = `Bisheriger Maßnahmenkatalog:\n${JSON.stringify(leseKatalog(bisherigerKatalog).massnahmen)}`;
      } catch {
        return NextResponse.json({ error: "Ungültige Reifegradantworten oder Maßnahmenkatalog" }, { status: 400 });
      }

      const chatContext = chatHistory && chatHistory.length > 0
        ? `\n\nBisheriger Beratungsverlauf (für Kontext):\n${chatHistory.map((m: { role: string; content: string }) => `${m.role === "user" ? "Nutzer:in" : "KI"}: ${m.content}`).join("\n\n")}`
        : "";

      const ags = findeGrunddaten(orgName)?.ags;
      const kommunalpolitik = ags ? `\n\n${formatiereKommunalpolitik(await getKommunalpolitik().fuerBeratung(ags, WARTEZEIT_BERATUNG_MS))}` : "";

      // The advice prompt is sent as its own unchanged first block so providers can cache it.
      const anweisungen = `---

Du bist ein Experte für kommunale Verwaltungsmodernisierung. Deine Aufgabe: Generiere einen konkreten, praxisnahen Maßnahmenkatalog für die gegebene Verwaltungseinheit.

WICHTIG: Antworte ausschließlich mit validem JSON. Kein Text davor oder danach. Kein Markdown.

Das JSON muss diesem Schema entsprechen:
{
  "massnahmen": [
    {
      "titel": "Kurzer, aktiver Titel (max 60 Zeichen)",
      "beschreibung": "2-3 Sätze: Was genau tun, wie, warum das hilft. Konkret, kein Beratersprech.",
      "bereich": "Eine der Kategorien: ${Object.values(KATEGORIEN).map((kat) => kat.label).join("; ")}",
      "aufwand": "niedrig ODER hoch",
      "verantwortung": "eigen ODER fremd",
      "wer": "Nur wenn verantwortung=fremd: Wer muss entscheiden? (z.B. 'Amtsleitung', 'Bürgermeister:in', 'IT-Referat', 'Gemeinderat')",
      "eigener_beitrag": "Nur wenn verantwortung=fremd: Was kann die nutzende Person selbst konkret tun, um das anzustoßen?"
    }
  ]
}

Regeln:
- Generiere 8-12 Maßnahmen (nicht mehr, nicht weniger)
- Verteile ungefähr so: 3-4 eigen/niedrig, 2-3 eigen/hoch, 2-3 fremd/niedrig, 1-2 fremd/hoch
- Priorisiere nach echtem Hebel, nicht nach Einfachheit
- Beziehe dich auf die konkreten Schwächen im Assessment
- Die Bewertung erfolgte für die Ebene: ${ebeneLabel} — passe Maßnahmen auf diese Ebene an
- Berücksichtige was für den jeweiligen Organisationstyp (${orgTyp}) und die Ebene (${ebeneLabel}) realistisch ist
- Keine generischen Phrasen. Jede Maßnahme muss für diese konkrete Einheit spezifisch sein.
- Stützt sich eine Maßnahme auf Grunddaten oder Ratsvorlagen, nenne den Befund mit Kurzquelle in Klammern in der beschreibung, etwa (Destatis, Stand 31.12.2025). Keine URLs im Katalog.`;

      const userPrompt = `Verwaltungseinheit: ${orgTyp} "${orgName}"

Person: ${funktion || "Verwaltungsmitarbeitende:r"}, Fachbereich ${positionFachbereich || "unbekannt"}

${formatiereKommunaldaten(orgName)}${kommunalpolitik}

Assessment-Ergebnis:
${assessmentContext}
${chatContext}
${katalogContext}

${nurAktualisieren ? "Aktualisiere und verfeinere den Maßnahmenkatalog basierend auf dem bisherigen Beratungsgespräch. Behalte bewährte Maßnahmen bei, passe an was durch den Chat klarer wurde, füge neue hinzu die durch das Gespräch relevant wurden." : "Erstelle einen ersten Maßnahmenkatalog."}

Antworte nur mit JSON.`;

      return { mitBeratungsPrompt: true, anweisungen, nachrichten: [{ role: "user", content: userPrompt }], maxTokens: 8000 };
    },
    antwort: (text, { orgName }) => NextResponse.json(erstelleKatalog(text, orgName)),
  });
}
