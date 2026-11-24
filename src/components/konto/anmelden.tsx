"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Seitenkopf } from "./seitenkopf";
import * as stil from "./stil";

type Schritt = "email" | "code";

/** `erneut`: an admin whose sign-in is older than the admin area allows. */
export function Anmelden({ weiter, erneut = null }: { weiter: string; erneut?: { email: string; stunden: number } | null }) {
  const [schritt, setSchritt] = useState<Schritt>("email");
  const [email, setEmail] = useState(erneut?.email ?? "");
  const [code, setCode] = useState("");
  const [laed, setLaed] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const speichertBewertung = weiter.includes("speichern=1");

  async function codeAnfordern(e?: React.FormEvent) {
    e?.preventDefault();
    setFehler(null);
    setHinweis(null);
    setLaed(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setLaed(false);
    if (error) {
      setFehler(error.code === "CODES_PRO_TAG"
        ? "Für diese Adresse wurden heute zu viele Codes angefordert. Bitte versuchen Sie es morgen erneut."
        : error.status === 429 ? "Zu viele Versuche. Bitte warten Sie einige Minuten." : "Der Code konnte nicht gesendet werden. Bitte prüfen Sie die E-Mail-Adresse.");
      return;
    }
    setSchritt("code");
    setCode("");
    setHinweis(`Wir haben einen sechsstelligen Code an ${email.trim()} gesendet.`);
  }

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaed(true);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    if (error) {
      setLaed(false);
      setFehler(error.status === 429 ? "Zu viele Versuche. Bitte warten Sie einige Minuten." : "Der Code ist nicht korrekt oder abgelaufen.");
      return;
    }
    // Full navigation so server-rendered pages see the new session.
    window.location.assign(weiter);
  }

  const codeGueltig = /^\d{6}$/.test(code.trim());

  return (
    <div style={stil.seite}>
      <Seitenkopf />
      <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <h1 style={stil.titel}>Anmelden</h1>
          <p style={{ ...stil.text, marginBottom: "28px" }}>
            {erneut
              ? `Für den Verwaltungsbereich bestätigen Sie Ihre Anmeldung alle ${erneut.stunden} Stunden mit einem neuen Code.`
              : speichertBewertung
                ? "Melden Sie sich an, um Ihre Bewertung zu speichern. Danach wird sie automatisch in Ihrem Bereich gesichert."
                : "Mit einem Konto speichern Sie Bewertungen, setzen sie später fort und vergleichen sie über die Zeit."}
            {" "}Sie brauchen kein Passwort: Wir senden Ihnen einen Code per E-Mail.
          </p>

          {schritt === "email" ? (
            <form onSubmit={codeAnfordern}>
              <label htmlFor="email" style={stil.label}>E-Mail-Adresse</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kommune.de" style={stil.eingabe} />
              <button type="submit" disabled={laed || !email.trim()} className="btn-primary" style={{ ...stil.knopfPrimaer, width: "100%", marginTop: "20px", opacity: laed || !email.trim() ? 0.5 : 1 }}>
                {laed ? "Code wird gesendet…" : "Code anfordern"}
              </button>
            </form>
          ) : (
            <form onSubmit={anmelden}>
              {hinweis && <p role="status" style={{ ...stil.text, marginBottom: "16px" }}>{hinweis}</p>}
              <label htmlFor="code" style={stil.label}>Code aus der E-Mail</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456"
                style={{ ...stil.eingabe, fontSize: "22px", letterSpacing: "8px", textAlign: "center" }} />
              <button type="submit" disabled={laed || !codeGueltig} className="btn-primary" style={{ ...stil.knopfPrimaer, width: "100%", marginTop: "20px", opacity: laed || !codeGueltig ? 0.5 : 1 }}>
                {laed ? "Anmeldung läuft…" : "Anmelden"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", gap: "12px", flexWrap: "wrap" }}>
                <button type="button" className="btn-text" onClick={() => { setSchritt("email"); setFehler(null); setHinweis(null); }} style={{ ...stil.textLink, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Andere E-Mail-Adresse
                </button>
                <button type="button" className="btn-text" disabled={laed} onClick={() => void codeAnfordern()} style={{ ...stil.textLink, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Neuen Code senden
                </button>
              </div>
              <p style={{ ...stil.klein, marginTop: "16px" }}>Der Code ist 10 Minuten gültig. Prüfen Sie auch Ihren Spam-Ordner.</p>
            </form>
          )}
          {fehler && <p role="alert" style={stil.fehlerText}>{fehler}</p>}
          <p style={{ ...stil.klein, marginTop: "32px" }}>
            <a href="/check" style={stil.textLink}>Ohne Anmeldung fortfahren</a>
          </p>
        </div>
      </div>
    </div>
  );
}
