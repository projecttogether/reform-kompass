"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { BewertungStand } from "@/lib/bewertung";
import type { Katalog } from "@/lib/massnahmenkatalog";
import { createBeratung } from "@/lib/beratung";
import { beratungHttp } from "@/lib/beratung-http";

function restore(beratung: ReturnType<typeof createBeratung>, initial: BewertungStand, aiEnabled: boolean) {
  const auswertung = initial.phase === "ergebnis" || initial.phase === "chat";
  beratung.restoreKontext({ ...initial.kontext, orgTyp: "Kommune", antworten: initial.antworten }, initial.nachrichten, auswertung ? initial.katalog : null, auswertung && aiEnabled);
  if (initial.phase === "chat") beratung.start();
}

export function useBeratung(initial?: BewertungStand, aiEnabled = false) {
  const [start] = useState(initial);
  const [beratung] = useState(() => {
    const b = createBeratung(beratungHttp);
    if (initial) restore(b, initial, false);
    return b;
  });
  const stand = useSyncExternalStore(beratung.subscribe, beratung.getSnapshot, beratung.getSnapshot);
  const [abgelaufen, setAbgelaufen] = useState<Katalog | null>(null);
  useEffect(() => () => beratung.cancel(), [beratung]);
  useEffect(() => { if (start) restore(beratung, start, aiEnabled); }, [beratung, start, aiEnabled]);
  useEffect(() => {
    if (!stand.katalogRevision || !stand.katalog) return;
    const timer = setTimeout(() => setAbgelaufen(stand.katalog), 4000);
    return () => clearTimeout(timer);
  }, [stand.katalogRevision, stand.katalog]);
  return { beratung, ...stand, katalogUpdated: stand.katalogRevision > 0 && stand.katalog !== abgelaufen, streamContent: stand.streamContent };
}
