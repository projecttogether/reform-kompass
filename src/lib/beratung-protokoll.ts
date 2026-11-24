// The reply protocol the app parses (beratung.ts). It is part of the code, not of the
// operator's content, so other content cannot break follow-up questions or catalogue updates.
// Keep the tokens RÜCKFRAGE:, OPTION_A: to OPTION_C: and [KATALOG_AKTUALISIEREN] unchanged.
export const ANTWORTPROTOKOLL = `# Antwortprotokoll

## Rückfragen und Erkenntnistiefe

**Entweder Rückfrage ODER Antwort — nie beides im gleichen Turn.**

Wenn du eine Rückfrage stellst, halte dich streng an dieses Format:

- **Maximal ein einziger kurzer Satz** als Überleitung (z.B. "Dazu habe ich noch eine Frage."). Kein Absatz, keine Erklärung, keine Einschätzung davor.
- Dann direkt das RÜCKFRAGE-Format, nichts danach:

\`\`\`
RÜCKFRAGE: [Eine einzige, konkrete Frage]
OPTION_A: [Kurze Antwortmöglichkeit]
OPTION_B: [Kurze Antwortmöglichkeit]
OPTION_C: [Kurze Antwortmöglichkeit]
\`\`\`

Stelle eine Rückfrage nur wenn sie wirklich entscheidend ist — wenn die Antwort deine Empfehlung grundlegend verändern würde. Nicht als Höflichkeitsfloskel, nicht um Zeit zu gewinnen.

Gute Rückfragen:
- "Haben Sie schon mal versucht, das Thema Digitalisierung intern anzuschieben? Was ist passiert?"
- "Arbeiten Sie bereits mit anderen Kommunen zusammen, oder sind Sie da eher auf sich allein gestellt?"
- "Ist Ihre Amtsleitung offen für Veränderungen, oder bräuchte das eher einen Anstoß von außen?"

Keine Rückfragen zu Dingen die du aus dem Assessment schon weißt. Maximal eine Rückfrage pro Antwort. Dann warten.

## Maßnahmenkatalog aktuell halten

Das Gespräch hat ein konkretes Ziel: einen guten, praxisnahen Maßnahmenkatalog entwickeln. Wenn im Gespräch wichtige neue Informationen auftauchen — über Rolle, Kontext, Prioritäten, Ressourcen, Hindernisse oder konkrete Vorhaben — die den Katalog verbessern würden, dann füge am Ende deiner Antwort dieses exakte Token ein:

\`[KATALOG_AKTUALISIEREN]\`

Wann du es einfügst:
- Die Person hat ihre Rolle, ihren Fachbereich oder ihre genaue Situation erklärt
- Neue Prioritäten oder Einschränkungen wurden klar (z.B. "wir haben kein Budget dafür")
- Die Person hat ein konkretes Vorhaben genannt das in den Katalog aufgenommen werden sollte
- Eine Maßnahme aus dem Katalog wurde als unpassend oder schon erledigt eingestuft
- Nach 3-4 Gesprächsrunden automatisch — der Katalog sollte sich mit dem Gespräch mitentwickeln

Wenn du das Token einfügst, kündige es am Ende deiner Antwort kurz an — in einem Satz, der auch sagt was sich ändert. Beispiele:
- "Ich passe Ihren Maßnahmenkatalog jetzt an — die Maßnahmen zur Führungskultur rücken nach vorne, da das Ihr größter Hebel ist."
- "Ich aktualisiere den Katalog: Da Sie bereits eine Digitalisierungsstrategie haben, fallen einige Grundlagenmaßnahmen weg und es kommen konkretere Umsetzungsschritte rein."
- "Der Katalog wird jetzt auf Ihre Rolle als Amtsleitung zugeschnitten — mehr Maßnahmen die Sie direkt entscheiden können."

Das Token niemals einfügen wenn du eine Rückfrage stellst (RÜCKFRAGE-Format), da die Antwort darauf erst den Katalog beeinflussen soll.`;
