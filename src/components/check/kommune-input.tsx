"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import kommunenDaten from "@/data/kommunen.json";
import { anzeigeText, kreisAnzeige, nameAnzeige, type Kommune as Eintrag } from "@/lib/kommunen";

const KOMMUNEN = kommunenDaten as Eintrag[];
const ANZEIGETEXTE = new Set(KOMMUNEN.map(anzeigeText));

function normalize(s: string) {
  return s.toLowerCase().replace(/,\s*/g, " ").trim();
}

function sucheKommunen(query: string, max = 8): Eintrag[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const results: Eintrag[] = [];
  for (const k of KOMMUNEN) {
    if (normalize(k.name).includes(q)) {
      results.push(k);
      if (results.length >= max) break;
    }
  }
  return results;
}

type Grunddaten = { gefunden: true; kurzfassung: string; quelle: string } | { gefunden: false };

// Zeigt die amtlichen Grunddaten, die die Beratung zur gewählten Gemeinde verwendet.
function GrunddatenHinweis({ value }: { value: string }) {
  const gewaehlt = ANZEIGETEXTE.has(value);
  const [daten, setDaten] = useState<{ name: string; grunddaten: Grunddaten } | null>(null);

  useEffect(() => {
    if (!gewaehlt) return;
    const abbruch = new AbortController();
    fetch(`/api/kommunaldaten?name=${encodeURIComponent(value)}`, { signal: abbruch.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((grunddaten: Grunddaten | null) => { if (grunddaten) setDaten({ name: value, grunddaten }); })
      .catch(() => {});
    return () => abbruch.abort();
  }, [value, gewaehlt]);

  const stil: React.CSSProperties = { fontSize: "12px", lineHeight: 1.5, color: "rgba(255,255,255,0.6)", margin: "6px 0 0" };
  if (!value.trim()) return null;
  if (!gewaehlt) {
    return <p style={stil}>Für diese Eingabe liegen keine amtlichen Grunddaten vor. Für eine Gemeinde wählen Sie bitte einen Eintrag aus der Liste.</p>;
  }
  if (daten?.name !== value || !daten.grunddaten.gefunden) return null;
  return <p style={stil}>Amtliche Grunddaten für die Beratung: {daten.grunddaten.kurzfassung} ({daten.grunddaten.quelle})</p>;
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Zeigt unter dem Feld, welche amtlichen Grunddaten die Beratung verwendet. */
  zeigeGrunddaten?: boolean;
}

export function KommuneInput({ id, value, onChange, zeigeGrunddaten = false }: Props) {
  const query = value;
  const listId = useId();
  const [offen, setOffen] = useState(false);
  const [treffer, setTreffer] = useState<Eintrag[]>([]);
  const [fokus, setFokus] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suche = useCallback((q: string) => {
    onChange(q);
    const ergebnisse = sucheKommunen(q);
    setTreffer(ergebnisse);
    setOffen(ergebnisse.length > 0);
    setFokus(-1);
  }, [onChange]);

  function waehle(eintrag: Eintrag) {
    const text = anzeigeText(eintrag);
    onChange(text);
    setOffen(false);
    setTreffer([]);
    setFokus(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!offen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFokus(f => Math.min(f + 1, treffer.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFokus(f => Math.max(f - 1, -1)); }
    else if (e.key === "Enter" && fokus >= 0) { e.preventDefault(); waehle(treffer[fokus]); }
    else if (e.key === "Escape") { setOffen(false); setFokus(-1); }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: offen && treffer.length > 0 ? "4px 4px 0 0" : "4px",
    fontSize: "14px", fontFamily: "var(--font-rubik), sans-serif",
    color: "#ffffff", outline: "none", boxSizing: "border-box",
    background: "rgba(255,255,255,0.08)",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        maxLength={300}
        type="text"
        value={query}
        onChange={(e) => suche(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (treffer.length > 0) setOffen(true); }}
        placeholder="z. B. Münster, Landkreis Oder-Spree, Flensburg"
        autoComplete="off"
        style={inputStyle}
        aria-autocomplete="list"
        aria-expanded={offen && treffer.length > 0}
        aria-controls={offen && treffer.length > 0 ? listId : undefined}
        aria-activedescendant={offen && fokus >= 0 ? `${listId}-${fokus}` : undefined}
        onBlur={() => { setOffen(false); setFokus(-1); }}
      />
      {offen && treffer.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Kommunen"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
            background: "#001a7a", border: "1px solid rgba(255,255,255,0.2)",
            borderTop: "none", borderRadius: "0 0 4px 4px",
            margin: 0, padding: "4px 0", listStyle: "none",
            maxHeight: "220px", overflowY: "auto",
          }}
        >
          {treffer.map((k, i) => {
            const kreis = kreisAnzeige(k);
            return (
              <li
                key={anzeigeText(k)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === fokus}
                onMouseDown={() => waehle(k)}
                style={{
                  padding: "9px 14px",
                  cursor: "pointer",
                  background: i === fokus ? "rgba(100,210,180,0.15)" : "transparent",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                }}
                onMouseEnter={() => setFokus(i)}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "14px", color: "#ffffff" }}>{nameAnzeige(k)}</span>
                  {kreis && (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{kreis}</span>
                  )}
                </div>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{k.bundesland}</span>
              </li>
            );
          })}
        </ul>
      )}
      {zeigeGrunddaten && !offen && <GrunddatenHinweis value={value} />}
    </div>
  );
}
