export type Kategorie = "strategie" | "fuehrung" | "personal" | "digitalisierung" | "kooperation";
export type Ebene = "gesamtverwaltung" | "amt" | "team";

export const EBENEN: Record<Ebene, { label: string; kurzLabel: string; beispiele: string }> = {
  gesamtverwaltung: {
    label: "Gesamtverwaltung",
    kurzLabel: "Gesamtverwaltung",
    beispiele: "die gesamte Kommunalverwaltung",
  },
  amt: {
    label: "Amt oder Fachbereich",
    kurzLabel: "Amt/Fachbereich",
    beispiele: "z. B. Bauamt, Fachbereich Jugend, Dezernat",
  },
  team: {
    label: "Team",
    kurzLabel: "Team",
    beispiele: "z. B. Sachgebiet, Arbeitsgruppe",
  },
};

export interface FrageTexte {
  beschreibung: string;
  optionen: string[];
}

export interface Frage {
  id: string;
  nummer: number;
  teil: string;
  teilLabel: string;
  kategorie: Kategorie;
  titel: string;
  texte: Record<Ebene, FrageTexte>;
}

export function getFrageText(frage: Frage, ebene: Ebene): FrageTexte {
  return frage.texte[ebene];
}

export const TEILE: Record<string, { label: string; fragen: string[] }> = {
  A: { label: "Strategie und Wirkung", fragen: ["f1", "f2", "f3"] },
  B: { label: "Führung und Kultur", fragen: ["f4", "f5", "f6"] },
  C: { label: "Personal", fragen: ["f7", "f8"] },
  D: { label: "Bürger:innen im Mittelpunkt", fragen: ["f9", "f10", "f11", "f12"] },
  E: { label: "Offenheit, Zusammenarbeit, Demokratie", fragen: ["f13", "f14", "f15"] },
};

export const KATEGORIEN: Record<Kategorie, { label: string; beschreibung: string }> = {
  strategie: {
    label: "Strategie und Wirkung",
    beschreibung: "Strategische Ausrichtung, Wirkungsziele, evidenzbasierte Entscheidungen, Vorausschau",
  },
  fuehrung: {
    label: "Führung und Kultur",
    beschreibung: "Führungsfeedback, offene Fehlerkultur, agile Prozesse und Lernkultur",
  },
  personal: {
    label: "Personal",
    beschreibung: "Kompetenzaufbau, Personalentwicklung, Arbeitgeberattraktivität",
  },
  digitalisierung: {
    label: "Bürger:innen im Mittelpunkt",
    beschreibung: "Zugänglichkeit, Digitalisierung, Zufriedenheitsmessung, kooperative Gestaltung",
  },
  kooperation: {
    label: "Offenheit, Zusammenarbeit, Demokratie",
    beschreibung: "Transparenz, interkommunale Zusammenarbeit, demokratische Resilienz",
  },
};

// Increase when question wording, options, or scoring change. Saved assessments
// record this version; comparisons across versions show a notice.
// tests/bewertung.test.ts pins a fingerprint of FRAGEN to catch missed increases.
export const FRAGEBOGEN_VERSION = 1;

export const FRAGEN: Frage[] = [
  {
    id: "f1", nummer: 1, teil: "A", teilLabel: "Strategie und Wirkung", kategorie: "strategie",
    titel: "Strategisches Dokument mit Wirkungszielen",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Gibt es in Ihrer Verwaltung ein strategisches Dokument mit klaren Wirkungszielen, die beschreiben, was sich für die Adressat:innen Ihrer Leistungen verbessern soll, und dient es als Grundlage für Planung und Entscheidungen?",
        optionen: [
          "Nein. Ein strategisches Dokument mit Wirkungszielen fehlt oder ist veraltet.",
          "Ansatzweise. Es gibt ein strategisches Dokument mit Wirkungszielen.",
          "Teilweise. Das strategische Dokument mit Wirkungszielen ist mindestens einmal fortgeschrieben und politisch beschlossen.",
          "Überwiegend. Die bereits mindestens einmal fortgeschriebene Strategie mit Wirkungszielen wird in unterschiedlichen Besprechungen und Entscheidungsformaten immer wieder thematisiert und findet Anwendung.",
          "Durchgängig. Die Strategie steuert spürbar alle relevanten Entscheidungsprozesse, wird regelmäßig überprüft und angepasst. Fortschreibungen haben bereits stattgefunden. Sie wird mit Bürger:innen diskutiert.",
        ],
      },
      amt: {
        beschreibung: "Gibt es in Ihrer Gesamtverwaltung ein strategisches Dokument mit klaren Wirkungszielen, die beschreiben, was sich für die Adressat:innen der Verwaltungsleistungen verbessern soll, und spielt es eine Rolle für Planung und Entscheidungen in Ihrem Amt oder Fachbereich?",
        optionen: [
          "Nein. Ein strategisches Dokument mit Wirkungszielen fehlt in der Gesamtverwaltung oder ist veraltet. Für die Arbeit des Amts oder Fachbereichs spielt es keine Rolle.",
          "Ansatzweise. Es gibt ein strategisches Dokument mit Wirkungszielen in der Gesamtverwaltung, es hat aber kaum Einfluss auf Planung und Entscheidungen im Amt oder Fachbereich.",
          "Teilweise. Das strategische Dokument ist mindestens einmal fortgeschrieben und politisch beschlossen. Im Amt oder Fachbereich ist es bekannt.",
          "Überwiegend. Die Strategie wird in Besprechungen und Entscheidungsformaten des Amts oder Fachbereichs thematisiert und findet Anwendung.",
          "Durchgängig. Die Strategie steuert spürbar die relevanten Entscheidungsprozesse im Amt oder Fachbereich. Sie wird regelmäßig überprüft und angepasst. Fortschreibungen haben bereits stattgefunden. Sie wird mit Bürger:innen diskutiert.",
        ],
      },
      team: {
        beschreibung: "Gibt es in Ihrer Gesamtverwaltung ein strategisches Dokument mit klaren Wirkungszielen, die beschreiben, was sich für die Adressat:innen der Verwaltungsleistungen verbessern soll, und spürt Ihr Team davon etwas in seiner täglichen Arbeit?",
        optionen: [
          "Nein. Ein strategisches Dokument mit Wirkungszielen fehlt in der Gesamtverwaltung oder ist veraltet. Für die Arbeit des Teams spielt es keine Rolle.",
          "Ansatzweise. Es gibt ein strategisches Dokument in der Gesamtverwaltung, es hat aber kaum Einfluss auf Prioritäten und Entscheidungen im Team.",
          "Teilweise. Das strategische Dokument ist mindestens einmal fortgeschrieben und politisch beschlossen. Im Team ist es bekannt.",
          "Überwiegend. Die Strategie wird auch im Team thematisiert und beeinflusst die Prioritäten und Entscheidungen der Teamarbeit.",
          "Durchgängig. Die Strategie steuert spürbar die Arbeit des Teams. Sie wird regelmäßig überprüft und angepasst. Fortschreibungen haben bereits stattgefunden. Sie wird mit Bürger:innen diskutiert.",
        ],
      },
    },
  },
  {
    id: "f2", nummer: 2, teil: "A", teilLabel: "Strategie und Wirkung", kategorie: "strategie",
    titel: "Daten und Wirkungsmessung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Werden zu den zentralen Zielen Ihrer Verwaltung regelmäßig Daten erhoben, die zeigen, was sich für die Menschen verändert, und so aufbereitet, dass Leitung, Fachbereiche und Politik damit arbeiten können?",
        optionen: [
          "Gar nicht. Zentrale Ziele sind nicht klar. Es gibt weder eine regelmäßige Erhebung noch eine Auswertung.",
          "Anlassbezogen. Daten werden erhoben und ausgewertet, aber ohne feste Routine.",
          "Verfügbar. Relevante Daten werden regelmäßig erhoben und stehen Leitung und Politik zur Verfügung, zum Beispiel in Berichten oder Tabellen. Eine systematische Nutzung in Entscheidungsprozessen findet jedoch noch nicht durchgängig statt.",
          "Etabliert. Es gibt eine gelebte Qualitätserwartung an die Evidenzbasierung nahezu aller wichtigen Entscheidungsprozesse. Ein Dashboard gehört zur Arbeitsroutine in Leitungsrunden, Fachbereichen und Ausschüssen.",
          "Lernend. Kennzahlen, Zielorientierung und Evidenzbasierung werden regelmäßig hinterfragt und aktualisiert. Es gibt einen systematischen Prozess, die Ergebnisse der Umsetzung zu bewerten. Zentrale Werkzeuge für Datennutzung, Wirkung und Evaluation werden systematisch genutzt und weiterentwickelt.",
        ],
      },
      amt: {
        beschreibung: "Werden in Ihrem Amt oder Fachbereich zu den zentralen Zielen regelmäßig Daten erhoben, die zeigen, was sich für die Menschen verändert, und so aufbereitet, dass Leitung und Fachbereiche damit arbeiten können?",
        optionen: [
          "Gar nicht. Zentrale Ziele sind im Amt oder Fachbereich nicht klar. Es gibt weder eine regelmäßige Erhebung noch eine Auswertung.",
          "Anlassbezogen. Daten werden erhoben und ausgewertet, aber ohne feste Routine.",
          "Verfügbar. Relevante Daten werden regelmäßig erhoben und stehen der Leitung zur Verfügung, zum Beispiel in Berichten oder Tabellen. Eine systematische Nutzung in Entscheidungsprozessen findet jedoch noch nicht durchgängig statt.",
          "Etabliert. Es gibt eine gelebte Qualitätserwartung an die Evidenzbasierung nahezu aller wichtigen Entscheidungsprozesse im Amt oder Fachbereich. Ein Dashboard gehört zur Arbeitsroutine in Leitungsrunden und Fachbereichen.",
          "Lernend. Kennzahlen, Zielorientierung und Evidenzbasierung werden regelmäßig hinterfragt und aktualisiert. Es gibt einen systematischen Prozess, die Ergebnisse der Umsetzung zu bewerten. Zentrale Werkzeuge für Datennutzung, Wirkung und Evaluation werden systematisch genutzt und weiterentwickelt.",
        ],
      },
      team: {
        beschreibung: "Werden in Ihrem Team zu den zentralen Zielen regelmäßig Daten erhoben, die zeigen, was sich für die Menschen verändert, und so aufbereitet, dass das Team damit arbeiten kann?",
        optionen: [
          "Gar nicht. Zentrale Ziele sind im Team nicht klar. Es gibt weder eine regelmäßige Erhebung noch eine Auswertung.",
          "Anlassbezogen. Daten werden erhoben und ausgewertet, aber ohne feste Routine.",
          "Verfügbar. Relevante Daten werden regelmäßig erhoben und stehen dem Team zur Verfügung, zum Beispiel in Berichten oder Tabellen. Eine systematische Nutzung in der Teamarbeit findet jedoch noch nicht durchgängig statt.",
          "Etabliert. Es gibt eine gelebte Qualitätserwartung an die Evidenzbasierung nahezu aller wichtigen Entscheidungen im Team. Daten und Kennzahlen gehören zur Arbeitsroutine.",
          "Lernend. Kennzahlen, Zielorientierung und Evidenzbasierung werden regelmäßig hinterfragt und aktualisiert. Es gibt einen systematischen Prozess, die Ergebnisse der Umsetzung zu bewerten. Zentrale Werkzeuge für Datennutzung, Wirkung und Evaluation werden systematisch genutzt und weiterentwickelt.",
        ],
      },
    },
  },
  {
    id: "f3", nummer: 3, teil: "A", teilLabel: "Strategie und Wirkung", kategorie: "strategie",
    titel: "Vorausschau und Trendbeobachtung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Beobachtet Ihre Verwaltung datengetrieben, was auf sie zukommt, etwa demografischer Wandel, Klimafolgen oder neue Technologien, und nutzt sie diese Erkenntnisse bei Planungs- und Entscheidungsprozessen?",
        optionen: [
          "Nein. Entscheidungen basieren auf Erfahrung und Gefühl, künftige Entwicklungen spielen keine systematische Rolle.",
          "Manchmal. Bei größeren Vorhaben werden Daten oder Trendbeobachtungen herangezogen, aber anlassbezogen und ohne feste Struktur.",
          "In der Regel. Eine Stelle nahe der Verwaltungsleitung beobachtet relevante Studien und Entwicklungen, ordnet sie ein und bringt sie mit den zuständigen Fachämtern ins Gespräch.",
          "Systematisch. Vorausschau-Ergebnisse fließen regelmäßig in Planungs- und Haushaltsprozesse ein, sind politisch verankert und überdauern Wahlzyklen.",
          "Lernend. Annahmen werden nach Beschlüssen überprüft, Vorausschau-Ergebnisse werden aktiv mit der Stadtgesellschaft diskutiert, auch unbequeme Szenarien.",
        ],
      },
      amt: {
        beschreibung: "Beobachtet Ihre Gesamtverwaltung datengetrieben, was auf sie zukommt, etwa demografischer Wandel, Klimafolgen oder neue Technologien, und fließen diese Erkenntnisse in Planungs- und Entscheidungsprozesse Ihres Amts oder Fachbereichs ein?",
        optionen: [
          "Nein. Entscheidungen im Amt oder Fachbereich basieren auf Erfahrung und Gefühl, künftige Entwicklungen aus der Gesamtverwaltung spielen keine systematische Rolle.",
          "Manchmal. Bei größeren Vorhaben werden Daten oder Trendbeobachtungen aus der Gesamtverwaltung herangezogen, aber anlassbezogen und ohne feste Struktur.",
          "In der Regel. Eine Stelle nahe der Verwaltungsleitung beobachtet relevante Studien und Entwicklungen und bringt sie mit den zuständigen Fachämtern ins Gespräch.",
          "Systematisch. Vorausschau-Ergebnisse fließen regelmäßig in Planungs- und Haushaltsprozesse des Amts oder Fachbereichs ein, sind politisch verankert und überdauern Wahlzyklen.",
          "Lernend. Annahmen werden nach Beschlüssen überprüft, Vorausschau-Ergebnisse werden aktiv mit der Stadtgesellschaft diskutiert, auch unbequeme Szenarien.",
        ],
      },
      team: {
        beschreibung: "Beobachtet Ihre Gesamtverwaltung datengetrieben, was auf sie zukommt, etwa demografischer Wandel, Klimafolgen oder neue Technologien, und spürt Ihr Team diese Erkenntnisse in der Ausrichtung seiner Arbeit?",
        optionen: [
          "Nein. Entscheidungen im Team basieren auf Erfahrung und Gefühl, strategische Erkenntnisse aus der Gesamtverwaltung spielen keine Rolle.",
          "Manchmal. Gelegentlich werden Trendbeobachtungen aus der Gesamtverwaltung aufgegriffen, aber anlassbezogen und ohne feste Struktur.",
          "In der Regel. Eine Stelle nahe der Verwaltungsleitung beobachtet relevante Studien und Entwicklungen und bringt sie mit den zuständigen Stellen ins Gespräch. Das Team bekommt das mit.",
          "Systematisch. Vorausschau-Ergebnisse fließen regelmäßig in Planungs- und Haushaltsprozesse ein und beeinflussen auch die Arbeit des Teams, politisch verankert und überdauernd über Wahlzyklen hinaus.",
          "Lernend. Annahmen werden nach Beschlüssen überprüft, Vorausschau-Ergebnisse werden aktiv mit der Stadtgesellschaft diskutiert, auch unbequeme Szenarien. Das Team ist Teil dieses Lernprozesses.",
        ],
      },
    },
  },
  {
    id: "f4", nummer: 4, teil: "B", teilLabel: "Führung und Kultur", kategorie: "fuehrung",
    titel: "Führungskräfte-Feedback",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Erhalten Führungskräfte in Ihrer Verwaltung regelmäßig strukturiertes Feedback von allen Seiten, und nutzen sie es, um sich und ihre Führung weiterzuentwickeln?",
        optionen: [
          "Nein. Strukturiertes Feedback zur Führungsqualität findet nicht verlässlich oder nur in Einzelfällen statt.",
          "Vereinzelt. Es gibt ein vorgesehenes Verfahren oder einzelne Feedbackformate, diese werden aber nicht regelmäßig oder flächendeckend umgesetzt.",
          "Teilweise. Eine Mehrzahl der Führungskräfte wird regelmäßig von mehreren Seiten bewertet, etwa durch Kolleg:innen (270-Grad) oder zusätzlich Vorgesetzte (360-Grad). Maßnahmen werden vereinbart, aber nicht konsequent nachgehalten.",
          "Überwiegend. Nahezu alle Führungskräfte nehmen regelmäßig an 270- oder 360-Grad-Feedback teil. Vereinbarte Maßnahmen werden umgesetzt und nachgehalten.",
          "Vorbildlich. Alle Führungskräfte nehmen regelmäßig an 270- oder 360-Grad-Feedback teil. Führungskräfte machen ihre Entwicklung durch das Feedback transparent und ermutigen andere, es ihnen gleichzutun.",
        ],
      },
      amt: {
        beschreibung: "Erhalten Führungskräfte in Ihrem Amt oder Fachbereich regelmäßig strukturiertes Feedback von allen Seiten, und nutzen sie es, um sich und ihre Führung weiterzuentwickeln?",
        optionen: [
          "Nein. Strukturiertes Feedback zur Führungsqualität findet im Amt oder Fachbereich nicht verlässlich oder nur in Einzelfällen statt.",
          "Vereinzelt. Es gibt ein vorgesehenes Verfahren oder einzelne Feedbackformate, diese werden aber nicht regelmäßig oder flächendeckend umgesetzt.",
          "Teilweise. Eine Mehrzahl der Führungskräfte im Amt oder Fachbereich wird regelmäßig von mehreren Seiten bewertet, etwa durch Kolleg:innen (270-Grad) oder zusätzlich Vorgesetzte (360-Grad). Maßnahmen werden vereinbart, aber nicht konsequent nachgehalten.",
          "Überwiegend. Nahezu alle Führungskräfte im Amt oder Fachbereich nehmen regelmäßig an 270- oder 360-Grad-Feedback teil. Vereinbarte Maßnahmen werden umgesetzt und nachgehalten.",
          "Vorbildlich. Alle Führungskräfte im Amt oder Fachbereich nehmen regelmäßig an 270- oder 360-Grad-Feedback teil. Führungskräfte machen ihre Entwicklung durch das Feedback transparent und ermutigen andere, es ihnen gleichzutun.",
        ],
      },
      team: {
        beschreibung: "Erhält Ihre direkte Führungskraft regelmäßig strukturiertes Feedback von allen Seiten, und nutzt sie es, um sich und ihre Führung weiterzuentwickeln?",
        optionen: [
          "Nein. Strukturiertes Feedback zur Führungsqualität findet nicht verlässlich oder nur in Einzelfällen statt.",
          "Vereinzelt. Es gibt ein vorgesehenes Verfahren oder einzelne Feedbackformate, diese werden aber nicht regelmäßig umgesetzt.",
          "Teilweise. Ihre Führungskraft wird regelmäßig von mehreren Seiten bewertet, etwa durch Kolleg:innen (270-Grad) oder zusätzlich Vorgesetzte (360-Grad). Maßnahmen werden vereinbart, aber nicht konsequent nachgehalten.",
          "Überwiegend. Ihre Führungskraft nimmt regelmäßig an 270- oder 360-Grad-Feedback teil. Vereinbarte Maßnahmen werden umgesetzt und nachgehalten.",
          "Vorbildlich. Ihre Führungskraft nimmt regelmäßig an 270- oder 360-Grad-Feedback teil, macht ihre Entwicklung dadurch transparent und ermutigt andere, es ihr gleichzutun.",
        ],
      },
    },
  },
  {
    id: "f5", nummer: 5, teil: "B", teilLabel: "Führung und Kultur", kategorie: "fuehrung",
    titel: "Leitbild und offene Fehlerkultur",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Gibt es in Ihrer Verwaltung ein gelebtes Leitbild für die Verwaltungskultur?",
        optionen: [
          "Nein. Ein Leitbild zu Verwaltungskultur fehlt oder ist unbekannt.",
          "Ansatzweise. Es gibt ein Leitbild mit modernen Kulturwerten, es ist aber wenig bekannt und spiegelt sich kaum im Alltag wider.",
          "Teilweise. Das Leitbild ist bekannt, aber kein flächendeckender Anspruch. Einzelne Bereiche leben moderne Werte vor, etwa ämterübergreifende Zusammenarbeit oder offenes Ansprechen von Fehlern.",
          "Überwiegend. Das Leitbild ist in der Führungsarbeit und im Alltag spürbar. Beschäftigte denken vom Menschen aus, hinterfragen Prozesse, sprechen Probleme und Widerspruch offen an und erproben Neues mit Rückendeckung.",
          "Vorbildlich. Die Werte prägen den Verwaltungsalltag. Fehler, Probleme und Widerspruch werden selbstverständlich für gemeinsames Lernen genutzt. Die Leitung misst sich selbst daran und entwickelt das Leitbild gemeinsam mit den Beschäftigten weiter.",
        ],
      },
      amt: {
        beschreibung: "Gibt es in Ihrer Gesamtverwaltung ein gelebtes Leitbild für die Verwaltungskultur, und zeigt es sich in der Arbeit und im Alltag Ihres Amts oder Fachbereichs?",
        optionen: [
          "Nein. Ein Leitbild zu Verwaltungskultur fehlt oder ist unbekannt. Im Amt oder Fachbereich spielt es keine Rolle.",
          "Ansatzweise. Es gibt ein Leitbild mit modernen Kulturwerten, es ist aber wenig bekannt und spiegelt sich kaum im Alltag des Amts oder Fachbereichs wider.",
          "Teilweise. Das Leitbild ist bekannt, aber kein flächendeckender Anspruch. Einzelne Bereiche leben moderne Werte vor, etwa ämterübergreifende Zusammenarbeit oder offenes Ansprechen von Fehlern.",
          "Überwiegend. Das Leitbild ist in der Führungsarbeit und im Alltag des Amts oder Fachbereichs spürbar. Beschäftigte denken vom Menschen aus, hinterfragen Prozesse, sprechen Probleme und Widerspruch offen an und erproben Neues mit Rückendeckung.",
          "Vorbildlich. Die Werte prägen den Alltag im Amt oder Fachbereich. Fehler, Probleme und Widerspruch werden selbstverständlich für gemeinsames Lernen genutzt. Die Leitung misst sich selbst daran und entwickelt das Leitbild gemeinsam mit den Beschäftigten weiter.",
        ],
      },
      team: {
        beschreibung: "Gibt es in Ihrer Gesamtverwaltung ein gelebtes Leitbild für die Verwaltungskultur, und zeigt es sich im Alltag Ihres Teams?",
        optionen: [
          "Nein. Ein Leitbild zu Verwaltungskultur fehlt oder ist unbekannt. Im Team spielt es keine Rolle.",
          "Ansatzweise. Es gibt ein Leitbild mit modernen Kulturwerten, es ist aber wenig bekannt und spiegelt sich kaum im Alltag des Teams wider.",
          "Teilweise. Das Leitbild ist bekannt, aber kein flächendeckender Anspruch. Im Team werden einzelne moderne Werte vorgelebt, etwa ämterübergreifende Zusammenarbeit oder offenes Ansprechen von Fehlern.",
          "Überwiegend. Das Leitbild ist in der Führungsarbeit und im Alltag des Teams spürbar. Teammitglieder denken vom Menschen aus, hinterfragen Prozesse, sprechen Probleme und Widerspruch offen an und erproben Neues mit Rückendeckung.",
          "Vorbildlich. Die Werte prägen den Teamalltag. Fehler, Probleme und Widerspruch werden selbstverständlich für gemeinsames Lernen genutzt. Die Führungskraft misst sich selbst daran und entwickelt das Leitbild gemeinsam mit den Beschäftigten weiter.",
        ],
      },
    },
  },
  {
    id: "f6", nummer: 6, teil: "B", teilLabel: "Führung und Kultur", kategorie: "fuehrung",
    titel: "Agile Prozesse und Lernkultur",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Erprobt Ihre Verwaltung neue Lösungen agil und nutzerzentriert, und lernt sie institutionell aus Fehlschlägen?",
        optionen: [
          "Nein. Erprobungen finden nicht statt.",
          "Vereinzelt. In einigen Bereichen wird ausprobiert, aber anlassbezogen, zusätzlich zum Tagesgeschäft und ohne agile Methodik oder strukturelle Verankerung.",
          "Aufgebaut. Agile Methoden und nutzerzentriertes Prototyping werden zentral angeregt und begleitet.",
          "Institutionalisiert. Es gibt Experimentierräume, Reallabore oder ein Innovationsbudget, in denen agile Prozesse systematisch eingesetzt werden. Der Weg vom Pilot in den Regelbetrieb ist geregelt.",
          "Wegweisend. Die Verwaltung betreibt ein eigenes Labor, in dem agile Methoden und nutzerzentriertes Prototyping in nahezu allen Bereichen Normalfall sind. Fehlschläge werden systematisch ausgewertet und zugänglich dokumentiert. Die methodische Begleitung und Qualitätssicherung selbst ist Gegenstand beständiger Verbesserung.",
        ],
      },
      amt: {
        beschreibung: "Erprobt Ihr Amt oder Fachbereich neue Lösungen agil und nutzerzentriert, und lernt es institutionell aus Fehlschlägen?",
        optionen: [
          "Nein. Erprobungen finden im Amt oder Fachbereich nicht statt.",
          "Vereinzelt. In einigen Bereichen wird ausprobiert, aber anlassbezogen, zusätzlich zum Tagesgeschäft und ohne agile Methodik oder strukturelle Verankerung.",
          "Aufgebaut. Agile Methoden und nutzerzentriertes Prototyping werden im Amt oder Fachbereich angeregt und begleitet.",
          "Institutionalisiert. Es gibt Experimentierräume oder ein Innovationsbudget, in denen agile Prozesse im Amt oder Fachbereich systematisch eingesetzt werden. Der Weg vom Pilot in den Regelbetrieb ist geregelt.",
          "Wegweisend. Agile Methoden und nutzerzentriertes Prototyping sind im Amt oder Fachbereich in nahezu allen Bereichen Normalfall. Fehlschläge werden systematisch ausgewertet und zugänglich dokumentiert. Die methodische Begleitung und Qualitätssicherung selbst ist Gegenstand beständiger Verbesserung.",
        ],
      },
      team: {
        beschreibung: "Erprobt Ihr Team neue Lösungen agil und nutzerzentriert, und lernt es aus Fehlschlägen?",
        optionen: [
          "Nein. Erprobungen finden im Team nicht statt.",
          "Vereinzelt. Gelegentlich wird etwas ausprobiert, aber anlassbezogen, zusätzlich zum Tagesgeschäft und ohne agile Methodik oder strukturelle Verankerung.",
          "Aufgebaut. Agile Methoden und nutzerzentriertes Prototyping werden im Team angewendet und von der Führungskraft unterstützt.",
          "Institutionalisiert. Das Team hat Raum und Ressourcen, um agil zu arbeiten. Der Weg vom Pilot in den Regelbetrieb ist geregelt.",
          "Wegweisend. Agile Methoden und nutzerzentriertes Prototyping sind im Team Normalfall. Fehlschläge werden systematisch ausgewertet und zugänglich dokumentiert. Die Qualitätssicherung selbst ist Gegenstand beständiger Verbesserung.",
        ],
      },
    },
  },
  {
    id: "f7", nummer: 7, teil: "C", teilLabel: "Personal", kategorie: "personal",
    titel: "Kompetenzaufbau und Personalentwicklung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Baut Ihre Verwaltung gezielt die Fähigkeiten auf, die eine moderne Verwaltung braucht, und eröffnet sie dafür echte Entwicklungswege?",
        optionen: [
          "Nein. Weiterbildung geschieht auf Eigeninitiative, ein systematisches Angebot gibt es nicht.",
          "Begrenzt. Es gibt ein Fortbildungsprogramm, überwiegend zu Fachrecht und Pflichtthemen.",
          "Breiter. Das Fortbildungsprogramm deckt auch Datenkompetenz, KI, Projektarbeit, Moderation und Führung ab. Jede Person hat ein jährliches Entwicklungsgespräch mit dokumentierten Lernzielen.",
          "Verankert. Lernziele werden nachgehalten und mit Zeit und Budget unterlegt. Entwicklung ist auch ohne Führungsposition möglich, etwa über Fach- oder Projektlaufbahnen, Hospitation und Rotation.",
          "Vorbildlich. Weiterbildung ist sichtbar an konkrete Modernisierungsziele gekoppelt. Beschäftigte treiben mit dem Gelernten nachweislich Veränderungen voran und neue Kompetenzen eröffnen tatsächlich neue Rollen, auch unabhängig von formalen Laufbahnstrukturen.",
        ],
      },
      amt: {
        beschreibung: "Baut Ihr Amt oder Fachbereich gezielt die Fähigkeiten auf, die eine moderne Verwaltung braucht, und eröffnet es dafür echte Entwicklungswege?",
        optionen: [
          "Nein. Weiterbildung geschieht auf Eigeninitiative, ein systematisches Angebot gibt es im Amt oder Fachbereich nicht.",
          "Begrenzt. Es gibt ein Fortbildungsprogramm, überwiegend zu Fachrecht und Pflichtthemen.",
          "Breiter. Das Fortbildungsprogramm deckt auch Datenkompetenz, KI, Projektarbeit, Moderation und Führung ab. Jede Person hat ein jährliches Entwicklungsgespräch mit dokumentierten Lernzielen.",
          "Verankert. Lernziele werden nachgehalten und mit Zeit und Budget unterlegt. Entwicklung ist auch ohne Führungsposition möglich, etwa über Fach- oder Projektlaufbahnen, Hospitation und Rotation.",
          "Vorbildlich. Weiterbildung ist im Amt oder Fachbereich sichtbar an konkrete Modernisierungsziele gekoppelt. Beschäftigte treiben mit dem Gelernten nachweislich Veränderungen voran und neue Kompetenzen eröffnen tatsächlich neue Rollen, auch unabhängig von formalen Laufbahnstrukturen.",
        ],
      },
      team: {
        beschreibung: "Baut Ihr Team gezielt die Fähigkeiten auf, die eine moderne Verwaltung braucht, und gibt es dafür echte Entwicklungswege für die Teammitglieder?",
        optionen: [
          "Nein. Weiterbildung geschieht auf Eigeninitiative, ein systematisches Angebot gibt es nicht.",
          "Begrenzt. Es gibt ein Fortbildungsprogramm, überwiegend zu Fachrecht und Pflichtthemen.",
          "Breiter. Das Fortbildungsprogramm deckt auch Datenkompetenz, KI, Projektarbeit, Moderation und Führung ab. Jede Person hat ein jährliches Entwicklungsgespräch mit dokumentierten Lernzielen.",
          "Verankert. Lernziele werden nachgehalten und mit Zeit und Budget unterlegt. Entwicklung ist auch ohne Führungsposition möglich, etwa über Fach- oder Projektlaufbahnen, Hospitation und Rotation.",
          "Vorbildlich. Weiterbildung ist sichtbar an konkrete Modernisierungsziele des Teams gekoppelt. Teammitglieder treiben mit dem Gelernten nachweislich Veränderungen voran und neue Kompetenzen eröffnen tatsächlich neue Rollen, auch unabhängig von formalen Laufbahnstrukturen.",
        ],
      },
    },
  },
  {
    id: "f8", nummer: 8, teil: "C", teilLabel: "Personal", kategorie: "personal",
    titel: "Arbeitgeberattraktivität und Durchlässigkeit",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Ist Ihre Verwaltung attraktiv genug für die Gewinnung und das Halten von Arbeitskräften, und baut sie strukturelle Hürden für Wechsel zwischen Verwaltung und anderen Arbeitsfeldern ab?",
        optionen: [
          "Ungeklärt. Stellen werden ausgeschrieben, alles Weitere ergibt sich. Wer keinen klassischen Verwaltungshintergrund hat, kommt kaum rein.",
          "Vereinzelt. Es gibt einzelne Maßnahmen zur Gewinnung, aber Quereinstieg ist die Ausnahme und strukturell schwierig.",
          "Aufgebaut. Stellenprofile sind offen formuliert und sprechen auch Menschen ohne Verwaltungshintergrund an. Bewerbung und Einarbeitung sind zugänglich gestaltet.",
          "Gesteuert. Quereinstieg funktioniert praktisch, mit geregelten Einstiegswegen, angepassten Auswahlverfahren und strukturierter Einarbeitung. Auch temporäre Wechsel aus der Verwaltung heraus werden aktiv ermöglicht, etwa durch Rotationen oder Hospitationen in anderen Sektoren.",
          "Konsequent. Durchlässigkeit in beide Richtungen ist gelebte Praxis und wird evaluiert. Die Verwaltung profitiert sichtbar von externen Perspektiven, und ehemalige Mitarbeitende bleiben als Netzwerk verbunden.",
        ],
      },
      amt: {
        beschreibung: "Ist Ihr Amt oder Fachbereich attraktiv genug für die Gewinnung und das Halten von Arbeitskräften, und baut es strukturelle Hürden für Wechsel zwischen Verwaltung und anderen Arbeitsfeldern ab?",
        optionen: [
          "Ungeklärt. Stellen werden ausgeschrieben, alles Weitere ergibt sich. Wer keinen klassischen Verwaltungshintergrund hat, kommt kaum rein.",
          "Vereinzelt. Es gibt einzelne Maßnahmen zur Gewinnung, aber Quereinstieg ist die Ausnahme und strukturell schwierig.",
          "Aufgebaut. Stellenprofile sind offen formuliert und sprechen auch Menschen ohne Verwaltungshintergrund an. Bewerbung und Einarbeitung sind zugänglich gestaltet.",
          "Gesteuert. Quereinstieg funktioniert praktisch im Amt oder Fachbereich, mit geregelten Einstiegswegen, angepassten Auswahlverfahren und strukturierter Einarbeitung. Auch temporäre Wechsel aus dem Amt oder Fachbereich heraus werden aktiv ermöglicht, etwa durch Rotationen oder Hospitationen in anderen Sektoren.",
          "Konsequent. Durchlässigkeit in beide Richtungen ist gelebte Praxis im Amt oder Fachbereich und wird evaluiert. Es profitiert sichtbar von externen Perspektiven, und ehemalige Mitarbeitende bleiben als Netzwerk verbunden.",
        ],
      },
      team: {
        beschreibung: "Ist Ihr Team ein attraktiver Arbeitsort für Menschen mit unterschiedlichen Hintergründen, und werden strukturelle Hürden für den Wechsel zwischen Verwaltung und anderen Arbeitsfeldern abgebaut?",
        optionen: [
          "Ungeklärt. Stellen werden ausgeschrieben, alles Weitere ergibt sich. Wer keinen klassischen Verwaltungshintergrund hat, kommt kaum rein.",
          "Vereinzelt. Es gibt einzelne Maßnahmen zur Gewinnung, aber Quereinstieg ist die Ausnahme und strukturell schwierig.",
          "Aufgebaut. Stellenprofile sind offen formuliert und sprechen auch Menschen ohne Verwaltungshintergrund an. Bewerbung und Einarbeitung sind zugänglich gestaltet.",
          "Gesteuert. Quereinstieg funktioniert praktisch im Team, mit geregelten Einstiegswegen, angepassten Auswahlverfahren und strukturierter Einarbeitung. Auch temporäre Wechsel aus dem Team heraus werden aktiv ermöglicht, etwa durch Rotationen oder Hospitationen in anderen Sektoren.",
          "Konsequent. Durchlässigkeit in beide Richtungen ist gelebte Praxis im Team und wird evaluiert. Das Team profitiert sichtbar von externen Perspektiven, und ehemalige Mitglieder bleiben als Netzwerk verbunden.",
        ],
      },
    },
  },
  {
    id: "f9", nummer: 9, teil: "D", teilLabel: "Bürger:innen im Mittelpunkt", kategorie: "digitalisierung",
    titel: "Zugänge und Abläufe aus Bürger:innen-Sicht",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Sind Zugänge, Sprache und Abläufe in Ihrer Verwaltung konsequent aus Sicht von Bürger:innen gestaltet?",
        optionen: [
          "Nein. Zugang und Abläufe folgen der Ämterstruktur. Wer etwas will, muss die zuständige Stelle selbst finden und die Amtssprache verstehen.",
          "Ansatzweise. Manche Leistungen sind nach Lebenslagen auffindbar, einzelne Schreiben und Formulare wurden verständlicher gemacht. Die Ämterlogik bleibt aber spürbar.",
          "Aufgebaut. Für die häufigsten Lebenslagen sind Abläufe ämterübergreifend abgestimmt und beschrieben. Verständliche Sprache und Barrierefreiheit sind verbindliche Vorgabe, digitale und analoge Wege stehen offen.",
          "Umgebaut. Prozesse sind entlang der Lebenslagen organisiert, nicht entlang der Ämter. Für komplexe Anliegen übernimmt eine feste Ansprechperson die interne Koordination, ohne dass Nutzende selbst navigieren müssen.",
          "Proaktiv. Leistungen werden gemeinsam mit Nutzenden entwickelt und getestet, bevor sie eingeführt werden. Wo Ansprüche bekannt sind, geht die Verwaltung von sich aus auf Menschen zu, ohne dass diese einen Antrag stellen müssen. Zugänglichkeit wird regelmäßig mit Betroffenen überprüft und nachgebessert.",
        ],
      },
      amt: {
        beschreibung: "Sind Zugänge, Sprache und Abläufe in Ihrem Amt oder Fachbereich konsequent aus Sicht von Bürger:innen gestaltet?",
        optionen: [
          "Nein. Zugang und Abläufe folgen der internen Struktur. Wer etwas will, muss die zuständige Stelle selbst finden und die Amtssprache verstehen.",
          "Ansatzweise. Manche Leistungen des Amts oder Fachbereichs sind nach Lebenslagen auffindbar, einzelne Schreiben und Formulare wurden verständlicher gemacht. Die interne Logik bleibt aber spürbar.",
          "Aufgebaut. Für die häufigsten Lebenslagen sind Abläufe abgestimmt und beschrieben. Verständliche Sprache und Barrierefreiheit sind verbindliche Vorgabe, digitale und analoge Wege stehen offen.",
          "Umgebaut. Prozesse im Amt oder Fachbereich sind entlang der Lebenslagen organisiert. Für komplexe Anliegen übernimmt eine feste Ansprechperson die interne Koordination, ohne dass Nutzende selbst navigieren müssen.",
          "Proaktiv. Leistungen werden gemeinsam mit Nutzenden entwickelt und getestet, bevor sie eingeführt werden. Wo Ansprüche bekannt sind, geht das Amt oder der Fachbereich von sich aus auf Menschen zu, ohne dass diese einen Antrag stellen müssen. Zugänglichkeit wird regelmäßig mit Betroffenen überprüft und nachgebessert.",
        ],
      },
      team: {
        beschreibung: "Sind Zugänge, Sprache und Abläufe, für die Ihr Team verantwortlich ist, konsequent aus Sicht von Bürger:innen gestaltet?",
        optionen: [
          "Nein. Zugang und Abläufe folgen der internen Struktur. Wer etwas will, muss die zuständige Stelle selbst finden und die Amtssprache verstehen.",
          "Ansatzweise. Manche Leistungen des Teams sind nach Lebenslagen auffindbar, einzelne Schreiben und Formulare wurden verständlicher gemacht. Die interne Logik bleibt aber spürbar.",
          "Aufgebaut. Für die häufigsten Lebenslagen sind Abläufe abgestimmt und beschrieben. Verständliche Sprache und Barrierefreiheit sind verbindliche Vorgabe, digitale und analoge Wege stehen offen.",
          "Umgebaut. Prozesse im Team sind entlang der Lebenslagen organisiert. Für komplexe Anliegen übernimmt eine feste Ansprechperson die Koordination, ohne dass Nutzende selbst navigieren müssen.",
          "Proaktiv. Leistungen werden gemeinsam mit Nutzenden entwickelt und getestet, bevor sie eingeführt werden. Wo Ansprüche bekannt sind, geht das Team von sich aus auf Menschen zu, ohne dass diese einen Antrag stellen müssen. Zugänglichkeit wird regelmäßig mit Betroffenen überprüft und nachgebessert.",
        ],
      },
    },
  },
  {
    id: "f10", nummer: 10, teil: "D", teilLabel: "Bürger:innen im Mittelpunkt", kategorie: "digitalisierung",
    titel: "Digitalisierung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Wie weit sind die wichtigsten Verwaltungsleistungen Ihrer Verwaltung digital, medienbruchfrei und nutzerorientiert gestaltet?",
        optionen: [
          "Gar nicht. Papier, Medienbrüche und Mehrfacherfassung prägen den Alltag. Online gibt es allenfalls Formulare zum Herunterladen, eine Digitalisierungsstrategie fehlt.",
          "Ansatzweise. Häufige Leistungen sind online beantragbar. Eine Digitalisierungsstrategie ist vorhanden, intern werden Anträge aber noch ausgedruckt oder abgetippt.",
          "Aufgebaut. Die Strategie ist fortgeschrieben und enthält Zielwerte zu medienbruchfreien Prozessen, digitaler Aktenführung und Automatisierungsgrad. Die E-Akte ist eingeführt, Optimierungspotenziale sind benannt und der Fortschritt wird regelmäßig berichtet.",
          "Durchgängig. Bei den wichtigsten Leistungen läuft der gesamte Vorgang digital vom Antrag bis zum Bescheid, ohne Ausdrucken oder Abtippen. Die Entlastung ist an Durchlaufzeiten, Aufwand oder Fehlerquoten belegbar. Zielwerte werden zu mehr als 50 % erreicht.",
          "Systematisch. Bereits vorliegende Daten werden nicht zweimal abgefragt, Bearbeitungsstände sind jederzeit einsehbar, Entscheidungen ohne Ermessensspielraum laufen automatisiert. Die Strategie umfasst nutzerzentrierte Ende-zu-Ende-Digitalisierung, Zielwerte werden zu mindestens 80 % erreicht und Nutzungsquoten führen regelmäßig zu Verbesserungen.",
        ],
      },
      amt: {
        beschreibung: "Wie weit sind die wichtigsten Leistungen Ihres Amts oder Fachbereichs digital, medienbruchfrei und nutzerorientiert gestaltet?",
        optionen: [
          "Gar nicht. Papier, Medienbrüche und Mehrfacherfassung prägen den Alltag im Amt oder Fachbereich. Online gibt es allenfalls Formulare zum Herunterladen.",
          "Ansatzweise. Häufige Leistungen des Amts oder Fachbereichs sind online beantragbar, intern werden Anträge aber noch ausgedruckt oder abgetippt.",
          "Aufgebaut. Optimierungspotenziale sind benannt, die E-Akte ist eingeführt und der Fortschritt wird regelmäßig berichtet.",
          "Durchgängig. Bei den wichtigsten Leistungen läuft der gesamte Vorgang digital vom Antrag bis zum Bescheid, ohne Ausdrucken oder Abtippen. Die Entlastung ist an Durchlaufzeiten, Aufwand oder Fehlerquoten belegbar.",
          "Systematisch. Bereits vorliegende Daten werden nicht zweimal abgefragt, Bearbeitungsstände sind jederzeit einsehbar, Entscheidungen ohne Ermessensspielraum laufen automatisiert. Nutzungsquoten führen regelmäßig zu Verbesserungen.",
        ],
      },
      team: {
        beschreibung: "Wie weit sind die Abläufe Ihres Teams digital, medienbruchfrei und nutzerorientiert gestaltet?",
        optionen: [
          "Gar nicht. Papier, Medienbrüche und Mehrfacherfassung prägen den Alltag im Team. Online gibt es allenfalls Formulare zum Herunterladen.",
          "Ansatzweise. Häufige Aufgaben des Teams sind digital unterstützt, intern werden Informationen aber noch ausgedruckt oder abgetippt.",
          "Aufgebaut. Optimierungspotenziale sind benannt, die E-Akte ist eingeführt und der Fortschritt wird regelmäßig berichtet.",
          "Durchgängig. Bei den wichtigsten Aufgaben läuft der gesamte Vorgang im Team digital, ohne Ausdrucken oder Abtippen. Die Entlastung ist an Durchlaufzeiten, Aufwand oder Fehlerquoten belegbar.",
          "Systematisch. Bereits vorliegende Daten werden nicht zweimal abgefragt, Bearbeitungsstände sind jederzeit einsehbar, Entscheidungen ohne Ermessensspielraum laufen automatisiert. Nutzungsquoten führen regelmäßig zu Verbesserungen.",
        ],
      },
    },
  },
  {
    id: "f11", nummer: 11, teil: "D", teilLabel: "Bürger:innen im Mittelpunkt", kategorie: "digitalisierung",
    titel: "Zufriedenheitsmessung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Weiß Ihre Verwaltung, wie zufrieden Adressat:innen mit ihren Leistungen sind, und verändert das etwas?",
        optionen: [
          "Nicht systematisch. Rückmeldung erreicht uns über Beschwerden und die Presse, systematische Messung findet nicht statt.",
          "Kaum. Es gab Zufriedenheitsbefragungen, aber unregelmäßig und ohne Konsequenzen.",
          "Teilweise. Zufriedenheit wird regelmäßig erhoben, differenziert nach einzelnen Leistungen und Kontaktpunkten. Rückmeldung ist niedrigschwellig möglich, digital wie vor Ort.",
          "Weitgehend. Die Ergebnisse erreichen die Fachbereiche und lösen konkrete Verbesserungen aus. Messungen fließen systematisch in Prozessverbesserungen, Planung und Strategie ein.",
          "Vollkommen. Zufriedenheit ist eine der Kennzahlen, an denen sich die Verwaltung öffentlich messen lässt. Rückmeldung kommt laufend von unterschiedlichen Gruppen, auch von denen, die sich sonst selten melden. Wer Feedback gibt, erfährt, was daraus wurde. Die Erhebungen selbst werden kontinuierlich verbessert.",
        ],
      },
      amt: {
        beschreibung: "Weiß Ihr Amt oder Fachbereich, wie zufrieden Adressat:innen mit seinen Leistungen sind, und verändert das etwas?",
        optionen: [
          "Nicht systematisch. Rückmeldung erreicht das Amt oder den Fachbereich über Beschwerden, systematische Messung findet nicht statt.",
          "Kaum. Es gab Zufriedenheitsbefragungen, aber unregelmäßig und ohne Konsequenzen.",
          "Teilweise. Zufriedenheit wird regelmäßig erhoben, differenziert nach einzelnen Leistungen und Kontaktpunkten. Rückmeldung ist niedrigschwellig möglich, digital wie vor Ort.",
          "Weitgehend. Die Ergebnisse lösen im Amt oder Fachbereich konkrete Verbesserungen aus. Messungen fließen systematisch in Prozessverbesserungen und Planung ein.",
          "Vollkommen. Zufriedenheit ist eine der Kennzahlen, an denen sich das Amt oder der Fachbereich öffentlich messen lässt. Rückmeldung kommt laufend von unterschiedlichen Gruppen, auch von denen, die sich sonst selten melden. Wer Feedback gibt, erfährt, was daraus wurde. Die Erhebungen selbst werden kontinuierlich verbessert.",
        ],
      },
      team: {
        beschreibung: "Weiß Ihr Team, wie zufrieden Adressat:innen mit seiner Arbeit sind, und verändert das etwas?",
        optionen: [
          "Nicht systematisch. Rückmeldung erreicht das Team über Beschwerden, systematische Messung findet nicht statt.",
          "Kaum. Es gab Zufriedenheitsbefragungen, aber unregelmäßig und ohne Konsequenzen.",
          "Teilweise. Zufriedenheit wird regelmäßig erhoben, differenziert nach einzelnen Leistungen und Kontaktpunkten. Rückmeldung ist niedrigschwellig möglich, digital wie vor Ort.",
          "Weitgehend. Die Ergebnisse erreichen das Team und lösen konkrete Verbesserungen aus. Messungen fließen systematisch in die Teamarbeit und Planung ein.",
          "Vollkommen. Zufriedenheit ist eine der Kennzahlen, an denen sich das Team messen lässt. Rückmeldung kommt laufend von unterschiedlichen Gruppen, auch von denen, die sich sonst selten melden. Wer Feedback gibt, erfährt, was daraus wurde. Die Erhebungen selbst werden kontinuierlich verbessert.",
        ],
      },
    },
  },
  {
    id: "f12", nummer: 12, teil: "D", teilLabel: "Bürger:innen im Mittelpunkt", kategorie: "digitalisierung",
    titel: "Kooperative Gestaltung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Gestaltet Ihre Verwaltung Ergebnisse kooperativ mit allen relevanten Akteur:innen, und ist am Ergebnis erkennbar, dass ihre Beiträge zählen?",
        optionen: [
          "Pflichtgemäß. Beteiligung und Kooperation finden dort statt, wo sie rechtlich vorgeschrieben sind.",
          "Informierend. Wir informieren gut und laden ein. Die Lösung steht dabei meist schon fest.",
          "Einbeziehend. Bei einzelnen Vorhaben arbeiten relevante Akteur:innen früh an der Entwicklung oder Umsetzung mit. Ihre Beiträge fließen erkennbar ein, und sie erfahren, was daraus entstanden ist.",
          "Verlässlich. Bei relevanten Vorhaben wird früh geklärt, welche Akteur:innen wie beitragen können. Die Beteiligung geht dort in die Tiefe, wo sie für das Vorhaben sinnvoll ist. Beiträge werden sichtbar berücksichtigt und gemeinsame Entwicklung oder Umsetzung gezielt genutzt.",
          "Selbstverständlich. Beteiligung ist verwaltungsweit etabliert und verbessert nachweislich die Ergebnisse. Sie wird passgenau, wirksam und mit angemessenem Aufwand gestaltet. Die Verwaltung lernt aus ihrer Beteiligungspraxis und entwickelt sie kontinuierlich weiter.",
        ],
      },
      amt: {
        beschreibung: "Gestaltet Ihr Amt oder Fachbereich Ergebnisse kooperativ mit allen relevanten Akteur:innen, und ist am Ergebnis erkennbar, dass ihre Beiträge zählen?",
        optionen: [
          "Pflichtgemäß. Beteiligung und Kooperation finden dort statt, wo sie rechtlich vorgeschrieben sind.",
          "Informierend. Das Amt oder der Fachbereich informiert gut und lädt ein. Die Lösung steht dabei meist schon fest.",
          "Einbeziehend. Bei einzelnen Vorhaben arbeiten relevante Akteur:innen früh an der Entwicklung oder Umsetzung mit. Ihre Beiträge fließen erkennbar ein, und sie erfahren, was daraus entstanden ist.",
          "Verlässlich. Bei relevanten Vorhaben wird früh geklärt, welche Akteur:innen wie beitragen können. Die Beteiligung geht dort in die Tiefe, wo sie für das Vorhaben sinnvoll ist. Beiträge werden sichtbar berücksichtigt und gemeinsame Entwicklung oder Umsetzung gezielt genutzt.",
          "Selbstverständlich. Beteiligung ist im Amt oder Fachbereich etabliert und verbessert nachweislich die Ergebnisse. Sie wird passgenau, wirksam und mit angemessenem Aufwand gestaltet. Das Amt oder der Fachbereich lernt aus seiner Beteiligungspraxis und entwickelt sie kontinuierlich weiter.",
        ],
      },
      team: {
        beschreibung: "Gestaltet Ihr Team Ergebnisse kooperativ mit allen relevanten Akteur:innen, und ist am Ergebnis erkennbar, dass ihre Beiträge zählen?",
        optionen: [
          "Pflichtgemäß. Beteiligung und Kooperation finden dort statt, wo sie rechtlich vorgeschrieben sind.",
          "Informierend. Das Team informiert gut und lädt ein. Die Lösung steht dabei meist schon fest.",
          "Einbeziehend. Bei einzelnen Vorhaben arbeiten relevante Akteur:innen früh an der Entwicklung oder Umsetzung mit. Ihre Beiträge fließen erkennbar ein, und sie erfahren, was daraus entstanden ist.",
          "Verlässlich. Bei relevanten Vorhaben wird früh geklärt, welche Akteur:innen wie beitragen können. Die Beteiligung geht dort in die Tiefe, wo sie für das Vorhaben sinnvoll ist. Beiträge werden sichtbar berücksichtigt und gemeinsame Entwicklung oder Umsetzung gezielt genutzt.",
          "Selbstverständlich. Beteiligung ist im Team etabliert und verbessert nachweislich die Ergebnisse. Sie wird passgenau, wirksam und mit angemessenem Aufwand gestaltet. Das Team lernt aus seiner Beteiligungspraxis und entwickelt sie kontinuierlich weiter.",
        ],
      },
    },
  },
  {
    id: "f13", nummer: 13, teil: "E", teilLabel: "Offenheit, Zusammenarbeit, Demokratie", kategorie: "kooperation",
    titel: "Transparenz und Ergebnisberichterstattung",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Sorgt Ihre Verwaltung aktiv dafür, dass von außen erkennbar und überprüfbar ist, welche Leistungen sie erbringt und was dabei herauskommt?",
        optionen: [
          "Kaum. Veröffentlicht wird, was rechtlich vorgeschrieben ist. Leistungen und Ergebnisse werden weder aktiv vermittelt noch sind sie leicht überprüfbar.",
          "Eingeschränkt. Informationen sind vorhanden, aber verstreut und schwer auffindbar. Über aktuelle Vorhaben und Ergebnisse wird vor allem auf Nachfrage informiert.",
          "Nachvollziehbar. Informationen zu Leistungen, Entscheidungsgrundlagen und Ergebnissen sind verständlich auffindbar. Über wichtige Vorhaben wird informiert, aber noch nicht regelmäßig und über alle passenden Kanäle.",
          "Sichtbar und überprüfbar. Die Verwaltung informiert aktiv über zentrale Leistungen, Vorhaben und Ergebnisse. Relevante Informationen und Daten sind aktuell zugänglich und ermöglichen eine eigenständige Einordnung und Überprüfung.",
          "Selbstverständlich. Aktive Information, transparente Grundlagen und überprüfbare Ergebnisse sind in der Verwaltung breit etabliert. Die Kommunikation erreicht unterschiedliche Gruppen, wird ausgewertet und kontinuierlich verbessert.",
        ],
      },
      amt: {
        beschreibung: "Sorgt Ihr Amt oder Fachbereich aktiv dafür, dass von außen erkennbar und überprüfbar ist, welche Leistungen es erbringt und was dabei herauskommt?",
        optionen: [
          "Kaum. Veröffentlicht wird, was rechtlich vorgeschrieben ist. Leistungen und Ergebnisse des Amts oder Fachbereichs werden weder aktiv vermittelt noch sind sie leicht überprüfbar.",
          "Eingeschränkt. Informationen sind vorhanden, aber verstreut und schwer auffindbar. Über aktuelle Vorhaben und Ergebnisse wird vor allem auf Nachfrage informiert.",
          "Nachvollziehbar. Informationen zu Leistungen, Entscheidungsgrundlagen und Ergebnissen des Amts oder Fachbereichs sind verständlich auffindbar. Über wichtige Vorhaben wird informiert, aber noch nicht regelmäßig und über alle passenden Kanäle.",
          "Sichtbar und überprüfbar. Das Amt oder der Fachbereich informiert aktiv über zentrale Leistungen, Vorhaben und Ergebnisse. Relevante Informationen und Daten sind aktuell zugänglich und ermöglichen eine eigenständige Einordnung und Überprüfung.",
          "Selbstverständlich. Aktive Information, transparente Grundlagen und überprüfbare Ergebnisse sind im Amt oder Fachbereich breit etabliert. Die Kommunikation erreicht unterschiedliche Gruppen, wird ausgewertet und kontinuierlich verbessert.",
        ],
      },
      team: {
        beschreibung: "Sorgt Ihr Team aktiv dafür, dass für andere erkennbar ist, welche Leistungen es erbringt und was dabei herauskommt?",
        optionen: [
          "Kaum. Veröffentlicht wird, was vorgeschrieben ist. Die Arbeit und Ergebnisse des Teams sind für andere weder aktiv sichtbar noch leicht überprüfbar.",
          "Eingeschränkt. Informationen sind vorhanden, aber verstreut und schwer auffindbar. Über aktuelle Vorhaben und Ergebnisse wird vor allem auf Nachfrage informiert.",
          "Nachvollziehbar. Informationen zu Leistungen und Ergebnissen des Teams sind verständlich auffindbar. Über wichtige Vorhaben wird informiert, aber noch nicht regelmäßig und über alle passenden Kanäle.",
          "Sichtbar und überprüfbar. Das Team informiert aktiv über zentrale Leistungen, Vorhaben und Ergebnisse. Relevante Informationen sind aktuell zugänglich und ermöglichen eine eigenständige Einordnung und Überprüfung.",
          "Selbstverständlich. Aktive Information und überprüfbare Ergebnisse sind im Team breit etabliert. Die Kommunikation erreicht unterschiedliche Gruppen, wird ausgewertet und kontinuierlich verbessert.",
        ],
      },
    },
  },
  {
    id: "f14", nummer: 14, teil: "E", teilLabel: "Offenheit, Zusammenarbeit, Demokratie", kategorie: "kooperation",
    titel: "Interkommunale Zusammenarbeit",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Übernimmt Ihre Verwaltung bewährte Lösungen anderer Kommunen, gibt eigene weiter und erledigt Aufgaben gemeinsam?",
        optionen: [
          "Isoliert. Wir machen unser Ding. Austausch entsteht allenfalls über persönliche Kontakte.",
          "Vernetzt. Wir sind in Netzwerken aktiv, gemeinsam umgesetzt wird aber wenig.",
          "Suchend. Vor einer Neuentwicklung suchen wir zuerst nach bestehenden Lösungen. Einzelne Aufgaben erledigen wir gemeinsam mit Nachbarkommunen, verbindlich geregelt und finanziert.",
          "Gebend. Nachnutzung ist Prinzip. Eigene Lösungen werden so dokumentiert und aktiv weitergegeben, dass andere sie direkt übernehmen können. Gemeinsame Expertenpools und Hospitationen sind etabliert.",
          "Treibend. Wir sind fester Teil eines lernenden Netzwerks, das sich selbst verbessert. Gegenüber Land und Bund treten wir gemeinsam mit anderen Kommunen auf, um strukturelle Hemmnisse zu beseitigen und Rahmenbedingungen aktiv zu gestalten.",
        ],
      },
      amt: {
        beschreibung: "Übernimmt Ihr Amt oder Fachbereich bewährte Lösungen anderer Kommunen oder Ämter, gibt eigene weiter und erledigt Aufgaben gemeinsam?",
        optionen: [
          "Isoliert. Das Amt oder der Fachbereich macht sein Ding. Austausch entsteht allenfalls über persönliche Kontakte.",
          "Vernetzt. Das Amt oder der Fachbereich ist in Netzwerken aktiv, gemeinsam umgesetzt wird aber wenig.",
          "Suchend. Vor einer Neuentwicklung sucht das Amt oder der Fachbereich zuerst nach bestehenden Lösungen. Einzelne Aufgaben werden gemeinsam mit anderen Ämtern oder Kommunen erledigt, verbindlich geregelt und finanziert.",
          "Gebend. Nachnutzung ist Prinzip. Eigene Lösungen werden so dokumentiert und aktiv weitergegeben, dass andere sie direkt übernehmen können. Gemeinsame Expertenpools und Hospitationen sind etabliert.",
          "Treibend. Das Amt oder der Fachbereich ist fester Teil eines lernenden Netzwerks, das sich selbst verbessert. Gemeinsam mit anderen wird gegenüber der Gesamtverwaltung, Land und Bund aufgetreten, um strukturelle Hemmnisse zu beseitigen.",
        ],
      },
      team: {
        beschreibung: "Übernimmt Ihr Team bewährte Lösungen anderer, gibt eigene weiter und erledigt Aufgaben gemeinsam mit anderen Teams oder Kommunen?",
        optionen: [
          "Isoliert. Das Team macht sein Ding. Austausch entsteht allenfalls über persönliche Kontakte.",
          "Vernetzt. Das Team ist in Netzwerken aktiv, gemeinsam umgesetzt wird aber wenig.",
          "Suchend. Vor einer Neuentwicklung sucht das Team zuerst nach bestehenden Lösungen. Einzelne Aufgaben werden gemeinsam mit anderen Teams oder Kommunen erledigt, verbindlich geregelt und finanziert.",
          "Gebend. Nachnutzung ist Prinzip. Eigene Lösungen werden so dokumentiert und aktiv weitergegeben, dass andere sie direkt übernehmen können. Gemeinsame Expertenpools und Hospitationen sind etabliert.",
          "Treibend. Das Team ist fester Teil eines lernenden Netzwerks, das sich selbst verbessert. Es tritt gemeinsam mit anderen auf, um strukturelle Hemmnisse zu beseitigen und Rahmenbedingungen aktiv zu gestalten.",
        ],
      },
    },
  },
  {
    id: "f15", nummer: 15, teil: "E", teilLabel: "Offenheit, Zusammenarbeit, Demokratie", kategorie: "kooperation",
    titel: "Demokratische Resilienz",
    texte: {
      gesamtverwaltung: {
        beschreibung: "Wissen die Beschäftigten Ihrer Verwaltung, wie sie handeln sollen, wenn die freiheitlich-demokratische Grundordnung unter Druck gerät?",
        optionen: [
          "Nein. Das ist kein Thema.",
          "Informell. Im Einzelfall unterstützt die Führungskraft, geregelt ist nichts über das gesetzlich Vorgeschriebene hinaus.",
          "Abgesichert. Es gibt Ansprechpersonen und Handreichungen für konkrete Situationen, etwa Bedrohungen, Hasskommentare oder unzulässige politische Einflussnahme auf Verwaltungsentscheidungen.",
          "Geübt. Es gibt regelmäßige Schulungen und Fallbesprechungen zu realen Situationen. Das Thema ist fester Bestandteil der Verwaltungsausbildung. Verfahren wurden systematisch auf ihre Widerstandsfähigkeit gegenüber demokratiefeindlicher Einflussnahme überprüft.",
          "Verankert. Demokratische Haltung ist Teil von Leitbild, Einarbeitung und Führungsarbeit. Die Verwaltung versteht sich aktiv als Hüterin der Verfassungswerte, überprüft ihre Verfahren regelmäßig und gibt Erfahrungen an andere Kommunen weiter.",
        ],
      },
      amt: {
        beschreibung: "Wissen die Beschäftigten in Ihrem Amt oder Fachbereich, wie sie handeln sollen, wenn die freiheitlich-demokratische Grundordnung unter Druck gerät?",
        optionen: [
          "Nein. Das ist im Amt oder Fachbereich kein Thema.",
          "Informell. Im Einzelfall unterstützt die Führungskraft, geregelt ist nichts über das gesetzlich Vorgeschriebene hinaus.",
          "Abgesichert. Es gibt Ansprechpersonen und Handreichungen für konkrete Situationen, etwa Bedrohungen, Hasskommentare oder unzulässige politische Einflussnahme auf Verwaltungsentscheidungen.",
          "Geübt. Es gibt regelmäßige Schulungen und Fallbesprechungen zu realen Situationen. Das Thema ist fester Bestandteil der Einarbeitung im Amt oder Fachbereich. Verfahren wurden systematisch auf ihre Widerstandsfähigkeit gegenüber demokratiefeindlicher Einflussnahme überprüft.",
          "Verankert. Demokratische Haltung ist Teil von Leitbild, Einarbeitung und Führungsarbeit im Amt oder Fachbereich. Es versteht sich aktiv als Hüterin der Verfassungswerte, überprüft seine Verfahren regelmäßig und gibt Erfahrungen weiter.",
        ],
      },
      team: {
        beschreibung: "Wissen die Mitglieder Ihres Teams, wie sie handeln sollen, wenn die freiheitlich-demokratische Grundordnung unter Druck gerät?",
        optionen: [
          "Nein. Das ist im Team kein Thema.",
          "Informell. Im Einzelfall unterstützt die Führungskraft, geregelt ist nichts über das gesetzlich Vorgeschriebene hinaus.",
          "Abgesichert. Es gibt Ansprechpersonen und Handreichungen für konkrete Situationen, etwa Bedrohungen, Hasskommentare oder unzulässige politische Einflussnahme auf Verwaltungsentscheidungen.",
          "Geübt. Es gibt regelmäßige Schulungen und Fallbesprechungen zu realen Situationen. Das Thema ist fester Bestandteil der Einarbeitung. Verfahren wurden systematisch auf ihre Widerstandsfähigkeit gegenüber demokratiefeindlicher Einflussnahme überprüft.",
          "Verankert. Demokratische Haltung ist Teil von Leitbild, Einarbeitung und Führungsarbeit im Team. Das Team versteht sich aktiv als Hüterin der Verfassungswerte, überprüft seine Verfahren regelmäßig und gibt Erfahrungen weiter.",
        ],
      },
    },
  },
];

export interface KategorieErgebnis {
  label: string;
  score: number;
  max: number;
  prozent: number;
  beantwortet: number;
  gesamt: number;
  fragen: { id: string; titel: string; max: number; antwort: number | undefined; option: string | undefined }[];
}

export const STUFE_BESCHREIBUNG: Record<string, string> = {
  "1": "Ihre Verwaltung befindet sich am Beginn des Modernisierungsweges. In nahezu allen Bereichen besteht dringender Handlungsbedarf – dieser Bericht zeigt Ihnen, wo Sie konkret ansetzen können.",
  "2": "Erste Modernisierungsansätze sind erkennbar, aber noch unkoordiniert. In vielen Bereichen gibt es konkreten Handlungsbedarf, den Sie mit gezielten Maßnahmen angehen können.",
  "3": "Ihre Verwaltung hat in einigen Bereichen gute Fortschritte erzielt, es fehlt aber noch an einer systematischen Verzahnung. Mit konsequenter Weiterentwicklung können Sie in die Gruppe fortgeschrittener Verwaltungen aufsteigen.",
  "4": "Ihre Verwaltung ist gut aufgestellt und hat in den meisten Bereichen solide Strukturen. Gezielte Maßnahmen in den verbleibenden Entwicklungsfeldern bringen Sie an die Spitze.",
  "5": "Ihre Verwaltung gehört zu den modernsten ihrer Art. Nutzen Sie diese Position, um aktiv Vernetzung und Wissenstransfer mit anderen Kommunen zu gestalten.",
};

export interface ScoreResult {
  gesamtScore: number;
  maxScore: number;
  prozent: number;
  stufe: string;
  stufeLabel: string;
  stufeBeschreibung: string;
  kategorieScores: Record<Kategorie, KategorieErgebnis>;
  beantworteteFragen: number;
  gesamtFragen: number;
}

export function berechneScore(antworten: Record<string, number>, ebene: Ebene = "gesamtverwaltung"): ScoreResult {
  const kategorieScores = {} as Record<Kategorie, KategorieErgebnis>;
  for (const kat of Object.keys(KATEGORIEN) as Kategorie[]) {
    kategorieScores[kat] = { label: KATEGORIEN[kat].label, score: 0, max: 0, prozent: 0, beantwortet: 0, gesamt: 0, fragen: [] };
  }

  let gesamtScore = 0;
  let maxScore = 0;
  let beantworteteFragen = 0;

  for (const frage of FRAGEN) {
    const texte = getFrageText(frage, ebene);
    const antwort = antworten[frage.id];
    const max = texte.optionen.length - 1;
    const kategorie = kategorieScores[frage.kategorie];
    kategorie.gesamt++;
    kategorie.fragen.push({ id: frage.id, titel: frage.titel, max, antwort, option: antwort !== undefined ? texte.optionen[antwort] : undefined });
    if (antwort === undefined) continue;
    kategorie.beantwortet++;
    kategorieScores[frage.kategorie].score += antwort;
    kategorieScores[frage.kategorie].max += max;
    gesamtScore += antwort;
    maxScore += max;
    beantworteteFragen++;
  }

  for (const kat of Object.keys(kategorieScores) as Kategorie[]) {
    const k = kategorieScores[kat];
    k.prozent = k.max > 0 ? Math.round((k.score / k.max) * 100) : 0;
  }

  const prozent = maxScore > 0 ? Math.round((gesamtScore / maxScore) * 100) : 0;

  let stufe: string;
  let stufeLabel: string;
  if (gesamtScore <= 10) { stufe = "1"; stufeLabel = "Umfassender und dringender Veränderungsbedarf"; }
  else if (gesamtScore <= 22) { stufe = "2"; stufeLabel = "Breiter Handlungsbedarf mit erkennbaren Ansatzpunkten"; }
  else if (gesamtScore <= 34) { stufe = "3"; stufeLabel = "Systematisierungsbedarf"; }
  else if (gesamtScore <= 45) { stufe = "4"; stufeLabel = "Fortgeschrittene Verwaltung mit klar benennbarem Entwicklungspotenzial"; }
  else { stufe = "5"; stufeLabel = "Weit entwickelte Verwaltung mit Vorbildfunktion"; }

  return { gesamtScore, maxScore, prozent, stufe, stufeLabel, stufeBeschreibung: STUFE_BESCHREIBUNG[stufe], kategorieScores, beantworteteFragen, gesamtFragen: FRAGEN.length };
}

export function generiereEinschaetzung(result: ScoreResult): string {
  const mitscore = (Object.keys(result.kategorieScores) as Kategorie[])
    .filter(k => result.kategorieScores[k].beantwortet > 0)
    .sort((a, b) => result.kategorieScores[a].prozent - result.kategorieScores[b].prozent);

  if (mitscore.length === 0) return STUFE_BESCHREIBUNG[result.stufe] ?? "";

  const schwächste = mitscore[0];
  const stärkste  = mitscore[mitscore.length - 1];
  const schwachLabel = KATEGORIEN[schwächste].label;
  const starkLabel   = KATEGORIEN[stärkste].label;
  const schwachPct   = result.kategorieScores[schwächste].prozent;
  const starkPct     = result.kategorieScores[stärkste].prozent;
  const pct = result.prozent;

  if (result.stufe === "1") {
    return `Mit ${pct}% fehlen in den meisten Bereichen noch die grundlegenden Voraussetzungen für eine wirksame Modernisierung. Besonders in „${schwachLabel}" (${schwachPct}%) müssen zunächst Strukturen und klare Verantwortlichkeiten geschaffen werden – ohne diese Basis verpuffen alle weiteren Maßnahmen. Empfehlung: Starten Sie mit wenigen, machbaren Schritten, die schnell sichtbare Ergebnisse erzeugen und intern Vertrauen in den Wandel aufbauen.`;
  }
  if (result.stufe === "2") {
    return `Mit ${pct}% gibt es erste Ansätze, aber noch keinen roten Faden. Das Fundament ist vorhanden – was fehlt, ist Koordination zwischen den Bereichen. In „${schwachLabel}" (${schwachPct}%) fehlen noch die Grundlagen, die andere Bereiche ausbremsen. Der Bereich „${starkLabel}" (${starkPct}%) zeigt, was möglich ist: Dieses Know-how und diese Strukturen gezielt auf schwächere Bereiche übertragen, statt überall neu zu beginnen.`;
  }
  if (result.stufe === "3") {
    return `Mit ${pct}% zeigt Ihre Verwaltung in Teilen echte Stärke – besonders „${starkLabel}" (${starkPct}%) ist gut entwickelt. Der entscheidende nächste Schritt ist Kohärenz: Modernisierung wirkt erst dann systemisch, wenn alle Bereiche zusammenspielen. „${schwachLabel}" (${schwachPct}%) ist derzeit der Engpass – solange hier die Basis schwach ist, begrenzt das auch, was in den starken Bereichen möglich ist. Eine gezielte Investition hier hat die größte Hebelwirkung.`;
  }
  if (result.stufe === "4") {
    return `Mit ${pct}% ist Ihre Verwaltung gut modernisiert – in fast allen Bereichen gibt es solide Strukturen, „${starkLabel}" (${starkPct}%) ist besonders hervorzuheben. Jetzt geht es darum, den letzten entscheidenden Schritt zu machen: In „${schwachLabel}" (${schwachPct}%) liegt noch ungenutztes Potenzial. Schließen Sie diese Lücke, werden Stärken und Fähigkeiten Ihrer Verwaltung systemisch wirksam – und Ihr Vorsprung gegenüber anderen Kommunen deutlich messbar.`;
  }
  return `Mit ${pct}% gehört Ihre Verwaltung zur Spitzengruppe – das zeigt sich besonders in „${starkLabel}" (${starkPct}%). Auf diesem Niveau liegt der wichtigste Hebel nicht mehr im Aufholen, sondern im Gestalten: Teilen Sie Ihre Erfahrungen aktiv mit anderen Kommunen, treiben Sie gemeinsame Lösungen voran und hinterfragen Sie regelmäßig, ob Ihre Strukturen auf die Herausforderungen von morgen ausgerichtet sind.`;
}

// Request handlers derive evidence from answers, never from caller-supplied scores or questions.
export function leseReifegrad(antworten: unknown, ebene: Ebene = "gesamtverwaltung"): ScoreResult {
  if (!antworten || typeof antworten !== "object" || Array.isArray(antworten)) {
    throw new Error("Ungültige Reifegradantworten");
  }
  const values: Record<string, number> = {};
  for (const [id, value] of Object.entries(antworten)) {
    const frage = FRAGEN.find((f) => f.id === id);
    const texte = frage ? getFrageText(frage, ebene) : null;
    if (!frage || !texte || typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= texte.optionen.length) {
      throw new Error("Ungültige Reifegradantworten");
    }
    values[id] = value;
  }
  return berechneScore(values, ebene);
}

export function formatiereKategorie(ergebnis: KategorieErgebnis): string {
  const ausgelassen = ergebnis.gesamt - ergebnis.beantwortet;
  const vollstaendigkeit = ausgelassen > 0
    ? `${ausgelassen} von ${ergebnis.gesamt} Fragen übersprungen. Die Einschätzung ist unvollständig und basiert nur auf den ${ergebnis.beantwortet} beantworteten Fragen.`
    : `Alle ${ergebnis.gesamt} Fragen beantwortet.`;
  const details = ergebnis.fragen.map((frage) => frage.antwort === undefined
    ? `- ${frage.titel}: nicht beantwortet`
    : `- ${frage.titel}: Stufe ${frage.antwort}/${frage.max} · "${frage.option}"`);
  return `${ergebnis.label}: ${ergebnis.prozent}% (${ergebnis.score}/${ergebnis.max} Punkte)\n${vollstaendigkeit}\n${details.join("\n")}`;
}

export function formatiereReifegrad(ergebnis: ScoreResult): string {
  return `Gesamtreifegrad: ${ergebnis.prozent}% (Stufe ${ergebnis.stufe})\n\n${Object.values(ergebnis.kategorieScores).map(formatiereKategorie).join("\n\n")}`;
}
