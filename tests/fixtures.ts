import type { BeratungKontext } from "../src/lib/beratung";
import { erstelleKatalog } from "../src/lib/massnahmenkatalog";

export const kontext: BeratungKontext = { orgName: "Testkommune", orgTyp: "Kommune", funktion: "Amtsleitung", positionFachbereich: "Personal", ebene: "gesamtverwaltung", antworten: { f1: 4 } };

export function katalog(titel = "Lernzeit vereinbaren") {
  return erstelleKatalog(JSON.stringify({ massnahmen: [{ titel, beschreibung: "Wöchentliche Lernzeit mit dem Team vereinbaren.", bereich: "Personal", aufwand: "niedrig", verantwortung: "eigen" }] }), "Testkommune");
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Sets environment variables for one test and restores them afterwards; undefined removes a variable. */
export function setzeEnv(t: { after: (fn: () => void) => void }, werte: Record<string, string | undefined>) {
  for (const [name, wert] of Object.entries(werte)) {
    const vorher = process.env[name];
    t.after(() => { if (vorher === undefined) delete process.env[name]; else process.env[name] = vorher; });
    if (wert === undefined) delete process.env[name]; else process.env[name] = wert;
  }
}
