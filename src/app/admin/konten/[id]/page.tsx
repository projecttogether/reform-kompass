import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminSeite } from "@/lib/konto-seite";
import { formatiereDatum, formatiereDatumZeit } from "@/lib/konto-browser";
import { AdminRahmen, AktionKnopf, kopfzelle, zelle } from "@/components/konto/admin-teile";
import * as stil from "@/components/konto/stil";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konto · Verwaltung" };

export default async function AdminKontoSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dienste, mitglied } = await adminSeite(`/admin/konten/${encodeURIComponent(id)}`);
  const konto = await dienste.admin.konto(id);
  if (!konto) notFound();
  const action = `/api/admin/konten/${encodeURIComponent(konto.id)}`;
  const angaben: [string, string][] = [
    ["Kommune", konto.profil.kommune || "–"],
    ["Fachbereich", konto.profil.fachbereich || "–"],
    ["Funktion", konto.profil.funktion || "–"],
    ["Registriert", formatiereDatumZeit(konto.erstelltAm)],
    ["Zuletzt aktiv", konto.letzteAktivitaet ? formatiereDatumZeit(konto.letzteAktivitaet) : "–"],
    ["Aktive Sitzungen", String(konto.aktiveSitzungen)],
  ];

  return (
    <AdminRahmen email={mitglied.email} zurueck={{ href: "/admin", text: "Alle Konten" }}>
      <h1 style={{ ...stil.titel, overflowWrap: "anywhere" }}>{konto.email}</h1>
      {konto.loeschungBeantragtAm && (
        <p role="status" style={{ ...stil.text, color: stil.farben.rot, margin: "8px 0 0" }}>
          Zur Löschung vorgemerkt seit {formatiereDatum(konto.loeschungBeantragtAm)}. Endgültige Löschung am {formatiereDatum(konto.endgueltigAm!)}.
        </p>
      )}
      <dl style={{ ...stil.karte, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 20px", margin: "20px 0" }}>
        {angaben.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt style={{ ...stil.klein, fontSize: "13px" }}>{k}</dt>
            <dd style={{ margin: 0, fontSize: "13px", overflowWrap: "anywhere" }}>{v}</dd>
          </div>
        ))}
      </dl>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "36px" }}>
        <AktionKnopf action={action} aktion="abmelden" text="Alle Sitzungen beenden" bestaetigung="Alle Sitzungen dieses Kontos beenden?" />
        {konto.loeschungBeantragtAm ? (
          <>
            <AktionKnopf action={action} aktion="wiederherstellen" text="Konto wiederherstellen" />
            <AktionKnopf action={action} aktion="endgueltig-loeschen" text="Sofort endgültig löschen" gefahr bestaetigung="Konto und alle Bewertungen sofort und endgültig löschen? Das kann nicht rückgängig gemacht werden." />
          </>
        ) : (
          <AktionKnopf action={action} aktion="loeschen" text="Zur Löschung vormerken" gefahr bestaetigung="Konto zur Löschung vormerken? Es wird abgemeldet und nach 30 Tagen endgültig gelöscht." />
        )}
      </div>

      <h2 style={stil.abschnittTitel}>Bewertungen ({konto.bewertungen.length})</h2>
      <div style={{ ...stil.karte, padding: "4px 12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
          <thead>
            <tr>
              <th scope="col" style={kopfzelle}>Kommune</th>
              <th scope="col" style={kopfzelle}>Ebene</th>
              <th scope="col" style={kopfzelle}>Ergebnis</th>
              <th scope="col" style={kopfzelle}>Begonnen</th>
              <th scope="col" style={kopfzelle}>Geändert</th>
              <th scope="col" style={kopfzelle}><span style={{ position: "absolute", left: "-9999px" }}>Aktionen</span></th>
            </tr>
          </thead>
          <tbody>
            {konto.bewertungen.length === 0 && <tr><td colSpan={6} style={{ ...zelle, color: stil.farben.gedimmt }}>Keine Bewertungen.</td></tr>}
            {konto.bewertungen.map((b) => (
              <tr key={b.id}>
                <td style={zelle}>{b.uebersicht?.kommune ?? <span style={stil.klein}>nicht lesbar</span>}</td>
                <td style={zelle}>{b.uebersicht?.ebeneLabel ?? "–"}</td>
                <td style={zelle}>{b.uebersicht ? `${b.uebersicht.prozent}% · Stufe ${b.uebersicht.stufe} · ${b.uebersicht.beantworteteFragen}/${b.uebersicht.gesamtFragen}` : "–"}</td>
                <td style={zelle}>{formatiereDatum(b.erstelltAm)}</td>
                <td style={zelle}>{formatiereDatumZeit(b.aktualisiertAm)}</td>
                <td style={{ ...zelle, whiteSpace: "nowrap" }}><a href={`/admin/bewertungen/${encodeURIComponent(b.id)}`} style={stil.textLink}>Ansehen</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminRahmen>
  );
}
