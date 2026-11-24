import { leseKontoEinstellungen, type KontoEinstellungen } from "./konto-config";
import { verbindeDatenbank, type Datenbank } from "./db";
import { erstelleAuth, type Auth } from "./auth";
import { erstelleKontoVerwaltung, type KontoVerwaltung } from "./konten";
import { erstelleBewertungen, type Bewertungen } from "./bewertungen";
import { erstelleAdmin, type Admin } from "./admin";
import { konsolenMail, mailerSend, type MailVersand } from "./mail";

/** Admin rights need a sign-in at most this old; member sessions last 30 days. */
export const ADMIN_SITZUNG_STUNDEN = 24;

export interface KontoDienste {
  baseURL: string;
  adminEmails: Set<string>;
  jetzt: () => Date;
  db: Datenbank;
  auth: Auth;
  konten: KontoVerwaltung;
  bewertungen: Bewertungen;
  admin: Admin;
}

export interface Mitglied {
  id: string;
  email: string;
  /** Listed in ADMIN_EMAILS and signed in within ADMIN_SITZUNG_STUNDEN. */
  admin: boolean;
  /** Listed in ADMIN_EMAILS, but the sign-in is older; admin pages ask to sign in again. */
  adminNeuAnmelden: boolean;
  loeschungBeantragtAm: Date | null;
  endgueltigAm: Date | null;
}

export function erstelleKontoDienste(options: {
  db: Datenbank;
  einstellungen: Pick<KontoEinstellungen, "secret" | "baseURL" | "adminEmails">;
  mail: MailVersand;
  jetzt?: () => Date;
  rateLimit?: boolean;
}): KontoDienste {
  const { db, einstellungen, mail, jetzt } = options;
  return {
    baseURL: einstellungen.baseURL,
    adminEmails: einstellungen.adminEmails,
    jetzt: jetzt ?? (() => new Date()),
    db,
    auth: erstelleAuth({ db, secret: einstellungen.secret, baseURL: einstellungen.baseURL, mail, rateLimit: options.rateLimit, jetzt }),
    konten: erstelleKontoVerwaltung({ db, mail, secret: einstellungen.secret, baseURL: einstellungen.baseURL, jetzt }),
    bewertungen: erstelleBewertungen({ db, jetzt }),
    admin: erstelleAdmin({ db, jetzt }),
  };
}

// Kept on globalThis so route bundles and development reloads share one connection pool.
const speicher = globalThis as typeof globalThis & {
  __kompassKonto?: { schluessel: string; dienste: KontoDienste };
  __kompassKontoTest?: KontoDienste | null;
};

/** Returns null when member accounts are not configured. */
export function getKontoDienste(): KontoDienste | null {
  if (speicher.__kompassKontoTest !== undefined) return speicher.__kompassKontoTest;
  const e = leseKontoEinstellungen();
  if (!e) return null;
  const schluessel = JSON.stringify([e.datenbankUrl, e.secret, e.baseURL, e.mail, e.absender, [...e.adminEmails]]);
  if (speicher.__kompassKonto?.schluessel === schluessel) return speicher.__kompassKonto.dienste;
  const mail = e.mail.art === "mailersend" ? mailerSend({ apiKey: e.mail.apiKey, absender: e.absender }) : konsolenMail();
  const dienste = erstelleKontoDienste({ db: verbindeDatenbank(e.datenbankUrl), einstellungen: e, mail });
  speicher.__kompassKonto = { schluessel, dienste };
  return dienste;
}

/** Tests replace the environment-based services. Pass undefined to restore them. */
export function setzeKontoDiensteFuerTests(dienste: KontoDienste | null | undefined) {
  speicher.__kompassKontoTest = dienste;
}

export async function leseMitglied(dienste: KontoDienste, headers: Headers): Promise<Mitglied | null> {
  // Server-side lookups cannot update the cookie, so they must not extend the session
  // either; the browser's /api/auth/get-session call does both.
  const sitzung = await dienste.auth.api.getSession({ headers, query: { disableRefresh: true } });
  if (!sitzung) return null;
  const status = await dienste.konten.status(sitzung.user.id);
  const adresseIstAdmin = dienste.adminEmails.has(sitzung.user.email.toLowerCase());
  // Measured from the sign-in, which daily session renewal does not move.
  const frisch = dienste.jetzt().getTime() - new Date(sitzung.session.createdAt).getTime() < ADMIN_SITZUNG_STUNDEN * 60 * 60 * 1000;
  return {
    id: sitzung.user.id,
    email: sitzung.user.email,
    admin: adresseIstAdmin && frisch,
    adminNeuAnmelden: adresseIstAdmin && !frisch,
    ...status,
  };
}
