"use client";

import { authClient } from "@/lib/auth-client";
import { SITZUNGS_SCHLUESSEL } from "@/components/check/sitzungsspeicher";
import * as stil from "./stil";

export async function abmelden() {
  await authClient.signOut();
  // Shared office computers: do not leave the last assessment in this tab.
  try { sessionStorage.removeItem(SITZUNGS_SCHLUESSEL); } catch {}
  // A full page load discards client state from the signed-in session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}

export function AbmeldenKnopf() {
  return (
    <button type="button" onClick={() => void abmelden()} className="btn-ghost" style={stil.knopfRahmen}>
      Abmelden
    </button>
  );
}
