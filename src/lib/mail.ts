import { leseBetreiber } from "./inhalte";

export interface Mail {
  an: string;
  betreff: string;
  text: string;
  html: string;
}

export interface MailVersand {
  sende(mail: Mail): Promise<void>;
}

const MAILERSEND_URL = "https://api.mailersend.com/v1/email";

export function mailerSend(options: { apiKey: string; absender: { email: string; name: string }; fetch?: typeof fetch; url?: string }): MailVersand {
  const senden = options.fetch ?? fetch;
  return {
    async sende(mail) {
      const res = await senden(options.url ?? MAILERSEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ from: options.absender, to: [{ email: mail.an }], subject: mail.betreff, text: mail.text, html: mail.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`MailerSend antwortete mit HTTP ${res.status}`);
    },
  };
}

/** Development only: prints emails to the server log instead of sending them. */
export function konsolenMail(log: (text: string) => void = console.info): MailVersand {
  return { async sende(mail) { log(`[Mail an ${mail.an}] ${mail.betreff}\n${mail.text}`); } };
}

function htmlText(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function codeMail(betreff: string, einleitung: string, code: string, hinweis: string, baseURL: string): Omit<Mail, "an"> {
  const url = new URL(baseURL).origin;
  const { name } = leseBetreiber();
  const text = `${einleitung}\n\n${code}\n\nDer Code ist 10 Minuten gültig. ${hinweis}\n\n${name} · ${url}`;
  const html = `<!doctype html><html lang="de"><body style="font-family:Arial,sans-serif;color:#00115a;line-height:1.5">
<p>${htmlText(einleitung)}</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:24px 0">${code}</p>
<p>Der Code ist 10 Minuten gültig. ${hinweis}</p>
<p style="color:#6b7280;font-size:12px">${htmlText(name)} · <a href="${htmlText(url)}">${htmlText(url)}</a></p>
</body></html>`;
  return { betreff, text, html };
}

export function anmeldecodeMail(code: string, baseURL: string) {
  return codeMail(`${code} ist Ihr Anmeldecode für ${leseBetreiber().name}`, "Geben Sie diesen Code auf der Anmeldeseite ein:", code, "Wenn Sie keine Anmeldung angefordert haben, können Sie diese E-Mail ignorieren.", baseURL);
}

export function loeschcodeMail(code: string, baseURL: string) {
  return codeMail(`${code} bestätigt die Löschung Ihres Kontos`, `Mit diesem Code bestätigen Sie die Löschung Ihres Kontos bei ${leseBetreiber().name}:`, code, "Nach der Bestätigung können Sie Ihr Konto noch 30 Tage lang wiederherstellen. Wenn Sie die Löschung nicht angefordert haben, ignorieren Sie diese E-Mail.", baseURL);
}
