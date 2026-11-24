import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { seitenKonto } from "@/lib/konto-seite";
import { ADMIN_SITZUNG_STUNDEN } from "@/lib/konto-dienste";
import { sicheresZiel } from "@/lib/konto-browser";
import { Anmelden } from "@/components/konto/anmelden";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anmelden" };

export default async function AnmeldenSeite({ searchParams }: { searchParams: Promise<{ weiter?: string; erneut?: string }> }) {
  const { dienste, mitglied } = await seitenKonto();
  if (!dienste) notFound();
  const parameter = await searchParams;
  const weiter = sicheresZiel(parameter.weiter);
  // Admin pages send admins whose sign-in is too old here; everyone else signed in goes straight on.
  const erneut = parameter.erneut === "1" && mitglied?.adminNeuAnmelden ? { email: mitglied.email, stunden: ADMIN_SITZUNG_STUNDEN } : null;
  if (mitglied && !erneut) redirect(weiter);
  return <Anmelden weiter={weiter} erneut={erneut} />;
}
