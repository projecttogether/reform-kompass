import { ANTWORTPROTOKOLL } from "./beratung-protokoll";
import { leseInhalt, PROMPT_DATEI, WISSEN_DATEI } from "./inhalte";

/** The operator's instructions, the reply protocol the app depends on, and the operator's reference material. */
export function readAdvicePrompt(): string {
  return [leseInhalt(PROMPT_DATEI), ANTWORTPROTOKOLL, leseInhalt(WISSEN_DATEI)].join("\n\n---\n\n");
}
