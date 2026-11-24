import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getKontoDienste, leseMitglied, type KontoDienste, type Mitglied } from "./konto-dienste";

/** Session lookup for server components. Returns null services when accounts are disabled. */
export async function seitenKonto(): Promise<{ dienste: KontoDienste | null; mitglied: Mitglied | null }> {
  const dienste = getKontoDienste();
  if (!dienste) return { dienste: null, mitglied: null };
  try {
    return { dienste, mitglied: await leseMitglied(dienste, await headers()) };
  } catch (error) {
    // A database outage must not take down the assessment pages.
    console.error("Sitzung nicht lesbar:", error);
    return { dienste, mitglied: null };
  }
}

/**
 * For admin pages: sends signed-out visitors, and admins whose sign-in is too old, to sign
 * in and hides the area from everyone else.
 */
export async function adminSeite(weiter: string) {
  const { dienste, mitglied } = await seitenKonto();
  if (!dienste) notFound();
  if (!mitglied) redirect(`/anmelden?weiter=${encodeURIComponent(weiter)}`);
  if (mitglied.adminNeuAnmelden && !mitglied.loeschungBeantragtAm) redirect(`/anmelden?erneut=1&weiter=${encodeURIComponent(weiter)}`);
  if (!mitglied.admin || mitglied.loeschungBeantragtAm) notFound();
  return { dienste, mitglied };
}
