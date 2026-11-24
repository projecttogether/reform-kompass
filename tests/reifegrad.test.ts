import test from "node:test";
import assert from "node:assert/strict";
import { FRAGEN, KATEGORIEN, berechneScore, leseReifegrad, formatiereKategorie, formatiereReifegrad } from "../src/lib/reifegrad-model";

test("skipped questions are absent from score denominators and present in evidence", () => {
  const result = berechneScore({ f1: 4, f2: 0, f9: 2 });
  assert.equal(result.gesamtScore, 6);
  assert.equal(result.maxScore, 12);
  assert.equal(result.beantworteteFragen, 3);
  assert.equal(result.prozent, 50);
  const strategie = result.kategorieScores.strategie;
  assert.equal(strategie.beantwortet, 2);
  assert.equal(strategie.gesamt, 3);
  assert.equal(strategie.max, 8);
  assert.equal(strategie.fragen[1].option, FRAGEN[1].texte.gesamtverwaltung.optionen[0]);
  assert.match(formatiereKategorie(strategie), /1 von 3 Fragen übersprungen/);
  assert.equal(result.kategorieScores.personal.max, 0);
  assert.match(formatiereKategorie(result.kategorieScores.personal), /0 beantworteten Fragen/);
});

test("complete answers yield 60 points and consistent category evidence", () => {
  const result = leseReifegrad(Object.fromEntries(FRAGEN.map((frage) => [frage.id, 4])));
  assert.equal(result.gesamtScore, 60);
  assert.equal(result.maxScore, 60);
  assert.equal(result.stufe, "5");
  assert.equal(result.beantworteteFragen, 15);
  for (const [kat, evidence] of Object.entries(result.kategorieScores)) {
    assert.equal(evidence.label, KATEGORIEN[kat as keyof typeof KATEGORIEN].label);
    assert.equal(evidence.prozent, 100);
    assert.equal(evidence.fragen.length, evidence.beantwortet);
    assert.ok(formatiereReifegrad(result).includes(evidence.label));
  }
});

test("absolute-point Stufe thresholds stay unchanged when questions are skipped", () => {
  for (const [points, stufe] of [[0, "1"], [10, "1"], [11, "2"], [22, "2"], [23, "3"], [34, "3"], [35, "4"], [45, "4"], [46, "5"], [60, "5"]] as const) {
    let remaining = points;
    const answers = Object.fromEntries(FRAGEN.map((frage) => {
      const score = Math.min(remaining, 4);
      remaining -= score;
      return [frage.id, score];
    }));
    assert.equal(berechneScore(answers).stufe, stufe);
  }
  const partial = berechneScore({ f1: 4 });
  assert.equal(partial.prozent, 100);
  assert.equal(partial.stufe, "1");
});

test("unanswered assessments stay empty; invalid external answers are rejected", () => {
  const result = leseReifegrad({});
  assert.equal(result.maxScore, 0);
  assert.equal(result.prozent, 0);
  for (const invalid of [null, [], { f1: -1 }, { f1: 5 }, { f1: 1.5 }, { f1: "4" }, { missing: 1 }]) {
    assert.throws(() => leseReifegrad(invalid));
  }
});
