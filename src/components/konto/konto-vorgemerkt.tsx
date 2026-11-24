"use client";

import { useState } from "react";
import { kontoBrowser, formatiereDatum } from "@/lib/konto-browser";
import { Seitenkopf } from "./seitenkopf";
import { AbmeldenKnopf } from "./abmelden";
import * as stil from "./stil";

export function KontoVorgemerkt({ email, endgueltigAm }: { email: string; endgueltigAm: string }) {
  const [laed, setLaed] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function wiederherstellen() {
    setLaed(true);
    setFehler(null);
    try {
      await kontoBrowser.stelleWiederHer();
      window.location.reload();
    } catch {
      setLaed(false);
      setFehler("Das Konto konnte nicht wiederhergestellt werden. Bitte versuchen Sie es erneut.");
    }
  }

  return (
    <div style={stil.seite}>
      <Seitenkopf><AbmeldenKnopf /></Seitenkopf>
      <div style={{ ...stil.inhalt, maxWidth: "560px" }}>
        <h1 style={stil.titel}>Ihr Konto ist zur Löschung vorgemerkt</h1>
        <p style={{ ...stil.text, margin: "12px 0 24px" }}>
          Das Konto {email} und alle gespeicherten Bewertungen werden am {formatiereDatum(endgueltigAm)} endgültig gelöscht.
          Bis dahin können Sie es mit allen Daten wiederherstellen.
        </p>
        <button type="button" onClick={() => void wiederherstellen()} disabled={laed} className="btn-primary" style={{ ...stil.knopfPrimaer, opacity: laed ? 0.6 : 1 }}>
          {laed ? "Wird wiederhergestellt…" : "Konto wiederherstellen"}
        </button>
        {fehler && <p role="alert" style={stil.fehlerText}>{fehler}</p>}
        <p style={{ ...stil.klein, marginTop: "24px" }}>
          Den Modernisierungs-Check können Sie jederzeit <a href="/check" style={stil.textLink}>ohne Anmeldung nutzen</a>.
        </p>
      </div>
    </div>
  );
}
