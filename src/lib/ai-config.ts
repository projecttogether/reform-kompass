// AI is optional and configured only through the environment, so one image works with
// any provider or model, or with none. The code holds no model IDs.

export type KiAnbieter = "anthropic" | "openai";

export interface KiEinstellungen {
  anbieter: KiAnbieter;
  apiKey: string;
  modell: string;
  /** Passed to the provider's own effort setting; omitted when not configured. */
  effort?: string;
}

type Env = Record<string, string | undefined>;
const wert = (env: Env, name: string) => env[name]?.trim() || "";

const SCHLUESSEL: Record<KiAnbieter, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
const KI_VARIABLEN = ["AI_PROVIDER", "AI_MODEL", "AI_EFFORT", ...Object.values(SCHLUESSEL)];

/** AI_PROVIDER wins; without it Anthropic is used when its key is set, otherwise OpenAI. */
function anbieter(env: Env): KiAnbieter | "ungueltig" | null {
  const gewaehlt = wert(env, "AI_PROVIDER").toLowerCase();
  if (gewaehlt) return Object.hasOwn(SCHLUESSEL, gewaehlt) ? gewaehlt as KiAnbieter : "ungueltig";
  if (wert(env, SCHLUESSEL.anthropic)) return "anthropic";
  if (wert(env, SCHLUESSEL.openai)) return "openai";
  return null;
}

/** Returns missing or invalid settings. An empty list means AI is enabled. */
export function fehlendeKiEinstellungen(env: Env = process.env): string[] {
  const fehlend: string[] = [];
  const gewaehlt = anbieter(env);
  if (gewaehlt === "ungueltig") fehlend.push("AI_PROVIDER (anthropic oder openai)");
  else if (gewaehlt === null) fehlend.push("ANTHROPIC_API_KEY oder OPENAI_API_KEY");
  else if (!wert(env, SCHLUESSEL[gewaehlt])) fehlend.push(SCHLUESSEL[gewaehlt]);
  if (!wert(env, "AI_MODEL")) fehlend.push("AI_MODEL");
  return fehlend;
}

export function leseKiEinstellungen(env: Env = process.env): KiEinstellungen | null {
  const gewaehlt = anbieter(env);
  if (gewaehlt === null || gewaehlt === "ungueltig" || fehlendeKiEinstellungen(env).length > 0) return null;
  const effort = wert(env, "AI_EFFORT");
  return { anbieter: gewaehlt, apiKey: wert(env, SCHLUESSEL[gewaehlt]), modell: wert(env, "AI_MODEL"), ...(effort ? { effort } : {}) };
}

/** Logs the active AI configuration at server start, or why AI stays off when it was meant to be on. */
export function meldeKiEinstellungen(env: Env = process.env) {
  const ki = leseKiEinstellungen(env);
  if (ki) console.info(`KI aktiv: ${ki.anbieter}, Modell ${ki.modell}${ki.effort ? `, Effort ${ki.effort}` : ""}.`);
  else if (KI_VARIABLEN.some((name) => wert(env, name))) console.warn(`KI deaktiviert. Fehlende Einstellungen: ${fehlendeKiEinstellungen(env).join(", ")}`);
}

// Read on the server at request time so settings take effect after a restart without a rebuild.
export function getAiCapabilities() {
  return { advice: leseKiEinstellungen() !== null };
}
