import test from "node:test";
import assert from "node:assert/strict";
import { fehlendeKiEinstellungen, leseKiEinstellungen, meldeKiEinstellungen } from "../src/lib/ai-config";

test("the provider follows AI_PROVIDER, otherwise the available key with Anthropic first", () => {
  const modell = { AI_MODEL: " modell-a " };
  assert.deepEqual(leseKiEinstellungen({ ...modell, ANTHROPIC_API_KEY: "a" }), { anbieter: "anthropic", apiKey: "a", modell: "modell-a" });
  assert.deepEqual(leseKiEinstellungen({ ...modell, OPENAI_API_KEY: "o" }), { anbieter: "openai", apiKey: "o", modell: "modell-a" });
  assert.equal(leseKiEinstellungen({ ...modell, ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })?.anbieter, "anthropic");
  assert.equal(leseKiEinstellungen({ ...modell, ANTHROPIC_API_KEY: " ", OPENAI_API_KEY: "o" })?.anbieter, "openai");
  assert.deepEqual(leseKiEinstellungen({ ...modell, AI_PROVIDER: " OpenAI ", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", AI_EFFORT: " high " }),
    { anbieter: "openai", apiKey: "o", modell: "modell-a", effort: "high" });
});

test("AI stays off and names what is missing when settings are incomplete or invalid", () => {
  assert.deepEqual(fehlendeKiEinstellungen({}), ["ANTHROPIC_API_KEY oder OPENAI_API_KEY", "AI_MODEL"]);
  assert.deepEqual(fehlendeKiEinstellungen({ ANTHROPIC_API_KEY: "a" }), ["AI_MODEL"], "there is no built-in model");
  assert.deepEqual(fehlendeKiEinstellungen({ AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "a", AI_MODEL: "m" }), ["OPENAI_API_KEY"]);
  assert.deepEqual(fehlendeKiEinstellungen({ AI_PROVIDER: "mistral", ANTHROPIC_API_KEY: "a", AI_MODEL: "m" }), ["AI_PROVIDER (anthropic oder openai)"]);
  assert.deepEqual(fehlendeKiEinstellungen({ AI_PROVIDER: "toString", ANTHROPIC_API_KEY: "a", AI_MODEL: "m" }), ["AI_PROVIDER (anthropic oder openai)"]);
  for (const env of [{}, { ANTHROPIC_API_KEY: "a" }, { AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "a", AI_MODEL: "m" }]) {
    assert.equal(leseKiEinstellungen(env), null);
  }
});

test("server start logs the active model, or why AI stays off only when it was meant to be on", (t) => {
  const info = t.mock.method(console, "info", () => {});
  const warn = t.mock.method(console, "warn", () => {});
  meldeKiEinstellungen({});
  assert.equal(info.mock.callCount() + warn.mock.callCount(), 0, "no AI settings at all is a normal setup");
  meldeKiEinstellungen({ ANTHROPIC_API_KEY: "geheim" });
  assert.equal(warn.mock.calls[0].arguments[0], "KI deaktiviert. Fehlende Einstellungen: AI_MODEL");
  meldeKiEinstellungen({ OPENAI_API_KEY: "geheim", AI_MODEL: "modell-a", AI_EFFORT: "low" });
  assert.equal(info.mock.calls[0].arguments[0], "KI aktiv: openai, Modell modell-a, Effort low.");
  assert.ok([...info.mock.calls, ...warn.mock.calls].every((call) => !String(call.arguments[0]).includes("geheim")), "keys are never logged");
});
