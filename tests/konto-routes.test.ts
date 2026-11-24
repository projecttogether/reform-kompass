import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { anfrage, anmelden, beispielStand, letzterCode, params, testKonten } from "./konto-fixtures";
import * as bewertungenRoute from "../src/app/api/bewertungen/route";
import * as bewertungRoute from "../src/app/api/bewertungen/[id]/route";
import * as kontoRoute from "../src/app/api/konto/route";
import * as loeschcodeRoute from "../src/app/api/konto/loeschcode/route";
import * as loeschenRoute from "../src/app/api/konto/loeschen/route";
import * as wiederherstellenRoute from "../src/app/api/konto/wiederherstellen/route";
import * as adminKontoRoute from "../src/app/api/admin/konten/[id]/route";
import * as adminBewertungRoute from "../src/app/api/admin/bewertungen/[id]/route";
import * as authRoute from "../src/app/api/auth/[...all]/route";
import { POST as erklaerung } from "../src/app/api/erklaerung/route";
import { leseMitglied, setzeKontoDiensteFuerTests } from "../src/lib/konto-dienste";
import { KI_LIMITS, kiLimiter } from "../src/lib/ki-limit";
import { SPEICHERUNGEN_PRO_KONTO } from "../src/lib/konto-http";
import { MAX_BEWERTUNGEN_PRO_KONTO, MAX_SPEICHER_PRO_KONTO } from "../src/lib/bewertungen";
import { leseBewertungStand, uebersicht } from "../src/lib/bewertung";
import { bewertung, session } from "../src/lib/db/schema";
import { katalog, setzeEnv } from "./fixtures";

const json = async (res: Response) => ({ status: res.status, body: await res.json() });

test("without account configuration the account routes are unavailable and nothing else changes", async () => {
  setzeKontoDiensteFuerTests(null);
  try {
    assert.equal((await bewertungenRoute.GET(anfrage("/api/bewertungen"))).status, 503);
    assert.equal((await authRoute.GET(anfrage("/api/auth/get-session"))).status, 404);
  } finally {
    setzeKontoDiensteFuerTests(undefined);
  }
});

test("members can only see and change their own assessments", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const anna = await anmelden(dienste, mails, "anna@kommune.de");
  const ben = await anmelden(dienste, mails, "ben@kommune.de");

  assert.equal((await bewertungenRoute.GET(anfrage("/api/bewertungen"))).status, 401);
  const erstellt = await json(await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie: anna, body: { stand: beispielStand() } })));
  assert.equal(erstellt.status, 201);
  const id = erstellt.body.id as string;
  assert.equal(erstellt.body.revision, 1);

  const liste = await json(await bewertungenRoute.GET(anfrage("/api/bewertungen", { cookie: anna })));
  assert.equal(liste.body.bewertungen.length, 1);
  assert.equal(liste.body.bewertungen[0].uebersicht.kommune, "Testkommune");
  assert.equal((await json(await bewertungenRoute.GET(anfrage("/api/bewertungen", { cookie: ben })))).body.bewertungen.length, 0);

  assert.equal((await bewertungRoute.GET(anfrage(`/api/bewertungen/${id}`, { cookie: ben }), params(id))).status, 404);
  assert.equal((await bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: ben, body: { stand: beispielStand(), revision: 1 } }), params(id))).status, 404);
  assert.equal((await bewertungRoute.DELETE(anfrage(`/api/bewertungen/${id}`, { methode: "DELETE", cookie: ben }), params(id))).status, 404);

  const geaendert = beispielStand({ phase: "chat", nachrichten: [{ role: "user", content: "Hallo" }] });
  assert.equal((await bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: anna, body: { stand: geaendert } }), params(id))).status, 400, "saves must name a revision");
  const gespeichert = await json(await bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: anna, body: { stand: geaendert, revision: 1 } }), params(id)));
  assert.deepEqual(gespeichert, { status: 200, body: { gespeichert: true, revision: 2 } });

  // A second tab still on revision 1 must not overwrite the newer save.
  const veraltet = await json(await bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: anna, body: { stand: beispielStand(), revision: 1 } }), params(id)));
  assert.equal(veraltet.status, 409);
  assert.equal(veraltet.body.code, "KONFLIKT");
  const ausserhalb = await bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: anna, body: { stand: geaendert, revision: 2 ** 31 } }), params(id));
  assert.equal(ausserhalb.status, 400, "revisions outside the 32-bit column are rejected, not a 500");

  const geladen = await json(await bewertungRoute.GET(anfrage(`/api/bewertungen/${id}`, { cookie: anna }), params(id)));
  assert.equal(geladen.body.revision, 2);
  assert.equal(geladen.body.stand.phase, "chat");
  assert.equal(geladen.body.stand.nachrichten[0].content, "Hallo");

  assert.equal((await bewertungRoute.DELETE(anfrage(`/api/bewertungen/${id}`, { methode: "DELETE", cookie: anna }), params(id))).status, 200);
  assert.equal((await bewertungRoute.GET(anfrage(`/api/bewertungen/${id}`, { cookie: anna }), params(id))).status, 404);
});

const nutzerId = async (dienste: Awaited<ReturnType<typeof testKonten>>["dienste"], cookie: string) =>
  (await dienste.auth.api.getSession({ headers: new Headers({ cookie }) }))!.user.id;

test("lists show the same overview without reading conversations or catalogues", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "anna@kommune.de");
  const annaId = await nutzerId(dienste, cookie);
  const stand = beispielStand({ phase: "chat", nachrichten: [{ role: "user", content: "Hallo" }, { role: "assistant", content: "Guten Tag" }], katalog: katalog() });
  const { body } = await json(await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand } })));

  const erwartet = uebersicht(leseBewertungStand(stand));
  assert.equal(erwartet.nachrichten, 2);
  assert.equal(erwartet.massnahmen, 1);
  assert.deepEqual((await json(await bewertungenRoute.GET(anfrage("/api/bewertungen", { cookie })))).body.bewertungen[0].uebersicht, erwartet);
  assert.deepEqual((await dienste.admin.konto(annaId))!.bewertungen[0].uebersicht, erwartet);

  // Answers that no longer fit the questionnaire still show as unreadable.
  await dienste.db.update(bewertung).set({ stand: sql`jsonb_set(${bewertung.stand}, '{antworten}', '{"f1": 9}')` }).where(eq(bewertung.id, body.id));
  assert.equal((await dienste.bewertungen.liste(annaId))[0].uebersicht, null);
  assert.equal((await dienste.admin.konto(annaId))!.bewertungen[0].uebersicht, null);
});

test("an account's saved assessments stay within their storage budget", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "anna@kommune.de");
  const annaId = await nutzerId(dienste, cookie);
  // Random text does not compress, so each state takes about 3.6 MiB on disk.
  const gross = () => beispielStand({ nachrichten: Array.from({ length: 200 }, () => ({ role: "user" as const, content: randomBytes(14_000).toString("base64") })) });
  const erstelle = (stand: ReturnType<typeof beispielStand>) => bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand } }));
  const klein = (await json(await erstelle(beispielStand()))).body as { id: string; revision: number };

  const angenommen: string[] = [];
  for (;;) {
    const res = await json(await erstelle(gross()));
    if (res.status !== 201) {
      assert.deepEqual([res.status, res.body.code], [413, "SPEICHER_VOLL"]);
      break;
    }
    angenommen.push(res.body.id);
    assert.ok(angenommen.length < 10, "the budget must refuse eventually");
  }
  const belegt = async () => Number((await dienste.db.select({ n: sql<string>`sum(pg_column_size(${bewertung.stand}))` }).from(bewertung).where(eq(bewertung.userId, annaId)))[0].n);
  assert.ok(angenommen.length >= 3, `${angenommen.length} large states fit`);
  assert.ok(await belegt() <= MAX_SPEICHER_PRO_KONTO);

  // Growing a small assessment past the budget is refused too, and deleting frees space.
  const aendere = () => bewertungRoute.PUT(anfrage(`/api/bewertungen/${klein.id}`, { methode: "PUT", cookie, body: { stand: gross(), revision: 1 } }), params(klein.id));
  const voll = await json(await aendere());
  assert.deepEqual([voll.status, voll.body.code], [413, "SPEICHER_VOLL"]);
  assert.equal((await bewertungRoute.DELETE(anfrage(`/api/bewertungen/${angenommen[0]}`, { methode: "DELETE", cookie }), params(angenommen[0]))).status, 200);
  assert.equal((await aendere()).status, 200);
  assert.ok(await belegt() <= MAX_SPEICHER_PRO_KONTO);
});

test("parallel saves cannot exceed the number of assessments per account", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "anna@kommune.de");
  const annaId = await nutzerId(dienste, cookie);
  for (let i = 1; i < MAX_BEWERTUNGEN_PRO_KONTO; i++) await dienste.bewertungen.erstelle(annaId, beispielStand());
  // All counts would run before any insert if creation did not lock the account.
  const ergebnisse = await Promise.all(Array.from({ length: 5 }, () => dienste.bewertungen.erstelle(annaId, beispielStand())));
  assert.deepEqual(ergebnisse.map((e) => (typeof e === "string" ? e : "erstellt")), ["erstellt", "zu-viele", "zu-viele", "zu-viele", "zu-viele"]);
  assert.equal((await dienste.bewertungen.liste(annaId)).length, MAX_BEWERTUNGEN_PRO_KONTO);
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand: beispielStand() } }))).status, 409);
});

test("saves are limited per account", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const anna = await anmelden(dienste, mails, "anna@kommune.de");
  const ben = await anmelden(dienste, mails, "ben@kommune.de");
  const erstellt = (await json(await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie: anna, body: { stand: beispielStand() } })))).body as { id: string; revision: number };
  const id = erstellt.id;
  let revision = erstellt.revision;
  const speichere = () => bewertungRoute.PUT(anfrage(`/api/bewertungen/${id}`, { methode: "PUT", cookie: anna, body: { stand: beispielStand({ aktuelleFrage: revision % 2 }), revision } }), params(id));
  // The creation above counted as the first save.
  for (let i = 1; i < SPEICHERUNGEN_PRO_KONTO.max; i++) {
    const res = await json(await speichere());
    assert.equal(res.status, 200);
    revision = res.body.revision;
  }
  const begrenzt = await speichere();
  assert.equal(begrenzt.status, 429);
  assert.equal((await begrenzt.json()).code, "RATE_LIMITED");
  assert.ok(Number(begrenzt.headers.get("retry-after")) > 0);
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie: anna, body: { stand: beispielStand() } }))).status, 429);
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie: ben, body: { stand: beispielStand() } }))).status, 201, "other accounts are unaffected");
});

test("admin rights need a sign-in from the last 24 hours", async (t) => {
  const { dienste, mails, schliessen } = await testKonten({ admins: ["chefin@example.org"] });
  t.after(schliessen);
  const anna = await anmelden(dienste, mails, "anna@kommune.de");
  const annaId = await nutzerId(dienste, anna);
  let admin = await anmelden(dienste, mails, "chefin@example.org");
  const adminId = await nutzerId(dienste, admin);
  const aktion = () => adminKontoRoute.POST(anfrage(`/api/admin/konten/${annaId}`, { cookie: admin, form: { aktion: "abmelden" } }), params(annaId));
  assert.equal((await aktion()).status, 303);

  // Daily session renewal moves the expiry, never the sign-in time.
  await dienste.db.update(session).set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }).where(eq(session.userId, adminId));
  const alt = await json(await aktion());
  assert.deepEqual([alt.status, alt.body.code], [403, "NEU_ANMELDEN"]);
  const mitglied = await leseMitglied(dienste, new Headers({ cookie: admin }));
  assert.deepEqual([mitglied?.admin, mitglied?.adminNeuAnmelden], [false, true]);
  assert.equal((await json(await kontoRoute.GET(anfrage("/api/konto", { cookie: admin })))).body.admin, false);

  admin = await anmelden(dienste, mails, "chefin@example.org");
  assert.equal((await aktion()).status, 303, "a new sign-in restores admin rights");
  // The admin action above signed Anna out.
  const normal = await leseMitglied(dienste, new Headers({ cookie: await anmelden(dienste, mails, "anna@kommune.de") }));
  assert.deepEqual([normal?.admin, normal?.adminNeuAnmelden], [false, false]);
});

test("invalid state, foreign origins, and missing origins are rejected", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  const cookie = await anmelden(dienste, mails, "anna@kommune.de");
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand: beispielStand({ antworten: { f1: 9 } }) } }))).status, 400);
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand: beispielStand() }, origin: "https://boese.example" }))).status, 403);
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand: beispielStand() }, origin: null }))).status, 403);
  const riesig = beispielStand({ nachrichten: Array.from({ length: 230 }, () => ({ role: "user" as const, content: "x".repeat(19_000) })) });
  assert.equal((await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie, body: { stand: riesig } }))).status, 413);
});

test("profile, deletion, and restore through the account routes", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  t.after(schliessen);
  let cookie = await anmelden(dienste, mails, "anna@kommune.de");
  const profil = { kommune: "Testkommune", funktion: "Amtsleitung", fachbereich: "Personal" };
  assert.equal((await kontoRoute.PUT(anfrage("/api/konto", { methode: "PUT", cookie, body: { profil } }))).status, 200);
  const konto = await json(await kontoRoute.GET(anfrage("/api/konto", { cookie })));
  assert.deepEqual(konto.body.profil, profil);
  assert.equal(konto.body.admin, false);

  assert.equal((await loeschcodeRoute.POST(anfrage("/api/konto/loeschcode", { cookie, body: {} }))).status, 200);
  assert.equal((await loeschenRoute.POST(anfrage("/api/konto/loeschen", { cookie, body: { code: "12" } }))).status, 400);
  const geloescht = await json(await loeschenRoute.POST(anfrage("/api/konto/loeschen", { cookie, body: { code: letzterCode(mails) } })));
  assert.equal(geloescht.status, 200);
  assert.equal((await kontoRoute.GET(anfrage("/api/konto", { cookie }))).status, 401, "the old session ended");

  cookie = await anmelden(dienste, mails, "anna@kommune.de");
  const vorgemerkt = await json(await kontoRoute.GET(anfrage("/api/konto", { cookie })));
  assert.ok(vorgemerkt.body.loeschungBeantragtAm);
  assert.equal((await bewertungenRoute.GET(anfrage("/api/bewertungen", { cookie }))).status, 403, "pending deletion blocks assessments");
  assert.equal((await wiederherstellenRoute.POST(anfrage("/api/konto/wiederherstellen", { cookie, body: {} }))).status, 200);
  assert.equal((await bewertungenRoute.GET(anfrage("/api/bewertungen", { cookie }))).status, 200);
  assert.deepEqual((await json(await kontoRoute.GET(anfrage("/api/konto", { cookie })))).body.profil, profil, "restoring keeps the profile");
});

test("admin actions require an admin address and act on any account", async (t) => {
  const { dienste, mails, schliessen } = await testKonten({ admins: ["chefin@example.org"] });
  t.after(schliessen);
  const anna = await anmelden(dienste, mails, "anna@kommune.de");
  const admin = await anmelden(dienste, mails, "Chefin@Example.org");
  const { body } = await json(await bewertungenRoute.POST(anfrage("/api/bewertungen", { cookie: anna, body: { stand: beispielStand() } })));
  const annaId = (await dienste.auth.api.getSession({ headers: new Headers({ cookie: anna }) }))!.user.id;

  const aktion = (cookie: string, wert: string) => adminKontoRoute.POST(anfrage(`/api/admin/konten/${annaId}`, { cookie, form: { aktion: wert } }), params(annaId));
  assert.equal((await aktion(anna, "loeschen")).status, 403);
  assert.equal((await json(await kontoRoute.GET(anfrage("/api/konto", { cookie: admin })))).body.admin, true);

  const konten = await dienste.admin.konten({ suche: "anna" });
  assert.equal(konten.gesamt, 1);
  assert.equal(konten.zeilen[0].bewertungen, 1);

  assert.equal((await adminBewertungRoute.POST(anfrage(`/api/admin/bewertungen/${body.id}`, { cookie: anna, form: { aktion: "loeschen" } }), params(body.id))).status, 403);
  const geloescht = await adminBewertungRoute.POST(anfrage(`/api/admin/bewertungen/${body.id}`, { cookie: admin, form: { aktion: "loeschen" } }), params(body.id));
  assert.equal(geloescht.status, 303);
  assert.equal(geloescht.headers.get("location"), `http://localhost:3000/admin/konten/${annaId}`);
  assert.equal((await dienste.bewertungen.liste(annaId)).length, 0);

  assert.equal((await aktion(admin, "endgueltig-loeschen")).status, 409, "only accounts pending deletion can be removed");
  assert.equal((await aktion(admin, "loeschen")).status, 303);
  assert.equal((await kontoRoute.GET(anfrage("/api/konto", { cookie: anna }))).status, 401);
  assert.ok((await dienste.admin.konto(annaId))?.loeschungBeantragtAm);
  assert.equal((await aktion(admin, "wiederherstellen")).status, 303);
  assert.equal((await dienste.admin.konto(annaId))?.loeschungBeantragtAm, null);
  await aktion(admin, "loeschen");
  const endgueltig = await aktion(admin, "endgueltig-loeschen");
  assert.equal(endgueltig.headers.get("location"), "http://localhost:3000/admin");
  assert.equal(await dienste.admin.konto(annaId), null);
  assert.deepEqual(await dienste.admin.kennzahlen(), { konten: 1, zurLoeschungVorgemerkt: 0, bewertungen: 0, aktivLetzte7Tage: 1 });
});

test("AI requests are limited per IP without login and per account with login", async (t) => {
  const { dienste, mails, schliessen } = await testKonten();
  setzeEnv(t, { TRUSTED_PROXY_IP_HEADER: "x-forwarded-for", AI_PROVIDER: undefined, ANTHROPIC_API_KEY: "test-key", AI_MODEL: "test-model" });
  kiLimiter().zuruecksetzen();
  t.after(async () => {
    kiLimiter().zuruecksetzen();
    await schliessen();
  });
  // A category without answers is answered locally, so these requests never reach a provider.
  const ohneProvider = (headers: Record<string, string>) => erklaerung(new NextRequest("http://localhost:3000/api/erklaerung", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ orgName: "X", kategorie: "personal", antworten: {} }),
  }));
  for (let i = 0; i < KI_LIMITS.anonym.max; i++) assert.equal((await ohneProvider({ "x-forwarded-for": "203.0.113.7" })).status, 200);
  const begrenzt = await ohneProvider({ "x-forwarded-for": "203.0.113.7" });
  assert.equal(begrenzt.status, 429);
  assert.ok(Number(begrenzt.headers.get("retry-after")) > 0);
  assert.equal((await ohneProvider({ "x-forwarded-for": "198.51.100.1" })).status, 200, "other addresses are unaffected");

  const cookie = await anmelden(dienste, mails, "anna@kommune.de");
  assert.equal((await ohneProvider({ "x-forwarded-for": "203.0.113.7", cookie })).status, 200, "members are counted by account");
});

test("sign-in redirects only to paths on this site", async () => {
  const { sicheresZiel } = await import("../src/lib/konto-browser");
  assert.equal(sicheresZiel("/check?speichern=1"), "/check?speichern=1");
  assert.equal(sicheresZiel("/konto/vergleich?a=1&b=2"), "/konto/vergleich?a=1&b=2");
  for (const boese of ["//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/.//evil.example", "/..//evil.example", "/%2e//evil.example", "/./\\evil.example", "https://evil.example", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(sicheresZiel(boese), "/konto", String(boese));
  }
});

test("auth adapter rejects malformed and oversized bodies before sending any mail", async (t) => {
  const { mails, schliessen } = await testKonten(); t.after(schliessen);
  const req = (body: string) => new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body });
  assert.equal((await authRoute.POST(req("{"))).status, 400);
  assert.equal((await authRoute.POST(req(" ".repeat(16 * 1024 + 1)))).status, 413);
  assert.equal(mails.length, 0);
});
