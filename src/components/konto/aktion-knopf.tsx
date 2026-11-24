"use client";

import * as stil from "./stil";

/** Posts one admin action as a plain form, after an optional confirmation. */
export function AktionKnopf({ action, aktion, text, gefahr, bestaetigung }: { action: string; aktion: string; text: string; gefahr?: boolean; bestaetigung?: string }) {
  return (
    <form method="post" action={action} style={{ display: "inline" }} onSubmit={(e) => { if (bestaetigung && !window.confirm(bestaetigung)) e.preventDefault(); }}>
      <input type="hidden" name="aktion" value={aktion} />
      <button type="submit" className="btn-ghost" style={gefahr ? stil.knopfGefahr : stil.knopfRahmen}>{text}</button>
    </form>
  );
}
