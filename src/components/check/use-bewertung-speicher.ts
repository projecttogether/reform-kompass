"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { BewertungStand } from "@/lib/bewertung";
import { createBewertungSpeicher } from "@/lib/bewertung-speicher";
import { kontoBrowser } from "@/lib/konto-browser";
import { authClient } from "@/lib/auth-client";

/**
 * React binding for the auto-save in `bewertung-speicher.ts`: hands it the tab's
 * current state and the page's visibility, and renders its status.
 */
export function useBewertungSpeicher(stand: BewertungStand | null, optionen: { aktiv: boolean; pausiert: boolean }) {
  const [speicher] = useState(() => createBewertungSpeicher(kontoBrowser));
  const zustand = useSyncExternalStore(speicher.subscribe, speicher.getSnapshot, speicher.getSnapshot);
  const { aktiv, pausiert } = optionen;

  useEffect(() => { speicher.aktualisiere(stand, { aktiv, pausiert }); }, [speicher, stand, aktiv, pausiert]);

  useEffect(() => {
    if (!aktiv) return;
    // The browser's session check keeps the rolling 30-day session cookie fresh.
    void authClient.getSession();
    // Hiding the page sends pending changes at once; showing it again retries a failed save.
    const sichtbarkeit = () => { if (document.visibilityState === "visible") speicher.nachholen(); else speicher.sendeSofort(); };
    document.addEventListener("visibilitychange", sichtbarkeit);
    return () => document.removeEventListener("visibilitychange", sichtbarkeit);
  }, [speicher, aktiv]);

  // Leaving /check within the app: send what the debounce had not sent yet.
  useEffect(() => () => speicher.beende(), [speicher]);

  return { ...zustand, verknuepfe: speicher.verknuepfe, pruefeUndVerknuepfe: speicher.pruefeUndVerknuepfe, erstelle: speicher.erstelle };
}
