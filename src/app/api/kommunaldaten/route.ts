import { findeGrunddaten, kurzfassung, GRUNDDATEN_STAND } from "@/lib/kommunaldaten";
import { getKommunalpolitik } from "@/lib/kommunalpolitik";
import { getAiCapabilities } from "@/lib/ai-config";

// Zeigt, welche amtlichen Grunddaten die Beratung zur gewählten Kommune verwendet. Ohne KI-Aufruf.
// Startet nebenbei das Laden des kommunalpolitischen Hintergrunds, während der Fragebogen ausgefüllt wird.
export function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.slice(0, 300) ?? "";
  const grunddaten = findeGrunddaten(name);
  if (grunddaten && getAiCapabilities().advice) getKommunalpolitik().vorabladen(grunddaten.ags);
  return Response.json(
    grunddaten
      ? { gefunden: true, ags: grunddaten.ags, kurzfassung: kurzfassung(grunddaten), quelle: `Destatis, Stand ${GRUNDDATEN_STAND.datenstand}` }
      : { gefunden: false },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
