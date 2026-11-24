import { AnfrageFehler, leseBegrenztesJson, leseBegrenztenText } from "./anfrage";
import { NextResponse } from "next/server";
import { leseBewertungStand, type BewertungStand } from "./bewertung";
import { getKontoDienste, leseMitglied, type KontoDienste, type Mitglied } from "./konto-dienste";
import { erstelleLimiter } from "./limiter";

export function antwort(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function fehler(status: number, code: string, meldung: string) {
  return antwort({ code, error: meldung }, status);
}

/** The account's saved assessments use up their storage budget. */
export const speicherVoll = () => fehler(413, "SPEICHER_VOLL", "Ihr Speicherplatz für Bewertungen ist erschöpft. Bitte löschen Sie ältere Bewertungen.");

/** State-changing requests must come from this application's own pages. */
export function gleicheHerkunft(req: Request, baseURL: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:")
      && !parsed.username && !parsed.password && parsed.origin === origin
      && parsed.origin === new URL(baseURL).origin;
  } catch { return false; }
}

const AENDERND = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const limiterSpeicher = globalThis as typeof globalThis & { __kompassKontoLimiter?: ReturnType<typeof erstelleLimiter> };
/** Limits for account actions, kept apart from the AI limiter so neither can fill the other. */
export function kontoLimiter() {
  return (limiterSpeicher.__kompassKontoLimiter ??= erstelleLimiter());
}

/** Auto-save sends at most one save per 1.2 seconds of changes; this is far above normal use. */
export const SPEICHERUNGEN_PRO_KONTO = { max: 240, fensterMs: 15 * 60_000 };

/** Returns a 429 response once the member exceeded the save limit, otherwise null. */
export function begrenzeSpeichern(userId: string): Response | null {
  const warten = kontoLimiter().zaehle(`speichern:${userId}`, SPEICHERUNGEN_PRO_KONTO);
  if (warten === null) return null;
  return NextResponse.json(
    { code: "RATE_LIMITED", error: "Zu viele Speichervorgänge. Bitte warten Sie einige Minuten." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(warten) } },
  );
}

type Handler = (ctx: { dienste: KontoDienste; mitglied: Mitglied }) => Promise<Response>;

/**
 * Runs a handler for a signed-in member. Responds 503 without account configuration,
 * 401 without a session, and 403 for foreign origins. Accounts pending deletion only
 * reach handlers that pass `auchVorgemerkt`.
 */
export async function mitMitglied(req: Request, handler: Handler, optionen: { auchVorgemerkt?: boolean; nurAdmin?: boolean } = {}): Promise<Response> {
  const dienste = getKontoDienste();
  if (!dienste) return fehler(503, "KONTEN_INAKTIV", "Konten sind hier nicht aktiviert.");
  if (AENDERND.has(req.method) && !gleicheHerkunft(req, dienste.baseURL)) return fehler(403, "HERKUNFT", "Anfrage von fremder Herkunft.");
  try {
    const mitglied = await leseMitglied(dienste, req.headers);
    if (!mitglied) return fehler(401, "NICHT_ANGEMELDET", "Bitte melden Sie sich an.");
    if (optionen.nurAdmin && mitglied.adminNeuAnmelden) return fehler(403, "NEU_ANMELDEN", "Bitte melden Sie sich für den Verwaltungsbereich erneut an.");
    if (optionen.nurAdmin && !mitglied.admin) return fehler(403, "KEIN_ADMIN", "Kein Zugriff.");
    if (mitglied.loeschungBeantragtAm && !optionen.auchVorgemerkt) return fehler(403, "KONTO_VORGEMERKT", "Ihr Konto ist zur Löschung vorgemerkt.");
    return await handler({ dienste, mitglied });
  } catch (error) {
    if (error instanceof AnfrageFehler) return fehler(error.status, error.status === 413 ? "ZU_GROSS" : "UNGUELTIG", error.message);
    console.error("Konto-Anfrage fehlgeschlagen:", error);
    return fehler(500, "SERVERFEHLER", "Die Anfrage konnte nicht verarbeitet werden.");
  }
}

export async function leseJson(req: Request): Promise<unknown> {
  try { return await leseBegrenztesJson(req, 16 * 1024); }
  catch (error) { if (error instanceof AnfrageFehler && error.status === 413) throw error; return undefined; }
}

const MAX_STAND_BYTES = 4 * 1024 * 1024;

/** Reads and validates `{ stand, revision? }` from a request body, or returns an error response. */
export async function leseStandAusAnfrage(req: Request): Promise<{ stand: BewertungStand; revision: number | null } | Response> {
  try {
    const body = await leseBegrenztesJson(req, MAX_STAND_BYTES) as { stand?: unknown; revision?: unknown };
    // The column is a 32-bit integer; larger values cannot match and would fail the query.
    const revision = Number.isInteger(body.revision) && (body.revision as number) > 0 && (body.revision as number) <= 2_147_483_647 ? body.revision as number : null;
    return { stand: leseBewertungStand(body.stand), revision };
  } catch (error) {
    if (error instanceof AnfrageFehler && error.status === 413) return fehler(413, "ZU_GROSS", "Die Bewertung ist zu groß zum Speichern.");
    return fehler(400, "UNGUELTIG", "Ungültiger Bewertungsstand.");
  }
}

/** Admin forms submit URL-encoded actions, never uploaded files. */
export async function leseFormular(req: Request): Promise<URLSearchParams> {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") {
    throw new AnfrageFehler(400, "Ungültiges Formular.");
  }
  return new URLSearchParams(await leseBegrenztenText(req, 16 * 1024));
}
