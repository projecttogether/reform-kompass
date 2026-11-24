import Link from "next/link";
import { getAiCapabilities } from "@/lib/ai-config";
import { leseBetreiber } from "@/lib/inhalte";
import { seitenKonto } from "@/lib/konto-seite";
import { KontoLink } from "@/components/konto/seitenkopf";
import { Logo } from "@/components/marke";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { advice } = getAiCapabilities();
  const { dienste, mitglied } = await seitenKonto();
  const { fusszeile } = leseBetreiber();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#00115a",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-rubik), sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Logo />
        {dienste && <KontoLink angemeldet={!!mitglied} />}
      </nav>

      {/* Hauptinhalt */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px 40px",
      }}>
        <div style={{ width: "100%", maxWidth: "620px" }}>

          <h1 style={{
            fontFamily: "var(--font-fraunces), serif",
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 400,
            color: "#ffffff",
            lineHeight: 1.15,
            marginBottom: "24px",
            letterSpacing: "-0.01em",
          }}>
            Wie modern ist Ihre Kommunalverwaltung?
          </h1>

          <p style={{
            fontSize: "17px",
            color: "#ffffff",
            lineHeight: 1.75,
            marginBottom: "40px",
            maxWidth: "520px",
            fontFamily: "var(--font-rubik), sans-serif",
          }}>
            {advice
              ? "Erfahren Sie den Modernisierungsreifegrad Ihrer Kommunalverwaltung. Erhalten Sie anschließend kostenlose, individualisierte Empfehlungen."
              : "Erfahren Sie den Modernisierungsreifegrad Ihrer Kommunalverwaltung. Beantworten Sie 15 Fragen und erhalten Sie Ihre Auswertung direkt im Anschluss."}
          </p>

          <div style={{ marginBottom: "48px", borderLeft: "3px solid #64d2b4", paddingLeft: "18px" }}>
            <p style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#64d2b4",
              letterSpacing: "0.08em",
              marginBottom: "8px",
              }}>
              Für wen ist das?
            </p>
            <p style={{
              fontSize: "15px",
              color: "#ffffff",
              lineHeight: 1.75,
              margin: 0,
            }}>
              Für alle Verwaltungsmitarbeitenden einer Kommune, die verstehen möchten, wo ihre Verwaltung heute steht, was zur Modernisierung beitragen kann und was sich verändern sollte — auch wenn es nicht in den eigenen Händen liegt.
            </p>
          </div>

          <Link href="/check" style={{ textDecoration: "none" }}>
            <div className="btn-start" style={{
              display: "inline-block",
              padding: "15px 36px",
              background: "#64d2b4",
              color: "#00115a",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-rubik), sans-serif",
              transition: "background 0.15s, transform 0.1s",
            }}>
              Jetzt starten
            </div>
          </Link>

          <p style={{ marginTop: "14px", fontSize: "13px", color: "#ffffff" }}>
            Kostenlos, ohne Anmeldung.
          </p>
        </div>
      </main>

      {/* Footer */}
      {fusszeile.length > 0 && (
        <footer style={{
          padding: "32px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center",
        }}>
          {fusszeile.map(({ text, link }, i) => (
            <p key={i} style={{ fontSize: "13px", color: "#ffffff", margin: i === 0 ? 0 : "8px 0 0" }}>
              {text}
              {link && " "}
              {link && (
                <a
                  href={link.url}
                  {...(link.url.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  style={{ color: "#64d2b4", textDecoration: "none" }}
                >
                  {link.text}
                </a>
              )}
            </p>
          ))}
        </footer>
      )}
    </div>
  );
}
