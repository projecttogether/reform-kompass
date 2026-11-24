import type { Metadata } from "next";
import localFont from "next/font/local";
import { MarkeProvider } from "@/components/marke";
import { leseBetreiber } from "@/lib/inhalte";
import "./globals.css";

// Font files are committed under src/app/fonts (SIL Open Font License).
// Neither the build nor the browser contacts Google.
const rubik = localFont({
  src: "./fonts/rubik-latin-wght-normal.woff2",
  weight: "300 900",
  style: "normal",
  variable: "--font-rubik",
});

const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/fraunces-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-fraunces",
});

// The name comes from the content folder at request time, so no page may be prerendered
// with the name that was present at build time.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const { name } = leseBetreiber();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "KI-gestützte Reifegradbewertung und Beratung für öffentliche Verwaltungen",
    icons: { icon: { url: "/marke/icon.svg", type: "image/svg+xml" } },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${rubik.variable} ${fraunces.variable}`} style={{ fontFamily: "var(--font-rubik), sans-serif" }}>
        <MarkeProvider name={leseBetreiber().name}>{children}</MarkeProvider>
      </body>
    </html>
  );
}
