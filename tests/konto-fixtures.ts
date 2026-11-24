import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "../src/lib/db/schema";
import { erstelleKontoDienste, setzeKontoDiensteFuerTests, type KontoDienste } from "../src/lib/konto-dienste";
import { neuerBewertungStand, type BewertungStand } from "../src/lib/bewertung";
import type { Mail } from "../src/lib/mail";

export const BASIS = "http://localhost:3000";

/** Account services on an in-process Postgres (PGlite) with captured emails. */
export async function testKonten(optionen: { admins?: string[]; jetzt?: () => Date; rateLimit?: boolean } = {}) {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const mails: Mail[] = [];
  const dienste = erstelleKontoDienste({
    db,
    einstellungen: { secret: "test-secret-".padEnd(40, "x"), baseURL: BASIS, adminEmails: new Set(optionen.admins ?? []) },
    mail: { async sende(mail) { mails.push(mail); } },
    jetzt: optionen.jetzt,
    rateLimit: optionen.rateLimit ?? false,
  });
  setzeKontoDiensteFuerTests(dienste);
  return {
    dienste,
    mails,
    async schliessen() {
      setzeKontoDiensteFuerTests(undefined);
      await client.close();
    },
  };
}

export function anfrage(pfad: string, optionen: { methode?: string; cookie?: string; body?: unknown; origin?: string | null; form?: Record<string, string> } = {}) {
  const headers = new Headers();
  if (optionen.cookie) headers.set("cookie", optionen.cookie);
  if (optionen.origin !== null) headers.set("origin", optionen.origin ?? BASIS);
  let body: BodyInit | undefined;
  if (optionen.form) body = new URLSearchParams(optionen.form);
  else if (optionen.body !== undefined) { headers.set("content-type", "application/json"); body = JSON.stringify(optionen.body); }
  return new Request(`${BASIS}${pfad}`, { method: optionen.methode ?? (body ? "POST" : "GET"), headers, body });
}

export function letzterCode(mails: Mail[]): string {
  const code = mails.at(-1)?.text.match(/\b\d{6}\b/)?.[0];
  assert.ok(code, "expected an email with a six-digit code");
  return code;
}

/** Signs in through the real Better Auth endpoints and returns the session cookie. */
export async function anmelden(dienste: KontoDienste, mails: Mail[], email: string): Promise<string> {
  const senden = await dienste.auth.handler(anfrage("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } }));
  assert.equal(senden.status, 200, await senden.clone().text());
  const res = await dienste.auth.handler(anfrage("/api/auth/sign-in/email-otp", { body: { email, otp: letzterCode(mails) } }));
  assert.equal(res.status, 200, await res.clone().text());
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.match(cookie, /session_token=/);
  return cookie;
}

export function beispielStand(ueberschreiben: Partial<BewertungStand> = {}): BewertungStand {
  return {
    ...neuerBewertungStand({ orgName: "Testkommune", funktion: "Amtsleitung", positionFachbereich: "Personal", ebene: "gesamtverwaltung" }),
    phase: "ergebnis",
    antworten: { f1: 4, f2: 2, f7: 1 },
    ...ueberschreiben,
  };
}

export const params = (id: string) => ({ params: Promise.resolve({ id }) });
