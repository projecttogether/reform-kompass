import type { Nachricht } from "./beratung";

export const MAX_KI_NACHRICHTEN = 40;
export const MAX_KI_NACHRICHT_ZEICHEN = 20_000;
export const MAX_KI_VERLAUF_ZEICHEN = 40_000;

/** Keep recent provider context without truncating the saved conversation. */
export function waehleKiVerlauf(messages: Nachricht[]): Pick<Nachricht, "role" | "content">[] {
  const result: Pick<Nachricht, "role" | "content">[] = [];
  let zeichen = 0;
  for (let i = messages.length - 1; i >= 0 && result.length < MAX_KI_NACHRICHTEN; i--) {
    const m = messages[i];
    if (m.error) continue;
    if (m.content.length > MAX_KI_NACHRICHT_ZEICHEN) throw new Error("Die Nachricht ist zu lang für die KI-Beratung.");
    if (zeichen + m.content.length > MAX_KI_VERLAUF_ZEICHEN) break;
    zeichen += m.content.length;
    result.unshift({ role: m.role, content: m.content });
  }
  return result;
}
