import type { ReactNode } from "react";
import { LogoLink } from "@/components/marke";

/** Logo bar shared by the member and admin pages. */
export function Seitenkopf({ children }: { children?: ReactNode }) {
  return (
    <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <LogoLink />
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

/** Header link to sign in or to the member area, shown only when accounts are enabled. */
export function KontoLink({ angemeldet, weiter }: { angemeldet: boolean; weiter?: string }) {
  const href = angemeldet ? "/konto" : `/anmelden${weiter ? `?weiter=${encodeURIComponent(weiter)}` : ""}`;
  return (
    <a href={href} className="btn-text" style={{ fontSize: "13px", color: "#64d2b4", textDecoration: "none", fontWeight: 600 }}>
      {angemeldet ? "Mein Bereich" : "Anmelden"}
    </a>
  );
}
