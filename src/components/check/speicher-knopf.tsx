"use client";

import type { CSSProperties } from "react";
import type { SpeicherStatus } from "@/lib/bewertung-speicher";

const NACH_ANMELDUNG = `/anmelden?weiter=${encodeURIComponent("/check?speichern=1")}`;

/** Save button or save status for /check. Renders nothing when accounts are disabled. */
export function SpeicherKnopf(props: {
  kontenAktiv: boolean;
  angemeldet: boolean;
  darfSpeichern: boolean;
  bewertungId: string | null;
  status: SpeicherStatus;
  onSpeichern: () => void;
  kompakt?: boolean;
}) {
  const { kontenAktiv, angemeldet, darfSpeichern, bewertungId, status, onSpeichern, kompakt } = props;
  if (!kontenAktiv || (angemeldet && !darfSpeichern)) return null;
  const knopf: CSSProperties = {
    background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", color: "#64d2b4", cursor: "pointer",
    padding: kompakt ? "6px 12px" : "10px 16px", fontSize: kompakt ? "12px" : "13px", textDecoration: "none", display: "inline-block", fontFamily: "inherit",
  };
  const hinweis: CSSProperties = { fontSize: kompakt ? "11px" : "12px", color: "rgba(255,255,255,0.75)" };

  // The page shows a conflict bar with a link to the saved version.
  if (bewertungId && status === "konflikt") return <span style={{ ...hinweis, color: "#fbbf24" }}>Nicht gespeichert</span>;
  const voll = (
    <span role="alert" style={{ ...hinweis, color: "#f87171" }}>
      Speicherplatz für Bewertungen erschöpft. Ältere löschen in <a href="/konto" style={{ color: "#64d2b4", textDecoration: "none" }}>Mein Bereich</a>
    </span>
  );
  if (bewertungId) {
    if (status === "speichert") return <span role="status" style={hinweis}>Wird gespeichert…</span>;
    if (status === "fehler") return <span role="alert" style={{ ...hinweis, color: "#f87171" }}>Speichern fehlgeschlagen</span>;
    if (status === "voll") return kompakt ? <span role="alert" style={{ ...hinweis, color: "#f87171" }}>Speicherplatz voll</span> : voll;
    // The compact header already links to the member area.
    if (kompakt) return <span role="status" style={hinweis}>✓ Gespeichert</span>;
    return (
      <span role="status" style={hinweis}>
        ✓ Gespeichert in <a href="/konto" style={{ color: "#64d2b4", textDecoration: "none" }}>Mein Bereich</a>
      </span>
    );
  }
  if (!angemeldet) {
    return <a href={NACH_ANMELDUNG} className="btn-ghost" style={knopf}>Speichern</a>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      <button type="button" onClick={onSpeichern} disabled={status === "speichert"} className="btn-ghost" style={{ ...knopf, opacity: status === "speichert" ? 0.6 : 1 }}>
        {status === "speichert" ? "Wird gespeichert…" : "Speichern"}
      </button>
      {status === "fehler" && <span role="alert" style={{ ...hinweis, color: "#f87171" }}>Speichern fehlgeschlagen</span>}
      {status === "voll" && voll}
    </span>
  );
}
