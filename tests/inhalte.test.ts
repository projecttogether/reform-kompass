import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAdvicePrompt } from "../src/lib/beratung-prompt";
import { ANTWORTPROTOKOLL } from "../src/lib/beratung-protokoll";
import { fehlendeInhalte, inhalteOrdner, leseBetreiber, meldeInhalte } from "../src/lib/inhalte";
import { leseKontoEinstellungen } from "../src/lib/konto-config";
import { anmeldecodeMail, loeschcodeMail } from "../src/lib/mail";
import { setzeEnv } from "./fixtures";

type Kontext = { after: (fn: () => void) => void };

/** Points KOMPASS_INHALTE_DIR at a temporary folder with these files. */
function inhalte(t: Kontext, dateien: Record<string, string>) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), "kompass-inhalte-"));
  t.after(() => fs.rmSync(ordner, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, name), text);
  setzeEnv(t, { KOMPASS_INHALTE_DIR: ordner });
  return ordner;
}

const BETREIBER = { name: "Test & Söhne", fusszeile: [{ text: "Hinweis", link: { text: "Kontakt", url: "mailto:a@example.org" } }] };

test("the content folder in the repository is complete", (t) => {
  setzeEnv(t, { KOMPASS_INHALTE_DIR: undefined });
  assert.equal(inhalteOrdner(), path.resolve("inhalte"));
  assert.deepEqual(fehlendeInhalte(), []);
});

test("operator content replaces the texts but never the reply protocol", (t) => {
  inhalte(t, { "system-prompt.md": "ANWEISUNG", "knowledge-base.md": "WISSEN", "betreiber.json": JSON.stringify(BETREIBER) });
  assert.equal(readAdvicePrompt(), `ANWEISUNG\n\n---\n\n${ANTWORTPROTOKOLL}\n\n---\n\nWISSEN`);
  assert.deepEqual(leseBetreiber(), BETREIBER);
  assert.deepEqual(fehlendeInhalte(), []);
  for (const token of ["RÜCKFRAGE:", "OPTION_A:", "OPTION_B:", "OPTION_C:", "[KATALOG_AKTUALISIEREN]"]) {
    assert.ok(ANTWORTPROTOKOLL.includes(token), `missing advice protocol token: ${token}`);
  }
});

test("missing content is reported at start and leaves neutral defaults", (t) => {
  const ordner = inhalte(t, { "system-prompt.md": "  \n" });
  assert.deepEqual(leseBetreiber(), { name: "Reform-Kompass", fusszeile: [] });
  assert.ok(readAdvicePrompt().includes(ANTWORTPROTOKOLL));
  const warnungen: string[] = [];
  t.mock.method(console, "warn", (text: string) => { warnungen.push(text); });
  meldeInhalte();
  assert.equal(warnungen.length, 1);
  for (const teil of [ordner, "system-prompt.md", "knowledge-base.md", "betreiber.json"]) assert.ok(warnungen[0].includes(teil), teil);
});

test("invalid operator settings are rejected as a whole", (t) => {
  const zeile = (url: string) => JSON.stringify({ name: "X", fusszeile: [{ text: "T", link: { text: "L", url } }] });
  for (const datei of [zeile("javascript:alert(1)"), zeile("http://example.org"), zeile("//example.org"), '{"name":""}', '{"name":"X","unbekannt":1}', "{"]) {
    inhalte(t, { "system-prompt.md": "A", "knowledge-base.md": "B", "betreiber.json": datei });
    assert.deepEqual(leseBetreiber(), { name: "Reform-Kompass", fusszeile: [] }, datei);
    assert.equal(fehlendeInhalte().length, 1, datei);
  }
});

test("emails carry the operator's product name, escaped in HTML", (t) => {
  inhalte(t, { "betreiber.json": JSON.stringify({ ...BETREIBER, name: "<b>A & B</b>" }) });
  for (const build of [anmeldecodeMail, loeschcodeMail]) {
    const mail = build("123456", "https://kompass.example.org");
    assert.ok(mail.text.includes("<b>A & B</b>"));
    assert.ok(mail.html.includes("&lt;b&gt;A &amp; B&lt;/b&gt;"));
    assert.ok(!mail.html.includes("<b>A"));
  }
  const env = { NODE_ENV: "production", DATABASE_URL: "postgres://local", BETTER_AUTH_SECRET: "test".repeat(10), BETTER_AUTH_URL: "https://app.example", MAILERSEND_API_KEY: "fake", MAIL_FROM: "sender@example.org" };
  assert.equal(leseKontoEinstellungen(env)!.absender.name, "<b>A & B</b>");
  assert.equal(leseKontoEinstellungen({ ...env, MAIL_FROM_NAME: "Absender" })!.absender.name, "Absender");
});
