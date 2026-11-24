import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { anfrage, anmelden, beispielStand, letzterCode, testKonten } from "./konto-fixtures";
import { session, user } from "../src/lib/db/schema";
import { mailerSend } from "../src/lib/mail";
import { leseMitglied } from "../src/lib/konto-dienste";
import { SITZUNG_TAGE } from "../src/lib/auth";

test("email one-time code signs up a new member with a rolling 30-day session", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "Person@Kommune.de");
  assert.match(mails[0].betreff, /^\d{6} ist Ihr Anmeldecode/);
  assert.equal(mails[0].an, "person@kommune.de");

  const sitzung = await dienste.auth.api.getSession({ headers: new Headers({ cookie }) });
  assert.equal(sitzung?.user.email, "person@kommune.de");
  const tage = (sitzung!.session.expiresAt.getTime() - Date.now()) / 86_400_000;
  assert.ok(Math.abs(tage - SITZUNG_TAGE) < 0.01, `session lasts ${tage} days`);

  // Signing in again reuses the same account.
  await anmelden(dienste, mails, "person@kommune.de");
  assert.equal((await dienste.db.select().from(user)).length, 1);
});

test("a wrong or reused code does not sign in", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  await dienste.auth.handler(anfrage("/api/auth/email-otp/send-verification-otp", { body: { email: "a@kommune.de", type: "sign-in" } }));
  const code = letzterCode(mails);
  const falsch = code === "000000" ? "111111" : "000000";
  const fehlversuch = await dienste.auth.handler(anfrage("/api/auth/sign-in/email-otp", { body: { email: "a@kommune.de", otp: falsch } }));
  assert.equal(fehlversuch.status, 400);
  const ok = await dienste.auth.handler(anfrage("/api/auth/sign-in/email-otp", { body: { email: "a@kommune.de", otp: code } }));
  assert.equal(ok.status, 200);
  const erneut = await dienste.auth.handler(anfrage("/api/auth/sign-in/email-otp", { body: { email: "a@kommune.de", otp: code } }));
  assert.equal(erneut.status, 400);
});

test("account deletion needs a fresh code, can be restored for 30 days, then removes all data", async (t) => {
  let jetzt = new Date("2026-11-01T10:00:00Z");
  const { dienste, mails, schliessen } = await testKonten({ jetzt: () => jetzt });
  t.after(schliessen);
  await anmelden(dienste, mails, "weg@kommune.de");
  const [{ id }] = await dienste.db.select().from(user);
  await dienste.bewertungen.erstelle(id, beispielStand());
  await dienste.konten.speichereProfil(id, { kommune: "Testkommune", funktion: "Amtsleitung", fachbereich: "Personal" });

  await dienste.konten.fordereLoeschcodeAn(id, "weg@kommune.de");
  assert.match(mails.at(-1)!.betreff, /bestätigt die Löschung/);
  const code = letzterCode(mails);
  assert.equal(await dienste.konten.bestaetigeLoeschung(id, code === "000000" ? "111111" : "000000"), "falscher-code");
  assert.equal(await dienste.konten.bestaetigeLoeschung(id, code), "geloescht");
  assert.equal((await dienste.db.select().from(session).where(eq(session.userId, id))).length, 0, "all sessions end");
  assert.deepEqual(await dienste.konten.status(id), { loeschungBeantragtAm: jetzt, endgueltigAm: new Date("2026-12-01T10:00:00Z") });
  assert.equal(await dienste.konten.bestaetigeLoeschung(id, code), "kein-code", "codes are single use");

  // Restoring keeps everything.
  await dienste.konten.stelleWiederHer(id);
  assert.equal((await dienste.konten.status(id)).loeschungBeantragtAm, null);
  await dienste.konten.beantrageLoeschung(id);

  jetzt = new Date("2026-11-30T10:00:00Z");
  assert.equal(await dienste.konten.bereinige(), 0, "kept during the restore window");
  assert.equal((await dienste.bewertungen.liste(id)).length, 1);

  jetzt = new Date("2026-12-01T10:00:01Z");
  assert.equal(await dienste.konten.bereinige(), 1);
  assert.equal((await dienste.db.select().from(user)).length, 0);
  assert.equal((await dienste.bewertungen.liste(id)).length, 0, "assessments cascade");
  assert.deepEqual(await dienste.konten.profil(id), { kommune: "", funktion: "", fachbereich: "" });
});

test("five wrong deletion codes invalidate the code", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  await anmelden(dienste, mails, "x@kommune.de");
  const [{ id }] = await dienste.db.select().from(user);
  await dienste.konten.fordereLoeschcodeAn(id, "x@kommune.de");
  const code = letzterCode(mails);
  const falsch = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) assert.equal(await dienste.konten.bestaetigeLoeschung(id, falsch), "falscher-code");
  assert.equal(await dienste.konten.bestaetigeLoeschung(id, falsch), "kein-code");
  assert.equal(await dienste.konten.bestaetigeLoeschung(id, code), "kein-code");
  assert.equal((await dienste.konten.status(id)).loeschungBeantragtAm, null);
});

test("MailerSend transport posts the documented email payload", async () => {
  const anfragen: { url: string; init: RequestInit }[] = [];
  const versand = mailerSend({
    apiKey: "mlsn.test",
    absender: { email: "no-reply@example.org", name: "Beispiel-Kompass" },
    fetch: (async (url: string, init: RequestInit) => { anfragen.push({ url, init }); return new Response(null, { status: 202 }); }) as typeof fetch,
  });
  await versand.sende({ an: "a@kommune.de", betreff: "Betreff", text: "Text", html: "<p>Text</p>" });
  assert.equal(anfragen[0].url, "https://api.mailersend.com/v1/email");
  assert.equal(new Headers(anfragen[0].init.headers).get("authorization"), "Bearer mlsn.test");
  assert.deepEqual(JSON.parse(String(anfragen[0].init.body)), {
    from: { email: "no-reply@example.org", name: "Beispiel-Kompass" },
    to: [{ email: "a@kommune.de" }],
    subject: "Betreff",
    text: "Text",
    html: "<p>Text</p>",
  });

  const fehlerhaft = mailerSend({ apiKey: "x", absender: { email: "a@b.de", name: "n" }, fetch: (async () => new Response("{}", { status: 422 })) as unknown as typeof fetch });
  await assert.rejects(fehlerhaft.sende({ an: "a@kommune.de", betreff: "b", text: "t", html: "h" }), /HTTP 422/);
});

test("a sixth code request is refused without replacing the code already sent", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const senden = (email: string) => dienste.auth.handler(anfrage("/api/auth/email-otp/send-verification-otp", { body: { email, type: "sign-in" } }));
  for (let i = 0; i < 5; i++) assert.equal((await senden("viel@kommune.de")).status, 200);
  const code = letzterCode(mails);
  assert.equal((await senden("viel@kommune.de")).status, 429);
  assert.equal((await senden("VIEL@kommune.de ")).status, 429, "addresses are compared case-insensitively");
  assert.equal(mails.length, 5);
  const anmeldung = await dienste.auth.handler(anfrage("/api/auth/sign-in/email-otp", { body: { email: "viel@kommune.de", otp: code } }));
  assert.equal(anmeldung.status, 200, "the last code that was sent still works");
  assert.equal((await senden("andere@kommune.de")).status, 200, "other addresses are unaffected");
});

test("other code types neither send mail nor use up an address's sign-in codes", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  await anmelden(dienste, mails, "ziel@kommune.de");
  const senden = (type: string) => dienste.auth.handler(anfrage("/api/auth/email-otp/send-verification-otp", { body: { email: "ziel@kommune.de", type } }));
  for (let i = 0; i < 10; i++) assert.equal((await senden("email-verification")).status, 200);
  assert.equal(mails.length, 1, "only the first sign-in sent mail");
  // The sign-in above used one of the five codes per 10 minutes.
  for (let i = 0; i < 4; i++) assert.equal((await senden("sign-in")).status, 200, "the address still gets its own codes");
  assert.equal(mails.length, 5);
});

test("an address receives at most 20 sign-in codes per day", async (t) => {
  let jetzt = new Date("2026-11-07T08:00:00Z");
  const { dienste, mails, schliessen } = await testKonten({ jetzt: () => jetzt });
  t.after(schliessen);
  const senden = () => dienste.auth.handler(anfrage("/api/auth/email-otp/send-verification-otp", { body: { email: "ziel@kommune.de", type: "sign-in" } }));
  // Five codes per 10 minutes, and each code allows five attempts: 100 guesses per day.
  for (let fenster = 0; fenster < 4; fenster++) {
    for (let i = 0; i < 5; i++) assert.equal((await senden()).status, 200);
    jetzt = new Date(jetzt.getTime() + 10 * 60_000);
  }
  const begrenzt = await senden();
  assert.equal(begrenzt.status, 429);
  assert.equal((await begrenzt.json()).code, "CODES_PRO_TAG");
  assert.equal(mails.length, 20);
  jetzt = new Date("2026-11-08T08:00:01Z");
  assert.equal((await senden()).status, 200, "the next day the address gets codes again");
});

test("server-side session lookups leave renewal to the browser's session check", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "aktiv@kommune.de");
  // Pretend the session is 29 days old, so it is due for renewal.
  const bald = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await dienste.db.update(session).set({ expiresAt: bald });
  const mitglied = await leseMitglied(dienste, new Headers({ cookie }));
  assert.equal(mitglied?.email, "aktiv@kommune.de");
  assert.equal((await dienste.db.select().from(session))[0].expiresAt.getTime(), bald.getTime(), "no renewal without a cookie update");

  const res = await dienste.auth.handler(anfrage("/api/auth/get-session", { cookie }));
  assert.equal(res.status, 200);
  assert.match(res.headers.getSetCookie().join(";"), /session_token=.*Max-Age=2592000/i, "the browser receives a renewed 30-day cookie");
  const tage = ((await dienste.db.select().from(session))[0].expiresAt.getTime() - Date.now()) / 86_400_000;
  assert.ok(tage > 29.9, `session renewed to ${tage} days`);
});

test("final removal skips accounts restored after they were selected", async (t) => {
  let jetzt = new Date("2026-11-01T10:00:00Z");
  const { dienste, mails, schliessen } = await testKonten({ jetzt: () => jetzt });
  t.after(schliessen);
  await anmelden(dienste, mails, "zurueck@kommune.de");
  const [{ id }] = await dienste.db.select().from(user);
  await dienste.bewertungen.erstelle(id, beispielStand());
  assert.equal(await dienste.konten.stelleWiederHer(id), false, "nothing to restore");
  assert.equal(await dienste.konten.loescheEndgueltig(id), false, "unmarked accounts are never removed");

  await dienste.konten.beantrageLoeschung(id);
  jetzt = new Date("2026-12-05T10:00:00Z");
  // A restore that lands between selecting candidates and deleting them wins.
  assert.equal(await dienste.konten.stelleWiederHer(id), true);
  assert.equal(await dienste.konten.loescheEndgueltig(id), false);
  assert.equal(await dienste.konten.bereinige(), 0);
  assert.equal((await dienste.bewertungen.liste(id)).length, 1);
});

test("untrusted forwarding headers cannot evade the real auth request limiter", async (t) => {
  const old = process.env.TRUSTED_PROXY_IP_HEADER;
  delete process.env.TRUSTED_PROXY_IP_HEADER;
  const { dienste, mails, schliessen } = await testKonten({ rateLimit: true });
  t.after(async () => { await schliessen(); if (old === undefined) delete process.env.TRUSTED_PROXY_IP_HEADER; else process.env.TRUSTED_PROXY_IP_HEADER = old; });
  for (let i = 0; i < 30; i++) {
    const req = anfrage("/api/auth/email-otp/send-verification-otp", { body: { email: `person${i}@example.org`, type: "sign-in" } });
    req.headers.set("x-forwarded-for", `192.0.2.${i + 1}`);
    assert.equal((await dienste.auth.handler(req)).status, 200);
  }
  const req = anfrage("/api/auth/email-otp/send-verification-otp", { body: { email: "person31@example.org", type: "sign-in" } });
  req.headers.set("x-forwarded-for", "198.51.100.1"); req.headers.set("x-real-ip", "203.0.113.1");
  assert.equal((await dienste.auth.handler(req)).status, 429);
  assert.equal(mails.length, 30, "all mail is captured locally");
});
