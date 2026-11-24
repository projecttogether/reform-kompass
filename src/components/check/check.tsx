"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import {
  FRAGEN,
  KATEGORIEN,
  EBENEN,
  FRAGEBOGEN_VERSION,
  berechneScore,
  getFrageText,
  generiereEinschaetzung,
  type Ebene,
  type Kategorie,
  type ScoreResult,
} from "@/lib/reifegrad-model";
import ReactMarkdown from "react-markdown";
import { einleitung } from "@/lib/beratung";
import { useBeratung } from "./use-beratung";
import { KatalogSidebar } from "./katalog-sidebar";
import { exportiereErgebnis, exportiereVollbericht } from "./pdf-export";
import { KommuneInput } from "./kommune-input";
import { ladeSitzung, loescheSitzung, speichereSitzung } from "./sitzungsspeicher";
import { useBewertungSpeicher } from "./use-bewertung-speicher";
import { SpeicherKnopf } from "./speicher-knopf";
import { KontoLink } from "@/components/konto/seitenkopf";
import { LogoLink, useProduktname } from "@/components/marke";
import type { BewertungStand } from "@/lib/bewertung";
import { kontoBrowser } from "@/lib/konto-browser";
import type { Profil } from "@/lib/konten";

type Phase = "kontext" | "assessment" | "ergebnis" | "chat";

/** Account state from the server page. All of it is empty when accounts are disabled. */
export interface KontoStart {
  aktiv: boolean;
  /** Signed-in member. `profil` is null for accounts pending deletion or when it could not be loaded. */
  mitglied: { vorgemerkt: boolean; profil: Profil | null } | null;
  /** Saved assessment opened with ?bewertung=<id>. */
  bewertung: { id: string; revision: number; stand: BewertungStand } | null;
  /** The id from ?bewertung=<id>, also when it could not be loaded. */
  angefragt: string | null;
  /** ?neu=1: start a new assessment, pre-filled from the profile. */
  neu: boolean;
  /** ?speichern=1: save the tab's assessment right after sign-in. */
  speichern: boolean;
}

const MIT_SPEICHERN = "/check?speichern=1";
const MAX_EINGABE = 4000;

// Purple hexagon SVG avatar for assistant messages
const HexAvatar = () => (
  <div style={{ width: "28px", height: "28px", flexShrink: 0, marginTop: "2px" }}>
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
      <path d="M14 2 L24.5 8 L24.5 20 L14 26 L3.5 20 L3.5 8 Z" fill="#a087ff" />
    </svg>
  </div>
);

const subscribeMount = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

type CheckProps = { aiEnabled: boolean; konto: KontoStart };

export default function Check(props: CheckProps) {
  const browser = useSyncExternalStore(subscribeMount, browserSnapshot, serverSnapshot);
  // A browser-only remount lets initializers read tab storage without changing
  // the server snapshot during hydration or cascading state updates in an effect.
  return <CheckInhalt key={browser ? "tab" : "server"} {...props} browser={browser} />;
}

function CheckInhalt({ aiEnabled, konto, browser }: CheckProps & { browser: boolean }) {
  const produktname = useProduktname();
  const [start] = useState(() => {
    let sitzung = browser ? (konto.bewertung
      ? { stand: konto.bewertung.stand, bewertungId: konto.bewertung.id, revision: konto.bewertung.revision }
      : konto.neu ? null : ladeSitzung()) : null;
    const nichtGeoeffnet = !!konto.angefragt && !konto.bewertung && sitzung?.bewertungId !== konto.angefragt;
    if (nichtGeoeffnet) sitzung = null;
    return { sitzung, nichtGeoeffnet };
  });
  const initial = start.sitzung?.stand;
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? "kontext");
  // A new assessment (?neu=1) renders pre-filled from the profile on the server.
  const startProfil = konto.mitglied?.profil ?? null;
  const [kommune, setKommune] = useState(initial?.kontext.orgName ?? startProfil?.kommune ?? "");
  const [orgTyp] = useState("Kommune");
  const [ebene, setEbene] = useState<Ebene>(initial?.kontext.ebene ?? "gesamtverwaltung");
  const [positionFachbereich, setPositionFachbereich] = useState(initial?.kontext.positionFachbereich ?? startProfil?.fachbereich ?? "");
  const [funktion, setFunktion] = useState(initial?.kontext.funktion ?? startProfil?.funktion ?? "");
  const [antworten, setAntworten] = useState<Record<string, number>>(initial?.antworten ?? {});
  const [aktuelleFrageIndex, setAktuelleFrageIndex] = useState(initial?.aktuelleFrage ?? 0);
  const [chatInput, setChatInput] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(() => initial && ["ergebnis", "chat"].includes(initial.phase) ? berechneScore(initial.antworten, initial.kontext.ebene) : null);
  const [aufgeklappt, setAufgeklappt] = useState<Record<string, boolean>>({});
  const [gesamtOffen, setGesamtOffen] = useState(false);
  const { beratung, messages, chatLaed, streamContent, katalog, katalogLoading, katalogError, katalogUpdated, katalogRevision, erklaerungen, erklaerungLaed } = useBeratung(initial, aiEnabled);

  const [streamAnzeige, setStreamAnzeige] = useState({ nachrichten: -1, text: "" });
  const streamLaenge = useRef({ nachrichten: -1, laenge: 0 });
  const displayedStream = streamContent === null ? null : streamAnzeige.nachrichten === messages.length ? streamAnzeige.text : "";
  useEffect(() => {
    if (streamContent === null) return;
    const target = streamContent;
    if (streamLaenge.current.nachrichten !== messages.length) streamLaenge.current = { nachrichten: messages.length, laenge: 0 };
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      streamLaenge.current.laenge = Math.min(streamLaenge.current.laenge + 6, target.length);
      setStreamAnzeige({ nachrichten: messages.length, text: target.slice(0, streamLaenge.current.laenge) });
      if (streamLaenge.current.laenge < target.length) timer = setTimeout(advance, 16);
    };
    timer = setTimeout(advance, 0);
    return () => clearTimeout(timer);
  }, [streamContent, messages.length]);
  const [mobileTab, setMobileTab] = useState<"chat" | "katalog">("chat");
  const [exportLaed, setExportLaed] = useState(false);
  const [exportFehler, setExportFehler] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resizable split panel state
  const [katalogWidth, setKatalogWidth] = useState(420);
  const resizingRef = useRef(false);
  const lastXRef = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    resizingRef.current = true;
    lastXRef.current = e.clientX;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = lastXRef.current - e.clientX;
      lastXRef.current = e.clientX;
      setKatalogWidth((w) => Math.max(280, Math.min(700, w + dx)));
    };
    const onMouseUp = () => { resizingRef.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [aktuelleFrageIndex]);

  // Pre-warm jsPDF when ergebnis phase loads so the first export doesn't trigger a cold chunk fetch
  useEffect(() => {
    if (phase === "ergebnis") { void import("jspdf"); }
  }, [phase]);

  const darfSpeichern = !!konto.mitglied && !konto.mitglied.vorgemerkt;
  const geladen = browser;
  // ?bewertung=<id> could not be opened (signed out, deleted, or the database failed).
  const [nichtGeoeffnet, setNichtGeoeffnet] = useState(start.nichtGeoeffnet);
  // An assessment keeps the questionnaire version it was created with.
  const [fragebogenVersion] = useState(initial?.fragebogenVersion ?? FRAGEBOGEN_VERSION);

  // Serializable state of this assessment; null until a municipality is entered.
  const stand = useMemo<BewertungStand | null>(() => {
    if (!kommune.trim()) return null;
    return {
      version: 1,
      fragebogenVersion,
      phase,
      aktuelleFrage: aktuelleFrageIndex,
      kontext: { orgName: kommune, funktion, positionFachbereich, ebene },
      antworten,
      nachrichten: messages.filter((m) => !m.error),
      katalog,
    };
  }, [fragebogenVersion, phase, aktuelleFrageIndex, kommune, funktion, positionFachbereich, ebene, antworten, messages, katalog]);

  const speicher = useBewertungSpeicher(stand, { aktiv: darfSpeichern, pausiert: !geladen || chatLaed });

  // Link the initialized tab state to external account/advice services after mount.
  useEffect(() => {
    if (!browser) return;
    if (konto.neu) loescheSitzung();
    if (konto.angefragt || konto.neu || konto.speichern) history.replaceState(history.state, "", "/check");
    const sitzung = start.sitzung;
    if (!sitzung) return;
    const s = sitzung.stand;
    if (darfSpeichern && konto.bewertung) speicher.verknuepfe(konto.bewertung.id, konto.bewertung.revision, s);
    else if (darfSpeichern && sitzung.bewertungId) void speicher.pruefeUndVerknuepfe(sitzung.bewertungId, sitzung.revision, s);
    if (konto.speichern && darfSpeichern && !sitzung.bewertungId) void speicher.erstelle(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geladen && stand) speichereSitzung({ stand, bewertungId: speicher.bewertungId, revision: speicher.revision });
  }, [geladen, stand, speicher.bewertungId, speicher.revision]);

  function starteFragebogen() {
    setNichtGeoeffnet(false);
    setPhase("assessment");
    if (!darfSpeichern || !stand) return;
    // Members save automatically. The entered details become the profile for the next assessment.
    if (speicher.bewertungId) {
      void kontoBrowser.speichereProfil({ kommune: kommune.trim(), funktion: funktion.trim(), fachbereich: positionFachbereich.trim() }).catch(() => {});
    } else {
      void speicher.erstelle({ ...stand, phase: "assessment" });
    }
  }

  function speichern() {
    if (stand) void speicher.erstelle(stand);
  }

  // Shown in every phase: this tab stopped saving because another tab saved first.
  const konfliktLeiste = speicher.status === "konflikt" && speicher.bewertungId ? (
    <div role="alert" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#fbbf24", color: "#00115a", padding: "10px 16px", fontSize: "13px", lineHeight: 1.5, textAlign: "center" }}>
      Diese Bewertung wurde in einem anderen Fenster geändert. Änderungen in diesem Fenster werden nicht gespeichert.{" "}
      <a href={`/check?bewertung=${encodeURIComponent(speicher.bewertungId)}`} style={{ color: "#00115a", fontWeight: 700 }}>Gespeicherte Fassung öffnen</a>
    </div>
  ) : null;

  const nichtGeoeffnetHinweis = nichtGeoeffnet && konto.angefragt ? (
    <div role="status" style={{ background: "rgba(251,191,36,0.15)", borderBottom: "1px solid rgba(251,191,36,0.4)", color: "#ffffff", padding: "10px 16px", fontSize: "13px", lineHeight: 1.5, textAlign: "center" }}>
      {konto.mitglied ? (
        <>Diese gespeicherte Bewertung konnte nicht geöffnet werden.{" "}
          <a href="/konto" style={{ color: "#fbbf24", fontWeight: 700 }}>Zu meinen Bewertungen</a></>
      ) : (
        <>Melden Sie sich an, um diese gespeicherte Bewertung zu öffnen.{" "}
          <a href={`/anmelden?weiter=${encodeURIComponent(`/check?bewertung=${encodeURIComponent(konto.angefragt)}`)}`} style={{ color: "#fbbf24", fontWeight: 700 }}>Anmelden</a></>
      )}
    </div>
  ) : null;

  const kontoLink = konto.aktiv ? <KontoLink angemeldet={!!konto.mitglied} weiter={kommune.trim() ? MIT_SPEICHERN : "/check"} /> : null;
  const speicherKnopf = (kompakt?: boolean) => (
    <SpeicherKnopf kontenAktiv={konto.aktiv} angemeldet={!!konto.mitglied} darfSpeichern={darfSpeichern}
      bewertungId={speicher.bewertungId} status={speicher.status} onSpeichern={speichern} kompakt={kompakt} />
  );

  function goToPhase(newPhase: Phase) {
    history.pushState({ phase: newPhase }, "");
    setPhase(newPhase);
  }

  useEffect(() => { history.replaceState({ phase }, ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const ziel = e.state?.phase as Phase | undefined;
      if (!ziel) return;
      if (ziel === "ergebnis" || ziel === "chat") {
        setScoreResult(berechneScore(antworten, ebene));
        beratung.aktualisiereKontext({ orgName: kommune, orgTyp, funktion, positionFachbereich, ebene, antworten }, aiEnabled);
      }
      setPhase(ziel);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [beratung, antworten, ebene, kommune, orgTyp, funktion, positionFachbereich, aiEnabled]);

  function weiterZuErgebnis() {
    setScoreResult(berechneScore(antworten, ebene));
    beratung.aktualisiereKontext({ orgName: kommune, orgTyp, funktion, positionFachbereich, ebene, antworten }, aiEnabled);
    goToPhase("ergebnis");
  }

  function zurueckZuFragen() {
    beratung.cancel();
    goToPhase("assessment");
    setAktuelleFrageIndex(FRAGEN.length - 1);
  }

  function sendMessage(text?: string) {
    const content = (text ?? chatInput).trim();
    if (!aiEnabled || !content || chatLaed) return;
    setChatInput("");
    void beratung.sendMessage(content);
  }

  const getFarbe = (prozent: number) => {
    if (prozent < 30) return { dot: "#ef4444" };
    if (prozent < 50) return { dot: "#f97316" };
    if (prozent < 70) return { dot: "#eab308" };
    if (prozent < 85) return { dot: "#22c55e" };
    return { dot: "#0ea5e9" };
  };

  const gesamtFarbe = scoreResult ? getFarbe(scoreResult.prozent) : { dot: "rgba(255,255,255,0.3)" };

  // ---- KONTEXT ----
  if (phase === "kontext") {
    const bereit = kommune.trim().length > 0;
    return (
      <div style={{ minHeight: "100vh", background: "#00115a", display: "flex", flexDirection: "column", fontFamily: "var(--font-rubik), sans-serif" }}>
        {konfliktLeiste}
        {nichtGeoeffnetHinweis}
        <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoLink />
          {kontoLink}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ width: "100%", maxWidth: "520px" }}>
            <h1 style={{ fontSize: "clamp(20px, 4vw, 26px)", fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: "#ffffff", lineHeight: 1.3, marginBottom: "32px", letterSpacing: "-0.01em" }}>
              Bevor wir starten, ein paar Angaben zu Ihrer Person
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
              <div>
                <label htmlFor="kommune" style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
                  Für welche Kommune arbeiten Sie?
                </label>
                <KommuneInput id="kommune" zeigeGrunddaten={aiEnabled} value={kommune} onChange={(value) => { if (value !== kommune) beratung.verwerfeAuswertung(); setKommune(value); }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
                  In welchem Fachbereich sind Sie tätig?
                </label>
                <input
                  type="text"
                  value={positionFachbereich}
                  maxLength={300}
                  onChange={(e) => { beratung.verwerfeAuswertung(); setPositionFachbereich(e.target.value); }}
                  placeholder="z. B. Bürgeramt, Stadtplanung, IT & Digitalisierung"
                  style={{ width: "100%", padding: "11px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", fontSize: "14px", fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
                  Was ist Ihre Funktion oder Position?
                </label>
                <input
                  type="text"
                  value={funktion}
                  maxLength={300}
                  onChange={(e) => { beratung.verwerfeAuswertung(); setFunktion(e.target.value); }}
                  placeholder="z. B. Sachbearbeitung, Abteilungsleitung, Digitalisierungsbeauftragte/r"
                  style={{ width: "100%", padding: "11px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", fontSize: "14px", fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "6px" }}>
                  Für welche Ebene möchten Sie die Verwaltungsmodernisierung einschätzen?
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={ebene}
                    onChange={(e) => { beratung.verwerfeAuswertung(); setEbene(e.target.value as Ebene); }}
                    style={{ width: "100%", padding: "11px 40px 11px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", fontSize: "14px", fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                  >
                    {(Object.keys(EBENEN) as Ebene[]).map((e) => (
                      <option key={e} value={e} style={{ background: "#00115a", color: "#ffffff" }}>
                        {EBENEN[e].label} ({EBENEN[e].beispiele})
                      </option>
                    ))}
                  </select>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.6)" }}>
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
            <div style={{ background: "rgba(100,210,180,0.12)", border: "1px solid rgba(100,210,180,0.3)", borderRadius: "4px", padding: "16px 18px", marginBottom: "28px" }}>
              <p style={{ fontSize: "13px", color: "#ffffff", lineHeight: 1.7, margin: 0 }}>
                Hinweis: Die folgenden Fragen zur Bestimmung des Modernisierungsgrades sind bewusst allgemein gehalten, um möglichst viele Verwaltungsbereiche abzudecken. Manche Fragen zielen auf Themen ab, die Sie in Ihrer aktuellen Position möglicherweise nicht direkt beeinflussen können.
              </p>
            </div>
            <button
              disabled={!bereit}
              onClick={starteFragebogen}
              className="btn-primary"
              style={{ width: "100%", padding: "13px 24px", background: bereit ? "#64d2b4" : "rgba(255,255,255,0.1)", color: bereit ? "#00115a" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "4px", fontSize: "15px", fontWeight: 700, cursor: bereit ? "pointer" : "not-allowed" }}
            >
              Fragebogen starten — 15 Fragen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- ASSESSMENT ----
  if (phase === "assessment") {
    const frage = FRAGEN[aktuelleFrageIndex];
    const frageTexte = getFrageText(frage, ebene);
    const fortschritt = Math.round((aktuelleFrageIndex / FRAGEN.length) * 100);
    const istLetzte = aktuelleFrageIndex === FRAGEN.length - 1;
    const gewaehlteAntwort = antworten[frage.id];
    const beantwortet = gewaehlteAntwort !== undefined;

    return (
      <div style={{ minHeight: "100vh", background: "#00115a", display: "flex", flexDirection: "column", fontFamily: "var(--font-rubik), sans-serif" }}>
        {konfliktLeiste}
        <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoLink />
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {kommune && <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{kommune}</span>}
            <span style={{ fontSize: "12px", color: "#64d2b4", fontWeight: 600 }}>{EBENEN[ebene].kurzLabel}</span>
            <span style={{ fontSize: "13px", color: "#ffffff" }}>{aktuelleFrageIndex + 1} / {FRAGEN.length}</span>
            {kontoLink}
          </div>
        </div>
        <div style={{ height: "2px", background: "rgba(255,255,255,0.1)" }}>
          <div style={{ height: "100%", width: `${fortschritt}%`, background: "#64d2b4", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px" }}>
          <div style={{ width: "100%", maxWidth: "620px" }}>
            <h2 style={{ fontSize: "19px", fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: "#ffffff", lineHeight: 1.4, marginBottom: "8px" }}>
              {frage.titel}{" "}
              <span style={{ fontSize: "13px", fontFamily: "var(--font-rubik), sans-serif", fontWeight: 400, color: "rgba(255,255,255,0.55)", letterSpacing: "0" }}>({frage.teilLabel})</span>
            </h2>
            <p style={{ fontSize: "14px", color: "#ffffff", lineHeight: 1.65, marginBottom: "28px" }}>
              {frageTexte.beschreibung}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "28px" }}>
              {frageTexte.optionen.map((option, idx) => {
                const ausgewaehlt = gewaehlteAntwort === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (antworten[frage.id] === idx) return;
                      beratung.verwerfeAuswertung();
                      setAntworten((p) => ({ ...p, [frage.id]: idx }));
                    }}
                    className={`answer-option${ausgewaehlt ? " selected" : ""}`}
                    style={{ textAlign: "left", padding: "13px 16px", border: "1px solid rgba(255,255,255,0.2)", outline: ausgewaehlt ? "2px solid #ffffff" : "none", outlineOffset: "-1px", borderRadius: "4px", background: ausgewaehlt ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: "#ffffff", fontSize: "14px", lineHeight: 1.5, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 700, opacity: 0.4, marginRight: "10px", fontSize: "11px" }}>{idx + 1}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                  onClick={() => aktuelleFrageIndex === 0 ? goToPhase("kontext") : setAktuelleFrageIndex((i) => i - 1)}
                  className="btn-ghost"
                  style={{ padding: "8px 16px", background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", color: "#64d2b4", fontSize: "13px", cursor: "pointer" }}
                >
                  ← Zurück
                </button>
                <button
                  onClick={() => { if (istLetzte) weiterZuErgebnis(); else setAktuelleFrageIndex((i) => i + 1); }}
                  className="btn-ghost"
                  style={{ padding: "8px 16px", background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", color: "#64d2b4", fontSize: "13px", cursor: "pointer" }}
                >
                  Überspringen
                </button>
              </div>
              <button
                disabled={!beantwortet}
                onClick={() => { if (istLetzte) weiterZuErgebnis(); else setAktuelleFrageIndex((i) => i + 1); }}
                className="btn-primary"
                style={{ padding: "10px 24px", background: beantwortet ? "#64d2b4" : "rgba(255,255,255,0.1)", color: beantwortet ? "#00115a" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: 700, cursor: beantwortet ? "pointer" : "not-allowed" }}
              >
                {istLetzte ? "Auswertung" : "Weiter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- ERGEBNIS ----
  if (phase === "ergebnis" && scoreResult) {
    return (
      <div style={{ minHeight: "100vh", background: "#00115a", fontFamily: "var(--font-rubik), sans-serif" }}>
        {konfliktLeiste}
        <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoLink />
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {kommune && <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{kommune}</span>}
            <span style={{ fontSize: "12px", color: "#64d2b4", fontWeight: 600 }}>{EBENEN[ebene].kurzLabel}</span>
            {kontoLink}
          </div>
        </div>

        <div style={{ maxWidth: "660px", margin: "0 auto", padding: "40px 24px" }}>
          {/* Gesamt-Score */}
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", letterSpacing: "0.06em", marginBottom: "14px" }}>
            Gesamtergebnis
          </h2>
          <div style={{ background: "rgba(160,135,255,0.15)", border: "1px solid rgba(160,135,255,0.35)", borderRadius: "4px", overflow: "hidden", marginBottom: "28px" }}>
            <div style={{ padding: "28px 32px 22px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "44px", fontWeight: 800, color: gesamtFarbe.dot, lineHeight: 1 }}>{scoreResult.prozent}%</span>
                <span style={{ fontSize: "16px", color: "#ffffff", fontWeight: 400 }}>ist Ihr Modernisierungsreifegrad</span>
              </div>
              <div style={{ fontSize: "13px", color: "#ffffff", marginBottom: "6px" }}>
                {scoreResult.gesamtScore} von {scoreResult.maxScore} erreichbaren Punkten
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginBottom: "10px" }}>
                {scoreResult.beantworteteFragen} von {scoreResult.gesamtFragen} Fragen beantwortet
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px" }}>
                <div style={{ height: "100%", width: `${scoreResult.prozent}%`, background: gesamtFarbe.dot, borderRadius: "3px" }} />
              </div>
            </div>
            <button
              onClick={() => setGesamtOffen(o => !o)}
              style={{ width: "100%", padding: "14px 32px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>Gesamteinschätzung</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ transform: gesamtOffen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#ffffff", flexShrink: 0 }}>
                <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {gesamtOffen && (
              <div style={{ padding: "14px 32px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "13px", color: "#ffffff", lineHeight: 1.8 }}>
                  {generiereEinschaetzung(scoreResult)}
                </div>
              </div>
            )}
          </div>

          {/* Bereiche */}
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", letterSpacing: "0.06em", marginBottom: "14px" }}>
            Einschätzung nach Bereichen
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {(Object.keys(KATEGORIEN) as Kategorie[]).map((kat) => {
              const ks = scoreResult.kategorieScores[kat];
              const farbe = getFarbe(ks.prozent);
              const text = erklaerungen[kat];
              const laed = erklaerungLaed[kat];
              const offen = aufgeklappt[kat] ?? false;
              const { beantwortet, gesamt } = ks;
              const alleUebersprungen = beantwortet === 0;
              const teilweiseUebersprungen = beantwortet > 0 && beantwortet < gesamt;

              return (
                <div key={kat} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                  <button
                    onClick={() => setAufgeklappt((p) => ({ ...p, [kat]: !offen }))}
                    style={{ width: "100%", padding: "18px 22px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>{KATEGORIEN[kat].label}</div>
                        {alleUebersprungen && (
                          <div style={{ fontSize: "12px", color: "#ffffff", marginTop: "3px" }}>
                            Keine Fragen beantwortet
                          </div>
                        )}
                        {teilweiseUebersprungen && (
                          <div style={{ fontSize: "12px", color: "#ffffff", marginTop: "3px" }}>
                            {beantwortet} von {gesamt} Fragen beantwortet
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, marginLeft: "16px" }}>
                        {alleUebersprungen ? (
                          <span style={{ fontSize: "12px", color: "#ffffff" }}>keine Auswertung</span>
                        ) : (
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "18px", fontWeight: 800, color: farbe.dot }}>{ks.prozent}%</span>
                            <span style={{ fontSize: "11px", color: "#ffffff", marginLeft: "6px" }}>{ks.score}/{ks.max}</span>
                          </div>
                        )}
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                          style={{ transform: offen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#ffffff", flexShrink: 0 }}>
                          <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    {!alleUebersprungen && (
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                        <div style={{ height: "100%", width: `${ks.prozent}%`, background: farbe.dot, borderRadius: "2px" }} />
                      </div>
                    )}
                  </button>

                  {offen && (
                    <div style={{ padding: "0 22px 18px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ paddingTop: "14px" }}>
                        {alleUebersprungen ? (
                          <div style={{ fontSize: "13px", color: "#ffffff" }}>
                            Fragen nicht beantwortet — keine Auswertung vorliegend.
                          </div>
                        ) : !aiEnabled ? (
                          <div style={{ fontSize: "13px", color: "#ffffff" }}>
                            Ihr Ergebnis beruht auf den beantworteten Fragen. Eine KI-Einschätzung ist hier nicht verfügbar.
                          </div>
                        ) : laed ? (
                          <div style={{ fontSize: "13px", color: "#ffffff", fontStyle: "italic" }}>
                            Einschätzung wird geladen...
                          </div>
                        ) : text ? (
                          <div style={{ fontSize: "13px", color: "#ffffff", lineHeight: 1.75 }}>
                            {text}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation zurück + Export */}
          <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={zurueckZuFragen}
              className="btn-ghost"
              style={{ background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", padding: "10px 16px", fontSize: "13px", color: "#64d2b4", cursor: "pointer" }}
            >
              ← Zurück zu den Reifegradfragen
            </button>
            <button
              disabled={exportLaed}
              onClick={async () => {
                setExportFehler(null);
                setExportLaed(true);
                try { if (stand) await exportiereErgebnis(stand, erklaerungen, produktname); }
                catch { setExportFehler("PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut."); }
                finally { setExportLaed(false); }
              }}
              className="btn-ghost"
              style={{ background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", padding: "10px 16px", fontSize: "13px", color: "#64d2b4", cursor: exportLaed ? "wait" : "pointer", opacity: exportLaed ? 0.6 : 1 }}
            >
              {exportLaed ? "Erstelle PDF…" : "↓ Ergebnis exportieren"}
            </button>
            {speicherKnopf()}
          </div>
          {Object.values(erklaerungLaed).some(Boolean) && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>KI-Erläuterungen werden noch geladen — kurz warten für vollständigen Export.</p>
          )}
          {exportFehler && <p role="alert" style={{ fontSize: "12px", color: "#f87171", marginTop: "8px" }}>{exportFehler}</p>}

          {/* CTA */}
          {aiEnabled ? (
          <div style={{ background: "rgba(160,135,255,0.15)", border: "1px solid rgba(160,135,255,0.3)", borderRadius: "4px", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Jetzt beraten lassen & Maßnahmenkatalog erstellen</div>
              <div style={{ fontSize: "13px", color: "#ffffff", lineHeight: 1.55 }}>Im Sparring mit der KI-Beratung erarbeiten Sie einen konkreten Maßnahmenkatalog — was Sie selbst anstoßen können, was andere braucht und wie Sie beides voranbringen.</div>
            </div>
            <button
              onClick={() => {
                goToPhase("chat");
                beratung.start();
                if (messages.length > 0 && !katalog && !katalogLoading) {
                  void beratung.refreshKatalog(); // returning to chat without katalog
                }
              }}
              className="btn-primary"
              style={{ padding: "12px 22px", background: "#64d2b4", color: "#00115a", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {messages.length > 0 ? "Zurück zur Beratung" : "Zur Beratung"}
            </button>
          </div>
          ) : (
            <p style={{ fontSize: "14px", color: "#ffffff", lineHeight: 1.6 }}>
              Ihre Auswertung ist vollständig. KI-Beratung und Maßnahmenkatalog sind hier nicht aktiviert.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- CHAT ----
  if (phase === "chat") {
    return (
      <div style={{ height: "100vh", background: "#00115a", display: "flex", flexDirection: "column", fontFamily: "var(--font-rubik), sans-serif" }}>
        {konfliktLeiste}
        {/* Header */}
        <div style={{ padding: "12px 32px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <LogoLink />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {kommune && <span className="chat-kopf-detail" style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{kommune}</span>}
            <span className="chat-kopf-detail" style={{ fontSize: "11px", color: "#64d2b4", fontWeight: 600 }}>{EBENEN[ebene].kurzLabel}</span>
            {speicherKnopf(true)}
            {kontoLink}
          </div>
        </div>

        {/* Mobile Tab-Bar */}
        <div className="mobile-tabs" style={{ display: "none", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex" }}>
            {(["chat", "katalog"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  borderBottom: mobileTab === tab ? "2px solid #a087ff" : "2px solid transparent",
                  color: mobileTab === tab ? "#ffffff" : "rgba(255,255,255,0.4)",
                }}
              >
                {tab === "chat" ? "Beratung" : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    Maßnahmen{katalog ? ` (${katalog.massnahmen.length})` : ""}
                    {katalogUpdated && tab === "katalog" && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />}
                    {katalogUpdated && tab !== "katalog" && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1s infinite" }} />}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* Chat Panel */}
          <div className={`chat-panel${mobileTab === "katalog" ? " mobile-hidden" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
              <div style={{ maxWidth: "580px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                {messages.length === 0 && !chatLaed && (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Ihr Maßnahmenkatalog wartet rechts.</p>
                    <p style={{ fontSize: "13px", color: "#ffffff", maxWidth: "320px", margin: "0 auto", lineHeight: 1.6 }}>
                      Im Gespräch verfeinern wir ihn gemeinsam — je mehr ich über Ihre Situation erfahre, desto konkreter werden die Maßnahmen.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => {
                  if (m.role === "assistant") {
                    if (m.rueckfrage) {
                      const { frage, optionen } = m.rueckfrage;
                      const istLetzte = i === messages.length - 1;
                      const intro = einleitung(m);
                      const bubble = (children: React.ReactNode) => (
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <HexAvatar />
                          <div style={{ maxWidth: "85%", padding: "10px 14px", background: "rgba(160,135,255,0.12)", border: "1px solid rgba(160,135,255,0.5)", borderRadius: "4px 12px 12px 12px", color: "#ffffff", fontSize: "12px", lineHeight: 1.6 }}>
                            {children}
                          </div>
                        </div>
                      );
                      const fadeIn = { animation: "msgFadeIn 0.2s ease both" };
                      return (
                        <React.Fragment key={i}>
                          {intro && <div style={fadeIn}>{bubble(<div className="prose prose-sm" style={{ maxWidth: "none", fontSize: "12px", lineHeight: 1.6 }}><ReactMarkdown>{intro}</ReactMarkdown></div>)}</div>}
                          <div style={{ ...fadeIn, animationDelay: intro ? "0.1s" : "0s" }}>{bubble(
                            <>
                              <p style={{ fontWeight: 600, margin: "0 0 10px" }}>{frage.trim()}</p>
                              {istLetzte && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {optionen.map((opt, oi) => (
                                    <button key={oi} onClick={() => sendMessage(opt)} className="btn-chip"
                                      style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", fontSize: "13px", color: "#ffffff", cursor: "pointer", textAlign: "left" }}>
                                      {opt}
                                    </button>
                                  ))}
                                  <input placeholder="Oder eigene Antwort eingeben…" maxLength={MAX_EINGABE}
                                    onKeyDown={(e) => { if (e.key === "Enter") { sendMessage((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }}
                                    style={{ marginTop: "4px", padding: "8px 12px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "4px", fontSize: "13px", fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff", background: "transparent", outline: "none" }} />
                                </div>
                              )}
                            </>
                          )}</div>
                        </React.Fragment>
                      );
                    }
                  }
                  return (
                  <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: "10px", alignItems: "flex-start" }}>
                    {m.role === "assistant" && <HexAvatar />}
                    <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px", background: m.role === "user" ? "rgba(255,255,255,0.15)" : "rgba(160,135,255,0.12)", color: "#ffffff", fontSize: "12px", lineHeight: 1.6, border: m.role === "user" ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(160,135,255,0.5)" }}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm" style={{ maxWidth: "none", fontSize: "12px", lineHeight: 1.6 }}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : m.content}
                    </div>
                  </div>
                  );
                })}
                {chatLaed && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <HexAvatar />
                    <div style={{ maxWidth: "85%", padding: "10px 14px", background: "rgba(160,135,255,0.12)", border: "1px solid rgba(160,135,255,0.5)", borderRadius: "4px 12px 12px 12px", color: "#ffffff", fontSize: "12px", lineHeight: 1.6 }}>
                      {(() => {
                        return displayedStream ? (
                        <div className="prose prose-sm" style={{ maxWidth: "none", fontSize: "12px", lineHeight: 1.6 }}>
                          <ReactMarkdown>{displayedStream}</ReactMarkdown>
                        </div>
                        ) : (
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "2px 0" }}>
                          {[0, 1, 2].map((i) => (
                            <svg key={i} width="10" height="11" viewBox="0 0 10 11" fill="none" style={{ animation: `hexBounce 1.2s ease-in-out infinite ${i * 0.18}s` }}>
                              <path d="M5 0.5 L9.33 2.75 L9.33 7.25 L5 9.5 L0.67 7.25 L0.67 2.75 Z" fill="#a087ff" opacity="0.85" />
                            </svg>
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {!chatLaed && (() => {
              const letzteAssistentMsg = [...messages].reverse().find(m => m.role === "assistant");
              const istRueckfrage = letzteAssistentMsg?.rueckfrage;
              if (istRueckfrage) return null;

              const anzahl = messages.filter(m => m.role === "user").length;
              let vorschlaege: string[] = [];
              if (anzahl === 0) {
                vorschlaege = [
                  "Womit sollte ich anfangen?",
                  "Was kann ich in meiner Position heute schon tun?",
                  "Wie überzeuge ich meine Leitung?",
                ];
              } else if (anzahl <= 2) {
                vorschlaege = [
                  "Was kann ich konkret diese Woche angehen?",
                  "Wozu kann ich andere in meiner Verwaltung bewegen?",
                  "Gibt es ähnliche Kommunen von denen ich lernen kann?",
                ];
              } else if (anzahl <= 5) {
                vorschlaege = [
                  "Schreibe mir einen Maßnahmenkatalog",
                  "Gibt es bereits umgesetzte Lösungen die ich nachnutzen kann?",
                  "Wie erkenne ich ob eine Maßnahme wirklich wirkt?",
                ];
              } else {
                vorschlaege = [
                  "Was haben wir noch nicht besprochen?",
                  "Wie priorisiere ich bei knappen Ressourcen?",
                  "Wie nehme ich mein Team mit bei Veränderungen?",
                ];
              }

              return (
                <div style={{ padding: "0 16px 8px" }}>
                  <div style={{ maxWidth: "580px", margin: "0 auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {vorschlaege.map((v, vi) => (
                      <button key={v} onClick={() => sendMessage(v)} className={`btn-chip${vi > 0 ? " suggestion-extra" : ""}`} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px", fontSize: "12px", color: "#ffffff", cursor: "pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ padding: "10px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ maxWidth: "580px", margin: "0 auto", display: "flex", gap: "8px" }}>
                <button
                  onClick={() => goToPhase("ergebnis")}
                  className="btn-ghost"
                  style={{ padding: "10px 14px", background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", color: "#64d2b4", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}
                >
                  ← Zurück
                </button>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Frage stellen..."
                  maxLength={MAX_EINGABE}
                  style={{ flex: 1, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", fontSize: "13px", background: "rgba(255,255,255,0.07)", outline: "none", color: "#ffffff" }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || chatLaed}
                  className="btn-primary"
                  style={{ padding: "10px 18px", background: chatInput.trim() && !chatLaed ? "#64d2b4" : "rgba(255,255,255,0.1)", color: chatInput.trim() && !chatLaed ? "#00115a" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: 700, cursor: chatInput.trim() && !chatLaed ? "pointer" : "not-allowed" }}
                >
                  →
                </button>
              </div>
            </div>
          </div>

          {/* Resize Handle (Desktop only) */}
          <div
            className="resize-handle"
            onMouseDown={onResizeMouseDown}
            style={{ width: "5px", flexShrink: 0, cursor: "col-resize", background: "rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(160,135,255,0.3)")}
            onMouseLeave={e => { if (!resizingRef.current) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          />

          {/* Katalog Panel */}
          <div className={`katalog-panel${mobileTab === "chat" ? " mobile-hidden" : ""}`} style={{ width: `${katalogWidth}px`, flexShrink: 0, background: "#ffffff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <KatalogSidebar
              katalog={katalog}
              loading={katalogLoading}
              katalogRevision={katalogRevision}
              onAktualisieren={() => { void beratung.refreshKatalog(); }}
              error={katalogError}
              chatHasMessages={messages.length > 0}
              exportLaed={exportLaed}
              onExportieren={stand ? async () => {
                setExportFehler(null);
                setExportLaed(true);
                try { await exportiereVollbericht(stand, erklaerungen, produktname); }
                catch { setExportFehler("PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut."); }
                finally { setExportLaed(false); }
              } : undefined}
            />
          </div>
        </div>

        <style>{`
          @keyframes msgFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
          @keyframes hexBounce { 0%, 60%, 100% { transform: translateY(0) scale(1); opacity: 0.5; } 30% { transform: translateY(-7px) scale(1.15); opacity: 1; } }
          @keyframes hexOrbit3d { from { transform: rotateX(58deg) rotateZ(0deg); } to { transform: rotateX(58deg) rotateZ(-360deg); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          .prose-sm, .prose-sm p, .prose-sm li, .prose-sm ul, .prose-sm ol,
          .prose-sm h1, .prose-sm h2, .prose-sm h3, .prose-sm strong, .prose-sm em { color: #ffffff !important; font-size: 12px !important; line-height: 1.6 !important; }
          .prose-sm p { margin: 0 0 5px !important; }
          .prose-sm ul { margin: 5px 0 !important; padding-left: 18px !important; }
          .prose-sm li { margin-bottom: 3px !important; }
          .prose-sm strong { font-weight: 700 !important; }
          @media (max-width: 767px) {
            .mobile-tabs { display: block !important; position: sticky !important; top: 0 !important; z-index: 20 !important; }
            .katalog-panel { width: 100% !important; border-left: none !important; }
            .mobile-hidden { display: none !important; }
            .suggestion-extra { display: none !important; }
            .resize-handle { display: none !important; }
            .chat-kopf-detail { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
