"""Lädt ausgewählte Kennzahlen aus dem Wegweiser Kommune der Bertelsmann Stiftung.

Aufruf:
    python3 -I scripts/wegweiser-aktualisieren.py

Quelle: REST-Schnittstelle von www.wegweiser-kommune.de (Daten unter CC0, siehe
www.wegweiser-kommune.de/open-data). Gemeinden unter 5.000 Einwohner:innen
haben dort kaum Werte; für sie nutzt die Beratung die Werte des
Gemeindeverbands oder Kreises (src/lib/kommunaldaten.ts).

Schreibt:
    src/data/kommunen-wegweiser.json
"""

import json
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

API = "https://www.wegweiser-kommune.de/data-api/rest"
ZIEL = Path(__file__).resolve().parent.parent / "src" / "data" / "kommunen-wegweiser.json"
REGIONSTYPEN = ["GEMEINDE", "KREISFREIE_STADT", "LANDKREIS", "BUNDESLAND"]
BLOCK = 100  # Die Schnittstelle liefert höchstens 100 Regionen je Anfrage.

# Schlüssel in der Ausgabe: Indikator-ID im Wegweiser Kommune
INDIKATOREN = {
    "entwicklung5Jahre": 137,
    "medianalter": 149,
    "steuernProKopf": 225,
    "personalProKopf": 328,
    "sgb2Quote": 184,
    "breitband": 296,
}
PROGNOSE = {"entwicklungBis2040": 337, "medianalter2040": 388}


def abruf(pfad, daten=None):
    anfrage = urllib.request.Request(
        API + pfad,
        data=json.dumps(daten).encode() if daten is not None else None,
        headers={"Content-Type": "application/json", "User-Agent": "Reform-Kompass-Datenaktualisierung"},
    )
    with urllib.request.urlopen(anfrage, timeout=120) as antwort:
        return json.load(antwort)


def schluessel(region):
    """Gemeinden nach AGS, Gemeindeverbände nach neunstelligem ARS, Kreise nach fünfstelligem AGS, Länder nach Name."""
    ars, typ = region["ars"], region["type"]
    if typ == "BUNDESLAND":
        return "laender", region["name"]
    if typ == "LANDKREIS":
        return "kreise", ars[:5]
    if ars[9:] == "000" and ars[5:9] != "0000":
        return "verbaende", ars[:9]
    return "gemeinden", ars[:5] + ars[9:]


def werte_laden(regionen, ids, jahre_je_indikator, prognose):
    """Neuester Wert je Indikator und Region als [Wert, Jahr]."""
    ergebnis = {}
    for start in range(0, len(regionen), BLOCK):
        block = regionen[start:start + BLOCK]
        antwort = abruf("/statistics/data", {"regionIds": [r["id"] for r in block], "indicatorIds": list(ids.values())})
        if len(antwort["regions"]) != len(block):
            sys.exit("Wegweiser Kommune: Antwort enthält nicht alle angefragten Regionen.")
        for indikator in antwort["indicators"]:
            name = next(k for k, v in ids.items() if v == indikator["id"])
            jahre = jahre_je_indikator[indikator["id"]]
            for region, reihe in zip(antwort["regions"], indikator["regionYearValues"]):
                # Die Reihen enden mit dem letzten Jahr; bei Prognosen ist das letzte Jahr 2040,
                # bei Ist-Daten das letzte Jahr des gesamten Datenbestands.
                achse = jahre if prognose else list(range(ISTJAHR - len(reihe) + 1, ISTJAHR + 1))
                paare = [(j, w) for j, w in zip(achse[::-1], reihe[::-1]) if w is not None]
                if any(j not in jahre for j, _ in paare):
                    sys.exit(f"Unerwartete Jahresachse bei Indikator {indikator['id']}.")
                if paare:
                    ergebnis.setdefault(region["id"], {})[name] = [paare[0][1], paare[0][0]]
        print(f"  {min(start + BLOCK, len(regionen))}/{len(regionen)}", file=sys.stderr)
        time.sleep(0.5)
    return ergebnis


def main():
    global ISTJAHR
    indikatoren = {i["id"]: i for i in abruf("/indicator/list?max=2000")}
    ISTJAHR = max(indikatoren[i]["years"][-1] for i in INDIKATOREN.values())
    jahre = {i: indikatoren[i]["years"] for i in [*INDIKATOREN.values(), *PROGNOSE.values()]}
    if any(jahre[i][-1] != 2040 for i in PROGNOSE.values()):
        sys.exit("Die Vorausberechnung reicht nicht mehr bis 2040; Schlüssel in PROGNOSE anpassen.")

    regionen = [r for typ in REGIONSTYPEN for r in abruf(f"/region/list?types={typ}&max=20000")]
    print(f"{len(regionen)} Regionen", file=sys.stderr)
    ist = werte_laden(regionen, INDIKATOREN, jahre, prognose=False)
    vorausberechnung = werte_laden(regionen, PROGNOSE, jahre, prognose=True)

    daten = {
        "quelle": "Bertelsmann Stiftung, Wegweiser Kommune",
        "lizenz": "CC0 1.0",
        "abgerufenAm": date.today().isoformat(),
        "indikatoren": {
            name: {"name": indikatoren[i]["name"], "einheit": indikatoren[i]["unit"], "datenquelle": " ".join(indikatoren[i]["source"].split())}
            for name, i in {**INDIKATOREN, **PROGNOSE}.items()
        },
        "demografietypen": {str(t["number"]): t["title"] for t in abruf("/demographicTypes")},
        "laender": {}, "kreise": {}, "verbaende": {}, "gemeinden": {},
    }
    for r in regionen:
        werte = {**ist.get(r["id"], {}), **vorausberechnung.get(r["id"], {})}
        if not werte:
            continue
        gruppe, s = schluessel(r)
        eintrag = {"name": r["title"], "werte": werte}
        if r.get("demographicType"):
            eintrag["demografietyp"] = r["demographicType"]
        daten[gruppe][s] = eintrag
    if len(daten["gemeinden"]) < 2500 or len(daten["laender"]) < 13:
        sys.exit(f"Wegweiser Kommune: unerwartet wenige Regionen ({len(daten['gemeinden'])} Gemeinden, {len(daten['laender'])} Länder).")
    ZIEL.write_text(json.dumps(daten, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(", ".join(f"{len(daten[g])} {g}" for g in ["gemeinden", "verbaende", "kreise", "laender"]) + f"; Ist-Daten bis {ISTJAHR}")


if __name__ == "__main__":
    main()
