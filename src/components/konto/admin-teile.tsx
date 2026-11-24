import type { CSSProperties, ReactNode } from "react";
import { Seitenkopf } from "./seitenkopf";
import * as stil from "./stil";

export const zelle: CSSProperties = { padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", textAlign: "left", verticalAlign: "top" };
export const kopfzelle: CSSProperties = { ...zelle, fontWeight: 600, color: stil.farben.gedimmt, whiteSpace: "nowrap" };

export function AdminRahmen({ email, zurueck, children }: { email: string; zurueck?: { href: string; text: string }; children: ReactNode }) {
  return (
    <div style={stil.seite}>
      <Seitenkopf>
        <span style={{ fontSize: "12px", fontWeight: 700, color: stil.farben.lila, letterSpacing: "0.06em" }}>VERWALTUNG</span>
        <span style={stil.klein}>{email}</span>
        <a href="/konto" className="btn-text" style={stil.textLink}>Mein Bereich</a>
      </Seitenkopf>
      <div style={{ ...stil.inhalt, maxWidth: "1040px" }}>
        {zurueck && <a href={zurueck.href} className="btn-text" style={{ ...stil.textLink, display: "inline-block", marginBottom: "16px" }}>← {zurueck.text}</a>}
        {children}
      </div>
    </div>
  );
}

export { AktionKnopf } from "./aktion-knopf";
