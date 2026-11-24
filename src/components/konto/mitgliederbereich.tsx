"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BewertungUebersicht } from "@/lib/bewertung";
import type { Profil } from "@/lib/konten";
import { kontoBrowser, formatiereDatum, formatiereDatumZeit } from "@/lib/konto-browser";
import { authClient } from "@/lib/auth-client";
import { KommuneInput } from "@/components/check/kommune-input";
import { loescheSitzung } from "@/components/check/sitzungsspeicher";
import { Seitenkopf } from "./seitenkopf";
import { AbmeldenKnopf } from "./abmelden";
import * as stil from "./stil";

export interface BewertungKarte {
  id: string;
  erstelltAm: string;
  aktualisiertAm: string;
  uebersicht: BewertungUebersicht | null;
}

const PHASE_TEXT: Record<BewertungUebersicht["phase"], string> = {
  kontext: "Angaben begonnen",
  assessment: "Fragebogen in Bearbeitung",
  ergebnis: "Ausgewertet",
  chat: "In Beratung",
};

export function Mitgliederbereich(props: { email: string; admin: boolean; profil: Profil; bewertungen: BewertungKarte[] }) {
  useEffect(() => { void authClient.getSession(); }, []);
  return (
    <div style={stil.seite}>
      <Seitenkopf>
        {props.admin && <a href="/admin" className="btn-text" style={stil.textLink}>Verwaltung</a>}
        <span style={stil.klein}>{props.email}</span>
        <AbmeldenKnopf />
      </Seitenkopf>
      <div style={stil.inhalt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }}>
          <div>
            <h1 style={stil.titel}>Mein Bereich</h1>
            <p style={stil.text}>Ihre gespeicherten Bewertungen. Änderungen werden beim Bearbeiten automatisch gesichert.</p>
          </div>
          <a href="/check?neu=1" className="btn-primary" style={stil.knopfPrimaer}>Neue Bewertung starten</a>
        </div>
        <Bewertungsliste start={props.bewertungen} />
        <ProfilFormular start={props.profil} />
        <KontoLoeschen />
      </div>
    </div>
  );
}

function Bewertungsliste({ start }: { start: BewertungKarte[] }) {
  const [liste, setListe] = useState(start);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [bestaetigen, setBestaetigen] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function waehle(id: string) {
    setAuswahl((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id].slice(-2));
  }

  async function loesche(id: string) {
    setFehler(null);
    try {
      await kontoBrowser.loescheBewertung(id);
      setListe((l) => l.filter((b) => b.id !== id));
      setAuswahl((a) => a.filter((x) => x !== id));
    } catch {
      setFehler("Die Bewertung konnte nicht gelöscht werden.");
    }
    setBestaetigen(null);
  }

  // Older assessment first, so differences read as change over time.
  const vergleichHref = auswahl.length === 2
    ? (() => {
        const [a, b] = auswahl.map((id) => liste.find((x) => x.id === id)!).sort((x, y) => x.erstelltAm.localeCompare(y.erstelltAm));
        return `/konto/vergleich?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`;
      })()
    : null;

  return (
    <section style={{ marginBottom: "40px" }} aria-labelledby="bewertungen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <h2 id="bewertungen" style={{ ...stil.abschnittTitel, margin: 0 }}>Meine Bewertungen</h2>
        {liste.length > 1 && (
          vergleichHref
            ? <a href={vergleichHref} className="btn-ghost" style={stil.knopfRahmen}>Auswahl vergleichen</a>
            : <span style={stil.klein}>Zum Vergleichen zwei Bewertungen auswählen</span>
        )}
      </div>
      {liste.length === 0 ? (
        <div style={stil.karte}>
          <p style={stil.text}>Noch keine Bewertungen gespeichert. Starten Sie eine neue Bewertung oder speichern Sie Ihr Ergebnis im Modernisierungs-Check.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {liste.map((b) => {
            const u = b.uebersicht;
            const gewaehlt = auswahl.includes(b.id);
            return (
              <li key={b.id} style={{ ...stil.karte, borderColor: gewaehlt ? "rgba(160,135,255,0.7)" : "rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  {liste.length > 1 && u && (
                    <input type="checkbox" checked={gewaehlt} onChange={() => waehle(b.id)} aria-label={`Bewertung vom ${formatiereDatum(b.erstelltAm)} zum Vergleich auswählen`}
                      style={{ width: "18px", height: "18px", marginTop: "3px", accentColor: stil.farben.lila, cursor: "pointer" }} />
                  )}
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    {u ? (
                      <>
                        <div style={{ fontSize: "15px", fontWeight: 700, overflowWrap: "anywhere" }}>{u.kommune}</div>
                        <div style={{ ...stil.klein, marginTop: "4px" }}>
                          {u.ebeneLabel} · {PHASE_TEXT[u.phase]} · {u.beantworteteFragen} von {u.gesamtFragen} Fragen
                          {u.massnahmen > 0 && ` · ${u.massnahmen} Maßnahmen`}
                        </div>
                        <div style={{ ...stil.klein, marginTop: "2px" }}>Begonnen {formatiereDatum(b.erstelltAm)} · zuletzt geändert {formatiereDatumZeit(b.aktualisiertAm)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>Bewertung vom {formatiereDatum(b.erstelltAm)}</div>
                        <div style={{ ...stil.klein, marginTop: "4px" }}>Passt nicht mehr zum aktuellen Fragebogen und kann nicht geöffnet werden.</div>
                      </>
                    )}
                  </div>
                  {u && u.beantworteteFragen > 0 && (
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "auto" }}>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: stil.farben.mint, lineHeight: 1 }}>{u.prozent}%</div>
                      <div style={{ ...stil.klein, marginTop: "4px" }}>Stufe {u.stufe}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap", alignItems: "center" }}>
                  {bestaetigen === b.id ? (
                    <>
                      <span style={{ fontSize: "13px" }}>Bewertung endgültig löschen?</span>
                      <button type="button" onClick={() => void loesche(b.id)} className="btn-ghost" style={stil.knopfGefahr}>Ja, löschen</button>
                      <button type="button" onClick={() => setBestaetigen(null)} className="btn-ghost" style={stil.knopfRahmen}>Abbrechen</button>
                    </>
                  ) : (
                    <>
                      {u && <a href={`/check?bewertung=${encodeURIComponent(b.id)}`} className="btn-ghost" style={stil.knopfRahmen}>Öffnen</a>}
                      <button type="button" onClick={() => setBestaetigen(b.id)} className="btn-ghost" style={stil.knopfGefahr}>Löschen</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {fehler && <p role="alert" style={stil.fehlerText}>{fehler}</p>}
    </section>
  );
}

function ProfilFormular({ start }: { start: Profil }) {
  const [profil, setProfil] = useState(start);
  const [status, setStatus] = useState<"bereit" | "speichert" | "gespeichert" | "fehler">("bereit");
  const setze = (feld: keyof Profil) => (wert: string) => { setProfil((p) => ({ ...p, [feld]: wert })); setStatus("bereit"); };

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setStatus("speichert");
    try {
      await kontoBrowser.speichereProfil({ kommune: profil.kommune.trim(), funktion: profil.funktion.trim(), fachbereich: profil.fachbereich.trim() });
      setStatus("gespeichert");
    } catch {
      setStatus("fehler");
    }
  }

  return (
    <section style={{ marginBottom: "40px" }} aria-labelledby="profil">
      <h2 id="profil" style={stil.abschnittTitel}>Profil</h2>
      <form onSubmit={speichern} style={{ ...stil.karte, display: "flex", flexDirection: "column", gap: "18px" }}>
        <p style={{ ...stil.klein, margin: 0 }}>Diese Angaben gelten für neue Bewertungen. Gespeicherte Bewertungen behalten die Angaben, mit denen sie erstellt wurden.</p>
        <div>
          <label htmlFor="kommune" style={stil.label}>Kommune</label>
          <KommuneInput id="kommune" value={profil.kommune} onChange={setze("kommune")} />
        </div>
        <div>
          <label htmlFor="fachbereich" style={stil.label}>Fachbereich</label>
          <input id="fachbereich" maxLength={300} value={profil.fachbereich} onChange={(e) => setze("fachbereich")(e.target.value)} placeholder="z. B. Bürgeramt, Stadtplanung, IT & Digitalisierung" style={stil.eingabe} />
        </div>
        <div>
          <label htmlFor="funktion" style={stil.label}>Funktion oder Position</label>
          <input id="funktion" maxLength={300} value={profil.funktion} onChange={(e) => setze("funktion")(e.target.value)} placeholder="z. B. Sachbearbeitung, Abteilungsleitung" style={stil.eingabe} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <button type="submit" disabled={status === "speichert"} className="btn-primary" style={stil.knopfPrimaer}>Profil speichern</button>
          {status === "gespeichert" && <span role="status" style={{ fontSize: "13px", color: stil.farben.mint }}>✓ Gespeichert</span>}
          {status === "fehler" && <span role="alert" style={{ fontSize: "13px", color: stil.farben.rot }}>Speichern fehlgeschlagen</span>}
        </div>
      </form>
    </section>
  );
}

function KontoLoeschen() {
  const [schritt, setSchritt] = useState<"start" | "code" | "fertig">("start");
  const [code, setCode] = useState("");
  const [laed, setLaed] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [endgueltigAm, setEndgueltigAm] = useState<string | null>(null);

  async function codeAnfordern() {
    setLaed(true);
    setFehler(null);
    try {
      await kontoBrowser.fordereLoeschcodeAn();
      setSchritt("code");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Code konnte nicht gesendet werden.");
    }
    setLaed(false);
  }

  async function loeschen(e: React.FormEvent) {
    e.preventDefault();
    setLaed(true);
    setFehler(null);
    try {
      setEndgueltigAm(await kontoBrowser.loescheKonto(code.trim()));
      loescheSitzung();
      setSchritt("fertig");
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das Konto konnte nicht gelöscht werden.");
    }
    setLaed(false);
  }

  return (
    <section aria-labelledby="loeschen">
      <h2 id="loeschen" style={stil.abschnittTitel}>Konto löschen</h2>
      <div style={{ ...stil.karte, borderColor: "rgba(248,113,113,0.3)" }}>
        {schritt === "fertig" ? (
          <div role="status">
            <p style={stil.text}>
              Ihr Konto ist zur Löschung vorgemerkt und Sie wurden abgemeldet.
              {endgueltigAm && ` Am ${formatiereDatum(endgueltigAm)} werden das Konto und alle Bewertungen endgültig gelöscht.`}
              {" "}Bis dahin können Sie es wiederherstellen, indem Sie sich erneut anmelden.
            </p>
            <Link href="/" style={{ ...stil.textLink, display: "inline-block", marginTop: "14px" }}>Zur Startseite</Link>
          </div>
        ) : (
          <>
            <p style={{ ...stil.text, marginBottom: "16px" }}>
              Das Konto und alle gespeicherten Bewertungen werden nach 30 Tagen endgültig gelöscht. Bis dahin können Sie es wiederherstellen.
              Zur Bestätigung senden wir Ihnen einen Code per E-Mail.
            </p>
            {schritt === "start" ? (
              <button type="button" onClick={() => void codeAnfordern()} disabled={laed} className="btn-ghost" style={stil.knopfGefahr}>
                {laed ? "Code wird gesendet…" : "Löschcode anfordern"}
              </button>
            ) : (
              <form onSubmit={loeschen} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "0 1 200px" }}>
                  <label htmlFor="loeschcode" style={stil.label}>Code aus der E-Mail</label>
                  <input id="loeschcode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    style={{ ...stil.eingabe, letterSpacing: "6px", textAlign: "center" }} />
                </div>
                <button type="submit" disabled={laed || code.length !== 6} className="btn-ghost" style={{ ...stil.knopfGefahr, opacity: laed || code.length !== 6 ? 0.5 : 1 }}>
                  Konto löschen
                </button>
              </form>
            )}
            {fehler && <p role="alert" style={stil.fehlerText}>{fehler}</p>}
          </>
        )}
      </div>
    </section>
  );
}
