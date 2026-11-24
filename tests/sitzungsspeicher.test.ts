import test from "node:test";
import assert from "node:assert/strict";
import { ladeSitzung, speichereSitzung, SITZUNGS_SCHLUESSEL } from "../src/components/check/sitzungsspeicher";
import { FRAGEBOGEN_VERSION } from "../src/lib/reifegrad-model";
import { katalog } from "./fixtures";

test("legacy tab restoration preserves valid answers and conversation when its catalogue is invalid", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  });
  const oldCatalogue = katalog();
  const legacy = {
    phase: "chat", aktuelleFrageIndex: 14, kommune: "Testkommune", funktion: "Amtsleitung",
    positionFachbereich: "Personal", ebene: "gesamtverwaltung", antworten: { f1: 4, f15: 0 },
    messages: [{ role: "user", content: "Frage" }, { role: "assistant", content: "Antwort" }],
    katalog: { ...oldCatalogue, massnahmen: [{ ...oldCatalogue.massnahmen[0], verantwortung: "fremd", wer: "Amtsleitung", eigener_beitrag: "" }] },
  };
  values.set("kompass_state", JSON.stringify(legacy));
  const restored = ladeSitzung();
  assert.ok(restored);
  assert.deepEqual(restored.stand.antworten, legacy.antworten);
  assert.deepEqual(restored.stand.nachrichten, legacy.messages);
  assert.equal(restored.stand.kontext.orgName, legacy.kommune);
  assert.equal(restored.stand.phase, "chat");
  assert.equal(restored.stand.fragebogenVersion, FRAGEBOGEN_VERSION);
  assert.equal(restored.stand.katalog, null);
  assert.deepEqual(ladeSitzung(), restored, "reading twice must not consume the legacy state");
  speichereSitzung(restored);
  assert.equal(values.has("kompass_state"), false);
  assert.equal(values.has(SITZUNGS_SCHLUESSEL), true);
  assert.deepEqual(ladeSitzung(), restored);
});
