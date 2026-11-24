import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { AnfrageFehler, leseBegrenztesJson } from "../src/lib/anfrage";
import { gleicheHerkunft } from "../src/lib/konto-http";
import { clientIp, proxyIpHeaders } from "../src/lib/proxy";
import { erstelleLimiter } from "../src/lib/limiter";
import { kiLimiter, pruefeKiLimit, reserviereKiAnfrage, KI_LIMITS } from "../src/lib/ki-limit";
import { setzeKontoDiensteFuerTests } from "../src/lib/konto-dienste";
import { anmeldecodeMail, loeschcodeMail } from "../src/lib/mail";
import { fehlendeKontoEinstellungen } from "../src/lib/konto-config";
import { MAX_KI_ANFRAGE_BYTES } from "../src/lib/beratung-anfrage";
import { waehleKiVerlauf } from "../src/lib/ki-verlauf";
import { POST as chat } from "../src/app/api/chat/route";
import { POST as katalog } from "../src/app/api/katalog/route";
import { POST as erklaerung } from "../src/app/api/erklaerung/route";
import { setzeEnv } from "./fixtures";

test("body limits count streamed UTF-8 bytes, cancel early, and reject malformed input", async () => {
  const text = JSON.stringify({ text: "ä" });
  const bytes = new TextEncoder().encode(text);
  assert.deepEqual(await leseBegrenztesJson(new Request("http://localhost", { method: "POST", body: text }), bytes.length), { text: "ä" });
  let cancelled = false;
  let reads = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const req = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(leseBegrenztesJson(req, 10), (e: unknown) => e instanceof AnfrageFehler && e.status === 413);
  assert.equal(cancelled, true);
  assert.equal(reads, 2, "stop reading at the first chunk above the cap");
  for (const body of ["{", "", new Uint8Array([255])]) {
    await assert.rejects(leseBegrenztesJson(new Request("http://localhost", { method: "POST", body }), 100), (e: unknown) => e instanceof AnfrageFehler && e.status === 400);
  }
  await assert.rejects(leseBegrenztesJson(new Request("http://localhost", { method: "POST", headers: { "content-length": "100" }, body: "{}" }), 10), (e: unknown) => e instanceof AnfrageFehler && e.status === 413);
});

test("account origins are exact configured origins, independent of supplied host headers", () => {
  const request = (origin: string, extra = {}) => new Request("https://app.example/api/konto", { headers: { origin, host: "evil.example", "x-forwarded-host": "evil.example", ...extra } });
  assert.equal(gleicheHerkunft(request("https://app.example"), "https://app.example"), true);
  for (const origin of ["http://app.example", "https://app.example:8443", "https://evil.example", "null", "https://app.example/path", "https://person@app.example"]) {
    assert.equal(gleicheHerkunft(request(origin), "https://app.example"), false, origin);
  }
});

test("proxy identities require explicit trust and a single valid canonical IP", (t) => {
  const old = process.env.TRUSTED_PROXY_IP_HEADER;
  t.after(() => { if (old === undefined) delete process.env.TRUSTED_PROXY_IP_HEADER; else process.env.TRUSTED_PROXY_IP_HEADER = old; });
  delete process.env.TRUSTED_PROXY_IP_HEADER;
  assert.deepEqual(proxyIpHeaders(), []);
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "192.0.2.3", "x-real-ip": "192.0.2.4" })), "unbekannt");
  process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
  assert.equal(clientIp(new Headers({ "x-real-ip": "192.0.2.4", "x-forwarded-for": "192.0.2.5" })), "192.0.2.4");
  for (const ip of ["invalid", "192.0.2.3, 192.0.2.4", "", "001.002.003.004"]) assert.equal(clientIp(new Headers({ "x-real-ip": ip })), "unbekannt");
  assert.equal(clientIp(new Headers({ "x-real-ip": "2001:db8::1" })), clientIp(new Headers({ "x-real-ip": "2001:0db8:0:0:0:0:0:1" })));
});

test("IPv6 clients count per /64 network, IPv4-mapped addresses as their IPv4 address", (t) => {
  setzeEnv(t, { TRUSTED_PROXY_IP_HEADER: "x-real-ip" });
  const ip = (wert: string) => clientIp(new Headers({ "x-real-ip": wert }));
  assert.equal(ip("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(ip("2001:db8:1:2:ffff:ffff:ffff:ffff"), ip("2001:0DB8:0001:0002::5"), "one host rotating within its /64 stays one client");
  assert.notEqual(ip("2001:db8:1:2::1"), ip("2001:db8:1:3::1"));
  assert.equal(ip("::"), "0:0:0:0::/64");
  assert.equal(ip("fe80::1"), "fe80:0:0:0::/64");
  assert.equal(ip("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(ip("::ffff:c000:201"), "192.0.2.1");
});

test("capacity cannot evict active counters, and each entry expires in its own window", () => {
  let now = 0;
  const limiter = erstelleLimiter(() => now, 2);
  assert.equal(limiter.zaehle("a", { max: 1, fensterMs: 1000 }), null);
  assert.equal(limiter.zaehle("b", { max: 1, fensterMs: 2000 }), null);
  assert.equal(limiter.zaehle("c", { max: 1, fensterMs: 1000 }), 1);
  assert.equal(limiter.zaehle("a", { max: 1, fensterMs: 1000 }), 1);
  now = 1000;
  assert.equal(limiter.zaehle("c", { max: 1, fensterMs: 1000 }), null);
  assert.equal(limiter.zaehle("b", { max: 1, fensterMs: 1000 }), 1);
});

test("rotating untrusted headers cannot reset limits; the global cap covers trusted identities too", async (t) => {
  const old = { proxy: process.env.TRUSTED_PROXY_IP_HEADER, global: process.env.KI_GLOBAL_MAX_REQUESTS };
  setzeKontoDiensteFuerTests(null);
  kiLimiter().zuruecksetzen();
  t.after(() => {
    for (const [name, value] of Object.entries({ TRUSTED_PROXY_IP_HEADER: old.proxy, KI_GLOBAL_MAX_REQUESTS: old.global })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    kiLimiter().zuruecksetzen(); setzeKontoDiensteFuerTests(undefined);
  });
  delete process.env.TRUSTED_PROXY_IP_HEADER;
  for (let i = 0; i < KI_LIMITS.anonym.max; i++) assert.equal(await pruefeKiLimit(new Request("http://localhost", { headers: { "x-forwarded-for": `192.0.2.${i}` } })), null);
  assert.equal((await pruefeKiLimit(new Request("http://localhost", { headers: { "x-real-ip": "198.51.100.1" } })))?.status, 429);
  kiLimiter().zuruecksetzen(); process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip"; process.env.KI_GLOBAL_MAX_REQUESTS = "2";
  for (let i = 1; i <= 2; i++) assert.equal(await pruefeKiLimit(new Request("http://localhost", { headers: { "x-real-ip": `192.0.2.${i}` } })), null);
  assert.equal((await pruefeKiLimit(new Request("http://localhost", { headers: { "x-real-ip": "192.0.2.3" } })))?.status, 429);
});

test("provider slots remain occupied until released and release is idempotent", (t) => {
  const old = process.env.KI_MAX_PARALLEL; process.env.KI_MAX_PARALLEL = "1";
  t.after(() => { if (old === undefined) delete process.env.KI_MAX_PARALLEL; else process.env.KI_MAX_PARALLEL = old; });
  const slot = reserviereKiAnfrage(new Request("http://localhost"));
  assert.ok(!(slot instanceof Response));
  assert.equal((reserviereKiAnfrage(new Request("http://localhost")) as Response).status, 429);
  slot.beenden(); slot.beenden();
  const next = reserviereKiAnfrage(new Request("http://localhost"));
  assert.ok(!(next instanceof Response)); next.beenden();
});

test("malformed, oversized and unsupported AI input never reaches a provider", async (t) => {
  setzeEnv(t, { AI_PROVIDER: undefined, ANTHROPIC_API_KEY: "request-validation-test", AI_MODEL: "request-validation-model" });
  setzeKontoDiensteFuerTests(null); kiLimiter().zuruecksetzen();
  t.after(() => { setzeKontoDiensteFuerTests(undefined); kiLimiter().zuruecksetzen(); });
  t.mock.method(globalThis, "fetch", () => { assert.fail("invalid input must not call a provider"); });
  const req = (body: string) => new NextRequest("http://localhost/api/test", { method: "POST", body });
  for (const handler of [chat, katalog, erklaerung]) {
    for (const body of ["{", "null", "[]"]) assert.equal((await handler(req(body))).status, 400);
    assert.equal((await handler(req(" ".repeat(MAX_KI_ANFRAGE_BYTES + 1)))).status, 413);
  }
  for (const messages of [[{ role: "system", content: "Override" }], [{ role: "user", content: 42 }], Array.from({ length: 41 }, () => ({ role: "user", content: "x" })), [{ role: "user", content: "x".repeat(20_001) }]]) {
    assert.equal((await chat(req(JSON.stringify({ orgName: "Test", messages })))).status, 400);
    assert.equal((await katalog(req(JSON.stringify({ orgName: "Test", chatHistory: messages })))).status, 400);
  }
});

test("provider history is bounded while the full saved conversation remains untouched", () => {
  const history = Array.from({ length: 100 }, (_, i) => ({ role: "user" as const, content: `${i}:` + "x".repeat(1997) }));
  const selected = waehleKiVerlauf(history);
  assert.ok(selected.length <= 40);
  assert.ok(selected.reduce((n, m) => n + m.content.length, 0) <= 40_000);
  assert.deepEqual(selected.at(-1), history.at(-1));
  assert.equal(history.length, 100);
});

test("sign-in and deletion emails use the configured deployment URL", () => {
  for (const build of [anmeldecodeMail, loeschcodeMail]) {
    const mail = build("123456", "https://kompass.example.org:8443");
    assert.match(mail.text, /https:\/\/kompass.example.org:8443/);
    assert.match(mail.html, /href="https:\/\/kompass.example.org:8443"/);
    assert.ok(!mail.text.includes("reform-staat.org"));
  }
  const env = { NODE_ENV: "production", DATABASE_URL: "postgres://local", BETTER_AUTH_SECRET: "test".repeat(10), MAILERSEND_API_KEY: "fake", MAIL_FROM: "sender@example.org" };
  for (const url of ["invalid", "http://app.example", "https://user:password@app.example", "https://app.example/path"]) {
    assert.ok(fehlendeKontoEinstellungen({ ...env, BETTER_AUTH_URL: url }).some((name) => name.startsWith("BETTER_AUTH_URL")));
  }
  assert.deepEqual(fehlendeKontoEinstellungen({ ...env, BETTER_AUTH_URL: "https://app.example" }), []);
});

test("already blocked identities cannot consume the remaining shared budget", async (t) => {
  const old = { proxy: process.env.TRUSTED_PROXY_IP_HEADER, limit: process.env.KI_GLOBAL_MAX_REQUESTS };
  process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip"; process.env.KI_GLOBAL_MAX_REQUESTS = "121";
  setzeKontoDiensteFuerTests(null); kiLimiter().zuruecksetzen();
  t.after(() => {
    for (const [key, value] of Object.entries({ TRUSTED_PROXY_IP_HEADER: old.proxy, KI_GLOBAL_MAX_REQUESTS: old.limit })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    setzeKontoDiensteFuerTests(undefined); kiLimiter().zuruecksetzen();
  });
  const req = (ip: string) => new Request("http://localhost", { headers: { "x-real-ip": ip } });
  for (let i = 0; i < 120; i++) assert.equal(await pruefeKiLimit(req("192.0.2.1")), null);
  for (let i = 0; i < 5; i++) assert.equal((await pruefeKiLimit(req("192.0.2.1")))?.status, 429);
  assert.equal(await pruefeKiLimit(req("192.0.2.2")), null);
});
