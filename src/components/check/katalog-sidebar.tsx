"use client";

import { useEffect, useState } from "react";

const GEDANKEN = [
  "Lese Ihre Reifegradbewertung …",
  "Identifiziere Stärken und Entwicklungsfelder …",
  "Prüfe Handlungsspielräume Ihrer Verwaltung …",
  "Priorisiere Maßnahmen nach Wirkungshebel …",
  "Unterscheide eigen umsetzbare von externen Maßnahmen …",
  "Schätze Aufwand und Realisierbarkeit ein …",
  "Formuliere konkrete Handlungsempfehlungen …",
  "Verteile Maßnahmen auf die Modernisierungsbereiche …",
  "Überprüfe Vollständigkeit und Stimmigkeit …",
  "Finalisiere den Katalog …",
];
import { gruppiereKatalog, type Katalog } from "@/lib/massnahmenkatalog";

const GRUPPEN_FARBEN = {
  "eigen-niedrig": { bg: "#f0fdf4", border: "#bbf7d0", badge: "#dcfce7", badgeText: "#166534" },
  "eigen-hoch": { bg: "#eff6ff", border: "#bfdbfe", badge: "#dbeafe", badgeText: "#1e40af" },
  "fremd-niedrig": { bg: "#fffbeb", border: "#fde68a", badge: "#fef3c7", badgeText: "#92400e" },
  "fremd-hoch": { bg: "#fff7ed", border: "#fed7aa", badge: "#ffedd5", badgeText: "#9a3412" },
};

function KatalogLadeanzeige() {
  const [gedankeIdx, setGedankeIdx] = useState(0);
  const [gedankeFade, setGedankeFade] = useState(true);
  useEffect(() => {
    let index = 0;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      if (index >= GEDANKEN.length - 1) { clearInterval(timer); return; }
      setGedankeFade(false);
      fadeTimer = setTimeout(() => {
        setGedankeIdx(++index);
        setGedankeFade(true);
      }, 900);
    }, 3000);
    return () => { clearInterval(timer); clearTimeout(fadeTimer); };
  }, []);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "18px" }}>
        {[0, 1, 2].map((i) => (
          <svg key={i} width="14" height="16" viewBox="0 0 14 16" fill="none" style={{ animation: `hexBounce 1.2s ease-in-out infinite ${i * 0.18}s` }}>
            <path d="M7 0.5 L13.06 3.75 L13.06 10.25 L7 13.5 L0.94 10.25 L0.94 3.75 Z" fill="#a087ff" />
          </svg>
        ))}
      </div>
      <p style={{ fontSize: "14px", color: "rgba(0,18,90,0.7)", fontWeight: 500, marginBottom: "10px" }}>Maßnahmenkatalog wird erstellt…</p>
      <p style={{ fontSize: "12px", transition: "opacity 1s ease", opacity: gedankeFade ? 1 : 0, maxWidth: "220px", lineHeight: 1.5, background: "linear-gradient(90deg, rgba(0,18,90,0.28) 0%, rgba(0,18,90,0.28) 20%, rgba(0,18,90,0.6) 50%, rgba(0,18,90,0.28) 80%, rgba(0,18,90,0.28) 100%)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "textWelle 2.4s ease-in-out infinite" }}>{GEDANKEN[gedankeIdx]}</p>
      <style>{`
        @keyframes hexBounce { 0%, 60%, 100% { transform: translateY(0) scale(1); opacity: 0.5; } 30% { transform: translateY(-8px) scale(1.2); opacity: 1; } }
        @keyframes textWelle { 0% { background-position: 150% 0; } 100% { background-position: -50% 0; } }
        .katalog-btn-ghost { transition: background 0.15s, border-color 0.15s; }
        .katalog-btn-ghost:hover { background: rgba(100,210,180,0.1) !important; }
      `}</style>
    </div>
  );
}

type KatalogSidebarProps = {
  katalog: Katalog | null;
  loading: boolean;
  katalogRevision: number;
  onAktualisieren: () => void;
  chatHasMessages: boolean;
  error: string | null;
  onExportieren?: () => void;
  exportLaed?: boolean;
};

export function KatalogSidebar(props: KatalogSidebarProps) {
  return <KatalogInhalt key={props.katalog?.version ?? "leer"} {...props} />;
}

function KatalogInhalt({ katalog, loading, katalogRevision, onAktualisieren, chatHasMessages, error, onExportieren, exportLaed }: KatalogSidebarProps) {
  const [aufgeklapptM, setAufgeklapptM] = useState<Record<number, boolean>>({});

  if (loading && !katalog) return <KatalogLadeanzeige />;

  if (!katalog) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
        <p role={error ? "alert" : undefined} style={{ fontSize: "14px", color: "rgba(0,18,90,0.55)" }}>{error ?? "Noch kein Maßnahmenkatalog vorhanden."}</p>
        {error && <button onClick={onAktualisieren} style={{ marginTop: "12px", fontSize: "13px", textDecoration: "underline" }}>Erneut versuchen</button>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Katalog-Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#00125A", margin: 0 }}>Maßnahmenkatalog</p>
            <p style={{ fontSize: "11px", color: "rgba(0,18,90,0.38)", margin: 0 }}>{katalog.massnahmen.length} Maßnahmen</p>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {loading ? (
              <span style={{ fontSize: "11px", color: "rgba(0,18,90,0.45)", display: "flex", alignItems: "center", gap: "5px" }}>
                <svg width="10" height="11" viewBox="0 0 10 11" fill="none" style={{ animation: "hexBounce 1.2s ease-in-out infinite" }}>
                  <path d="M5 0.5 L9.33 2.75 L9.33 7.25 L5 9.5 L0.67 7.25 L0.67 2.75 Z" fill="#a087ff" opacity="0.85" />
                </svg>
                Wird aktualisiert…
              </span>
            ) : chatHasMessages && (
              <button onClick={onAktualisieren} className="katalog-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "6px", background: "#fff", cursor: "pointer", color: "#00875A" }}>
                ↺ Aktualisieren
              </button>
            )}
            {onExportieren && (
              <button disabled={exportLaed || loading} onClick={onExportieren} className="katalog-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "6px", background: "#fff", cursor: (exportLaed || loading) ? "wait" : "pointer", color: "#00875A", opacity: (exportLaed || loading) ? 0.6 : 1 }}>
                {exportLaed ? "Erstelle PDF…" : "↓ Exportieren"}
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "rgba(0,18,90,0.38)", lineHeight: 1.5, margin: "0 0 4px" }}>{katalog.disclaimer}</p>
        <p style={{ fontSize: "11px", color: "rgba(0,18,90,0.38)", margin: 0 }}>
          Version {katalogRevision}{katalogRevision <= 1 ? ", erstellt" : ", aktualisiert"} {new Date(katalog.erstellt_am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr
        </p>
        {error && <p role="alert" style={{ fontSize: "12px", color: "#b91c1c" }}>{error}</p>}
      </div>

      {/* Gruppen */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {gruppiereKatalog(katalog).map((g) => {
          const ms = g.massnahmen;
          const farben = GRUPPEN_FARBEN[g.id];
          if (!ms.length) return null;
          return (
            <div key={g.label} style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,18,90,0.7)", letterSpacing: "0.01em" }}>{g.label}</span>
                <span style={{ fontSize: "10px", background: "#edf0f7", color: "rgba(0,18,90,0.55)", borderRadius: "10px", padding: "1px 6px" }}>{ms.length}</span>
              </div>
              {ms.map((m, idx) => {
                const globalIdx = katalog.massnahmen.indexOf(m);
                const open = !!aufgeklapptM[globalIdx];
                return (
                  <div key={idx} style={{ border: `1px solid ${farben.border}`, borderRadius: "8px", padding: "10px 12px", marginBottom: "8px", background: farben.bg }}>
                    <button
                      onClick={() => setAufgeklapptM((p) => ({ ...p, [globalIdx]: !p[globalIdx] }))}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, marginTop: "2px", color: "rgba(0,18,90,0.38)", fontSize: "12px" }}>{open ? "▾" : "▸"}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#00125A", display: "block", lineHeight: 1.4 }}>{m.titel}</span>
                          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: farben.badge, color: farben.badgeText, fontWeight: 600, marginTop: "4px", display: "inline-block" }}>{m.bereich}</span>
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div style={{ marginTop: "8px", paddingLeft: "20px" }}>
                        <p style={{ fontSize: "12px", color: "#1a2e5a", lineHeight: 1.6, margin: "0 0 6px" }}>{m.beschreibung}</p>
                        {m.verantwortung === "fremd" && (
                          <>
                            {m.wer && <p style={{ fontSize: "11px", color: "rgba(0,18,90,0.55)", margin: "4px 0" }}><strong style={{ color: "#1a2e5a" }}>Entscheidet:</strong> {m.wer}</p>}
                            {m.eigener_beitrag && <p style={{ fontSize: "11px", color: "rgba(0,18,90,0.55)", margin: "4px 0" }}><strong style={{ color: "#1a2e5a" }}>Ihr Beitrag:</strong> {m.eigener_beitrag}</p>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

