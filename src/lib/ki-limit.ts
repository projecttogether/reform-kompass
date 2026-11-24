import { clientIp } from "./proxy";
export { clientIp } from "./proxy";
import { NextResponse } from "next/server";
import { getKontoDienste } from "./konto-dienste";
import { erstelleLimiter } from "./limiter";

// Caps AI requests per member account or, without login, per client IP address.
// Municipal offices often share one IP address, so the anonymous limit stays generous;
// it guards against scripted cost abuse, not normal use. Limits live in process memory.

export const KI_LIMITS = {
  anonym: { max: 120, fensterMs: 15 * 60_000 },
  mitglied: { max: 240, fensterMs: 15 * 60_000 },
} as const;

const speicher = globalThis as typeof globalThis & { __kompassKiLimiter?: ReturnType<typeof erstelleLimiter> };
export function kiLimiter() {
  return (speicher.__kompassKiLimiter ??= erstelleLimiter());
}

function ganzzahl(name: string, standard: number, max: number) {
  const value = process.env[name];
  const n = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(n) && n > 0 && n <= max ? n : standard;
}

function begrenzt(warten: number) {
  return NextResponse.json(
    { code: "RATE_LIMITED", error: "Zu viele KI-Anfragen. Bitte versuchen Sie es in einigen Minuten erneut." },
    { status: 429, headers: { "Retry-After": String(warten) } },
  );
}

/** Returns a 429 response when the caller exceeded its AI request limit, otherwise null. */
export async function pruefeKiLimit(req: Request): Promise<Response | null> {
  let schluessel = `ip:${clientIp(req.headers)}`;
  let grenze: { max: number; fensterMs: number } = KI_LIMITS.anonym;
  try {
    const dienste = getKontoDienste();
    if (dienste) {
      const sitzung = await dienste.auth.api.getSession({ headers: req.headers, query: { disableRefresh: true } });
      if (sitzung) { schluessel = `konto:${sitzung.user.id}`; grenze = KI_LIMITS.mitglied; }
    }
  } catch (error) {
    console.error("Sitzung für KI-Limit nicht lesbar:", error);
  }
  const warten = kiLimiter().zaehle(schluessel, grenze);
  if (warten !== null) return begrenzt(warten);
  const gesamt = kiLimiter().zaehle("gesamt", { max: ganzzahl("KI_GLOBAL_MAX_REQUESTS", 1200, 100_000), fensterMs: 15 * 60_000 });
  return gesamt === null ? null : begrenzt(gesamt);
}

const parallel = globalThis as typeof globalThis & { __kompassKiAktiv?: number };
/** Hold a slot until the provider response (including a stream) ends. */
export function reserviereKiAnfrage(req: Request): { signal: AbortSignal; beenden: () => void } | Response {
  if ((parallel.__kompassKiAktiv ?? 0) >= ganzzahl("KI_MAX_PARALLEL", 8, 64)) return begrenzt(1);
  parallel.__kompassKiAktiv = (parallel.__kompassKiAktiv ?? 0) + 1;
  let beendet = false;
  return {
    // Websuche im Chat und längere Kataloge brauchen mehr als eine Minute.
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(150_000)]),
    beenden() {
      if (beendet) return;
      beendet = true;
      parallel.__kompassKiAktiv = Math.max(0, (parallel.__kompassKiAktiv ?? 1) - 1);
    },
  };
}
