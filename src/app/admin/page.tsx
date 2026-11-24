import type { Metadata } from "next";
import { adminSeite } from "@/lib/konto-seite";
import { KONTEN_PRO_SEITE } from "@/lib/admin";
import { formatiereDatum, formatiereDatumZeit } from "@/lib/konto-browser";
import { AdminRahmen, kopfzelle, zelle } from "@/components/konto/admin-teile";
import * as stil from "@/components/konto/stil";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verwaltung" };

export default async function AdminSeite({ searchParams }: { searchParams: Promise<{ q?: string; seite?: string }> }) {
  const { dienste, mitglied } = await adminSeite("/admin");
  const { q = "", seite: seiteText } = await searchParams;
  const seite = Math.max(1, Number.parseInt(seiteText ?? "1", 10) || 1);
  const [zahlen, { zeilen, gesamt }] = await Promise.all([dienste.admin.kennzahlen(), dienste.admin.konten({ suche: q, seite })]);
  const seiten = Math.max(1, Math.ceil(gesamt / KONTEN_PRO_SEITE));
  const link = (s: number) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), seite: String(s) })}`;

  return (
    <AdminRahmen email={mitglied.email}>
      <h1 style={stil.titel}>Verwaltung</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", margin: "20px 0 32px" }}>
        {[
          ["Konten", zahlen.konten],
          ["Aktiv in 7 Tagen", zahlen.aktivLetzte7Tage],
          ["Bewertungen", zahlen.bewertungen],
          ["Zur Löschung vorgemerkt", zahlen.zurLoeschungVorgemerkt],
        ].map(([label, wert]) => (
          <div key={label} style={stil.karte}>
            <div style={{ fontSize: "26px", fontWeight: 800 }}>{wert}</div>
            <div style={stil.klein}>{label}</div>
          </div>
        ))}
      </div>

      <form method="get" action="/admin" style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <label htmlFor="q" style={{ position: "absolute", left: "-9999px" }}>Suche</label>
        <input id="q" name="q" defaultValue={q} placeholder="E-Mail-Adresse oder Kommune" style={{ ...stil.eingabe, flex: "1 1 260px", width: "auto" }} />
        <button type="submit" className="btn-primary" style={stil.knopfPrimaer}>Suchen</button>
        {q && <a href="/admin" className="btn-ghost" style={stil.knopfRahmen}>Zurücksetzen</a>}
      </form>

      <div style={{ ...stil.karte, padding: "4px 12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
          <thead>
            <tr>
              <th scope="col" style={kopfzelle}>E-Mail</th>
              <th scope="col" style={kopfzelle}>Kommune (Profil)</th>
              <th scope="col" style={kopfzelle}>Bewertungen</th>
              <th scope="col" style={kopfzelle}>Registriert</th>
              <th scope="col" style={kopfzelle}>Zuletzt aktiv</th>
              <th scope="col" style={kopfzelle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.length === 0 && (
              <tr><td colSpan={6} style={{ ...zelle, color: stil.farben.gedimmt }}>Keine Konten gefunden.</td></tr>
            )}
            {zeilen.map((k) => (
              <tr key={k.id}>
                <td style={zelle}><a href={`/admin/konten/${encodeURIComponent(k.id)}`} style={{ ...stil.textLink, overflowWrap: "anywhere" }}>{k.email}</a></td>
                <td style={zelle}>{k.kommune || <span style={stil.klein}>–</span>}</td>
                <td style={zelle}>{k.bewertungen}</td>
                <td style={zelle}>{formatiereDatum(k.erstelltAm)}</td>
                <td style={zelle}>{k.letzteAktivitaet ? formatiereDatumZeit(k.letzteAktivitaet) : <span style={stil.klein}>abgemeldet</span>}</td>
                <td style={zelle}>{k.loeschungBeantragtAm ? <span style={{ color: stil.farben.rot }}>Löschung vorgemerkt</span> : "Aktiv"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", gap: "12px", flexWrap: "wrap" }}>
        <span style={stil.klein}>{gesamt} Konten · Seite {Math.min(seite, seiten)} von {seiten}</span>
        <div style={{ display: "flex", gap: "10px" }}>
          {seite > 1 && <a href={link(seite - 1)} className="btn-ghost" style={stil.knopfRahmen}>← Zurück</a>}
          {seite < seiten && <a href={link(seite + 1)} className="btn-ghost" style={stil.knopfRahmen}>Weiter →</a>}
        </div>
      </div>
    </AdminRahmen>
  );
}
