import type { CSSProperties } from "react";

// Shared inline styles for the member and admin pages, matching /check.
export const farben = { blau: "#00115a", mint: "#64d2b4", lila: "#a087ff", rot: "#f87171", gedimmt: "rgba(255,255,255,0.65)" };

export const seite: CSSProperties = { minHeight: "100vh", background: farben.blau, fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff" };
export const inhalt: CSSProperties = { maxWidth: "820px", margin: "0 auto", padding: "32px 24px 64px" };
export const titel: CSSProperties = { fontSize: "clamp(22px, 4vw, 28px)", fontFamily: "var(--font-fraunces), serif", fontWeight: 400, lineHeight: 1.3, margin: "0 0 8px" };
export const abschnittTitel: CSSProperties = { fontSize: "14px", fontWeight: 600, letterSpacing: "0.06em", margin: "0 0 14px" };
export const karte: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "20px 22px" };
export const text: CSSProperties = { fontSize: "14px", lineHeight: 1.6, margin: 0 };
export const klein: CSSProperties = { fontSize: "12px", color: farben.gedimmt, lineHeight: 1.5 };
export const eingabe: CSSProperties = { width: "100%", padding: "11px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", fontSize: "14px", fontFamily: "var(--font-rubik), sans-serif", color: "#ffffff", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.08)" };
export const label: CSSProperties = { display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px" };
export const knopfPrimaer: CSSProperties = { padding: "11px 20px", background: farben.mint, color: farben.blau, border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", fontFamily: "inherit" };
export const knopfRahmen: CSSProperties = { padding: "9px 16px", background: "none", border: "1px solid rgba(100,210,180,0.5)", borderRadius: "4px", color: farben.mint, fontSize: "13px", cursor: "pointer", textDecoration: "none", display: "inline-block", fontFamily: "inherit" };
export const knopfGefahr: CSSProperties = { ...knopfRahmen, border: "1px solid rgba(248,113,113,0.6)", color: farben.rot };
export const textLink: CSSProperties = { color: farben.mint, textDecoration: "none", fontSize: "13px" };
export const fehlerText: CSSProperties = { fontSize: "13px", color: farben.rot, margin: "8px 0 0" };
