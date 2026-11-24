// Member accounts are optional. They turn on only when the database, auth secret,
// and an email transport are configured; otherwise /check works exactly as before.

import { leseBetreiber } from "./inhalte";

export interface KontoEinstellungen {
  datenbankUrl: string;
  secret: string;
  baseURL: string;
  mail: { art: "mailersend"; apiKey: string } | { art: "konsole" };
  absender: { email: string; name: string };
  adminEmails: Set<string>;
}

type Env = Record<string, string | undefined>;
const wert = (env: Env, name: string) => env[name]?.trim() || "";

/** Returns missing or invalid settings. An empty list means accounts are enabled. */
export function fehlendeKontoEinstellungen(env: Env = process.env): string[] {
  const fehlend: string[] = [];
  const produktion = env.NODE_ENV === "production";
  if (!wert(env, "DATABASE_URL")) fehlend.push("DATABASE_URL");
  const secret = wert(env, "BETTER_AUTH_SECRET");
  if (secret.length < 32) fehlend.push("BETTER_AUTH_SECRET (mindestens 32 Zeichen)");
  const baseURL = wert(env, "BETTER_AUTH_URL");
  if (produktion && !baseURL) fehlend.push("BETTER_AUTH_URL");
  if (baseURL) {
    try {
      const url = new URL(baseURL);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/"
        || (produktion && url.protocol !== "https:")) throw new Error("URL");
    } catch { fehlend.push("BETTER_AUTH_URL (gültige öffentliche Origin; in Produktion HTTPS)"); }
  }
  if (produktion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert(env, "MAIL_FROM"))) fehlend.push("MAIL_FROM");
  const konsole = !produktion && wert(env, "KONTO_MAIL_KONSOLE") === "1";
  if (!wert(env, "MAILERSEND_API_KEY") && !konsole) fehlend.push("MAILERSEND_API_KEY");
  return fehlend;
}

export function leseKontoEinstellungen(env: Env = process.env): KontoEinstellungen | null {
  if (fehlendeKontoEinstellungen(env).length > 0) return null;
  const apiKey = wert(env, "MAILERSEND_API_KEY");
  return {
    datenbankUrl: wert(env, "DATABASE_URL"),
    secret: wert(env, "BETTER_AUTH_SECRET"),
    baseURL: (wert(env, "BETTER_AUTH_URL") || "http://localhost:3000").replace(/\/+$/, ""),
    mail: apiKey ? { art: "mailersend", apiKey } : { art: "konsole" },
    absender: { email: wert(env, "MAIL_FROM") || "no-reply@example.org", name: wert(env, "MAIL_FROM_NAME") || leseBetreiber().name },
    adminEmails: new Set(wert(env, "ADMIN_EMAILS").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  };
}

// Read at request time so one image works with or without accounts.
export function getKontoCapabilities() {
  return { konten: leseKontoEinstellungen() !== null };
}
