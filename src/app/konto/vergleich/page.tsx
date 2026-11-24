import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { seitenKonto } from "@/lib/konto-seite";
import { vergleiche } from "@/lib/bewertung";
import { EBENEN } from "@/lib/reifegrad-model";
import { formatiereDatumZeit } from "@/lib/konto-browser";
import { Seitenkopf } from "@/components/konto/seitenkopf";
import * as stil from "@/components/konto/stil";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vergleich" };

function Differenz({ wert }: { wert: number | null }) {
  if (wert === null) return <span style={stil.klein}>–</span>;
  const farbe = wert > 0 ? "#22c55e" : wert < 0 ? "#f97316" : "rgba(255,255,255,0.65)";
  return <span style={{ color: farbe, fontWeight: 700 }}>{wert > 0 ? `+${wert}` : wert} Pkt.</span>;
}

export default async function VergleichSeite({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { dienste, mitglied } = await seitenKonto();
  if (!dienste) notFound();
  const { a: idA, b: idB } = await searchParams;
  if (!mitglied) redirect(`/anmelden?weiter=${encodeURIComponent(`/konto/vergleich?a=${idA ?? ""}&b=${idB ?? ""}`)}`);
  if (mitglied.loeschungBeantragtAm || !idA || !idB) redirect("/konto");
  const [a, b] = await Promise.all([dienste.bewertungen.lade(mitglied.id, idA), dienste.bewertungen.lade(mitglied.id, idB)]);
  if (!a?.stand || !b?.stand) notFound();
  const vergleich = vergleiche(a.stand, b.stand);
  const kopf = (x: typeof a) => ({ datum: formatiereDatumZeit(x.erstelltAm), kommune: x.stand!.kontext.orgName, ebene: EBENEN[x.stand!.kontext.ebene].label });
  const ka = kopf(a);
  const kb = kopf(b);
  const zelle: React.CSSProperties = { padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "14px", textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div style={stil.seite}>
      <Seitenkopf><a href="/konto" className="btn-text" style={stil.textLink}>← Mein Bereich</a></Seitenkopf>
      <div style={stil.inhalt}>
        <h1 style={stil.titel}>Vergleich</h1>
        <p style={{ ...stil.text, marginBottom: "24px" }}>Prozent der erreichbaren Punkte je Bereich. Die Veränderung zeigt die Differenz in Prozentpunkten.</p>
        <div style={{ ...stil.karte, padding: "8px 14px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "460px" }}>
            <thead>
              <tr>
                <th scope="col" style={{ ...zelle, textAlign: "left", fontWeight: 600 }}>Bereich</th>
                <th scope="col" style={{ ...zelle, fontWeight: 600 }}>{ka.datum}<div style={stil.klein}>{ka.ebene}</div></th>
                <th scope="col" style={{ ...zelle, fontWeight: 600 }}>{kb.datum}<div style={stil.klein}>{kb.ebene}</div></th>
                <th scope="col" style={{ ...zelle, fontWeight: 600 }}>Veränderung</th>
              </tr>
            </thead>
            <tbody>
              {vergleich.zeilen.map((z) => (
                <tr key={z.kategorie}>
                  <th scope="row" style={{ ...zelle, textAlign: "left", fontWeight: z.kategorie === "gesamt" ? 700 : 400, whiteSpace: "normal" }}>{z.label}</th>
                  <td style={zelle}>{z.a === null ? <span style={stil.klein}>nicht beantwortet</span> : `${z.a}%`}</td>
                  <td style={zelle}>{z.b === null ? <span style={stil.klein}>nicht beantwortet</span> : `${z.b}%`}</td>
                  <td style={zelle}><Differenz wert={z.differenz} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ka.kommune !== kb.kommune && (
          <p style={{ ...stil.klein, marginTop: "12px" }}>Kommunen: {ka.kommune} und {kb.kommune}.</p>
        )}
        {vergleich.hinweise.length > 0 && (
          <ul style={{ margin: "20px 0 0", padding: "16px 18px 16px 34px", background: "rgba(100,210,180,0.12)", border: "1px solid rgba(100,210,180,0.3)", borderRadius: "4px" }}>
            {vergleich.hinweise.map((h) => <li key={h} style={{ fontSize: "13px", lineHeight: 1.6 }}>{h}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
