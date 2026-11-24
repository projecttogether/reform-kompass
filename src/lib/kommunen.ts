// Gemeinsame Darstellung der Kommunen aus dem Destatis-Gemeindeverzeichnis.
// Der Anzeigetext ist zugleich der Schlüssel, über den der Server die Grunddaten findet.

export interface Kommune {
  name: string;
  bundesland: string;
  kreis: string;
  /** Nur bei gleichnamigen Gemeinden im selben Kreis, z. B. "Amt Landhagen". */
  zusatz?: string;
}

export function kreisAnzeige(kommune: Kommune): string {
  // Kreisfreie Städte haben kreis === name — redundant, nicht anzeigen
  if (!kommune.kreis || kommune.kreis === kommune.name) return "";
  return kommune.kreis;
}

export function nameAnzeige(kommune: Kommune): string {
  return kommune.zusatz ? `${kommune.name} (${kommune.zusatz})` : kommune.name;
}

export function anzeigeText(kommune: Kommune): string {
  const kreis = kreisAnzeige(kommune);
  if (kreis) return `${nameAnzeige(kommune)}, ${kreis} (${kommune.bundesland})`;
  return `${nameAnzeige(kommune)} (${kommune.bundesland})`;
}
