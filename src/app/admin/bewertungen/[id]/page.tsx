import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminSeite } from "@/lib/konto-seite";
import { ergebnis } from "@/lib/bewertung";
import { EBENEN, KATEGORIEN, type Kategorie } from "@/lib/reifegrad-model";
import { gruppiereKatalog } from "@/lib/massnahmenkatalog";
import { formatiereDatumZeit } from "@/lib/konto-browser";
import { AdminRahmen, AktionKnopf, kopfzelle, zelle } from "@/components/konto/admin-teile";
import * as stil from "@/components/konto/stil";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bewertung · Verwaltung" };

export default async function AdminBewertungSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dienste, mitglied } = await adminSeite(`/admin/bewertungen/${encodeURIComponent(id)}`);
  const b = await dienste.admin.bewertung(id);
  if (!b) notFound();
  const zurueck = { href: `/admin/konten/${encodeURIComponent(b.userId)}`, text: b.email };
  const loeschen = <AktionKnopf action={`/api/admin/bewertungen/${encodeURIComponent(b.id)}`} aktion="loeschen" text="Bewertung löschen" gefahr bestaetigung="Diese Bewertung endgültig löschen?" />;

  if (!b.stand) {
    return (
      <AdminRahmen email={mitglied.email} zurueck={zurueck}>
          <h1 style={stil.titel}>Bewertung nicht lesbar</h1>
        <p style={{ ...stil.text, margin: "8px 0 20px" }}>Der gespeicherte Stand passt nicht mehr zum aktuellen Fragebogen.</p>
        {loeschen}
      </AdminRahmen>
    );
  }
  const { stand } = b;
  const score = ergebnis(stand);

  return (
    <AdminRahmen email={mitglied.email} zurueck={zurueck}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h1 style={stil.titel}>{stand.kontext.orgName}</h1>
          <p style={stil.klein}>
            {EBENEN[stand.kontext.ebene].label} · {stand.kontext.funktion || "Funktion –"} · {stand.kontext.positionFachbereich || "Fachbereich –"}<br />
            Begonnen {formatiereDatumZeit(b.erstelltAm)} · geändert {formatiereDatumZeit(b.aktualisiertAm)} · Fragebogen-Fassung {stand.fragebogenVersion}
          </p>
        </div>
        {loeschen}
      </div>

      <h2 style={{ ...stil.abschnittTitel, marginTop: "28px" }}>Ergebnis: {score.prozent}% · Stufe {score.stufe} ({score.beantworteteFragen} von {score.gesamtFragen} Fragen)</h2>
      <div style={{ ...stil.karte, padding: "4px 12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
          <thead><tr><th scope="col" style={kopfzelle}>Frage</th><th scope="col" style={kopfzelle}>Antwort</th></tr></thead>
          <tbody>
            {(Object.keys(KATEGORIEN) as Kategorie[]).flatMap((k) => [
              <tr key={k}><th colSpan={2} scope="colgroup" style={{ ...zelle, fontWeight: 700 }}>{KATEGORIEN[k].label} · {score.kategorieScores[k].beantwortet ? `${score.kategorieScores[k].prozent}%` : "nicht beantwortet"}</th></tr>,
              ...score.kategorieScores[k].fragen.map((f) => (
                <tr key={f.id}>
                  <td style={{ ...zelle, width: "40%" }}>{f.titel}</td>
                  <td style={zelle}>{f.antwort === undefined ? <span style={stil.klein}>übersprungen</span> : `${f.antwort}/${f.max} · ${f.option}`}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>

      <h2 style={{ ...stil.abschnittTitel, marginTop: "28px" }}>Beratung ({stand.nachrichten.length} Nachrichten)</h2>
      <div style={{ ...stil.karte, display: "flex", flexDirection: "column", gap: "12px" }}>
        {stand.nachrichten.length === 0 && <p style={stil.klein}>Keine Beratung.</p>}
        {stand.nachrichten.map((n, i) => (
          <div key={i}>
            <div style={{ ...stil.klein, fontWeight: 700 }}>{n.role === "user" ? "Person" : "KI"}</div>
            <div style={{ fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.content}</div>
          </div>
        ))}
      </div>

      <h2 style={{ ...stil.abschnittTitel, marginTop: "28px" }}>Maßnahmenkatalog ({stand.katalog?.massnahmen.length ?? 0})</h2>
      <div style={{ ...stil.karte, display: "flex", flexDirection: "column", gap: "16px" }}>
        {!stand.katalog && <p style={stil.klein}>Kein Katalog.</p>}
        {stand.katalog && gruppiereKatalog(stand.katalog).filter((g) => g.massnahmen.length > 0).map((g) => (
          <div key={g.id}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>{g.label}</div>
            <ul style={{ margin: 0, paddingLeft: "18px" }}>
              {g.massnahmen.map((m) => <li key={m.titel} style={{ fontSize: "13px", lineHeight: 1.6 }}><strong>{m.titel}</strong> · {m.beschreibung}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </AdminRahmen>
  );
}
