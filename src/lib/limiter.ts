// Fixed-window counter. When capacity is exhausted, refuse new identities rather
// than evicting active counters, which would let identity churn reset a limit.
export function erstelleLimiter(jetzt: () => number = Date.now, maxEintraege = 10_000) {
  const fenster = new Map<string, { bis: number; anzahl: number }>();
  return {
    zaehle(schluessel: string, grenze: { max: number; fensterMs: number }): number | null {
      const t = jetzt();
      const aktuell = fenster.get(schluessel);
      if (aktuell && t < aktuell.bis) {
        if (aktuell.anzahl >= grenze.max) return Math.max(1, Math.ceil((aktuell.bis - t) / 1000));
        aktuell.anzahl++;
        return null;
      }
      if (fenster.size >= maxEintraege) {
        let fruehestesEnde = Infinity;
        for (const [k, v] of fenster) {
          if (t >= v.bis) fenster.delete(k);
          else fruehestesEnde = Math.min(fruehestesEnde, v.bis);
        }
        if (fenster.size >= maxEintraege) return Math.max(1, Math.ceil((fruehestesEnde - t) / 1000));
      }
      fenster.set(schluessel, { bis: t + grenze.fensterMs, anzahl: 1 });
      return null;
    },
    zuruecksetzen() { fenster.clear(); },
  };
}
