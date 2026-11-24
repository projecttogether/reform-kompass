"""Erzeugt die Kommunendaten aus amtlichen Tabellen von Destatis und der Bundesagentur für Arbeit.

Aufruf:
    python3 -I scripts/kommunen-aktualisieren.py <Auszug_GV.xlsx> \\
        --schulden <integrierte-schulden-tabellenband.xlsx> \\
        --beschaeftigung <gemband-dlk.xlsx>

Quellen (siehe docs/development.md):
- Gemeindeverzeichnis GV-ISys, Quartalsauszug "Gemeinden in Deutschland nach
  Fläche, Bevölkerung und Postleitzahl" (Destatis)
- "Integrierte Schulden der Gemeinden und Gemeindeverbände", Tabellenband (Destatis)
- "Gemeindedaten der sozialversicherungspflichtig Beschäftigten nach Wohn- und
  Arbeitsort" (Statistik der Bundesagentur für Arbeit)

Die Dateien enthalten nur Daten und werden ohne Fremdbibliotheken gelesen.

Schreibt:
    src/data/kommunen.json             Auswahlliste im Browser (Name, Land, Kreis)
    src/data/kommunen-grunddaten.json  Grunddaten für die Beratung (nur Server)
"""

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
ZIEL = Path(__file__).resolve().parent.parent / "src" / "data"

KREIS_ART = {"41": "Kreisfreie Stadt", "42": "Stadtkreis", "43": "Kreis", "44": "Landkreis", "45": "Regionalverband"}
VERBAND_ART = {
    "51": "Amt", "52": "Samtgemeinde", "53": "Verbandsgemeinde", "54": "Verwaltungsgemeinschaft",
    "55": "Kirchspielslandgemeinde", "56": "Verwaltungsverband", "58": "Verwaltungsgemeinschaft mit erfüllender Gemeinde",
}
GEMEINDE_ART = {
    "60": "Markt", "61": "Kreisfreie Stadt", "62": "Stadtkreis", "63": "Stadt", "64": "Kreisangehörige Gemeinde",
    "65": "Gemeindefreies Gebiet (bewohnt)", "66": "Gemeindefreies Gebiet (unbewohnt)", "67": "Große Kreisstadt",
}


def blaetter(datei):
    """Liefert {Blattname: Zeilen-Generator}; jede Zeile ist {Spalte: Text}."""
    z = zipfile.ZipFile(datei)
    texte = []
    if "xl/sharedStrings.xml" in z.namelist():
        texte = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
    ziele = {r.get("Id"): r.get("Target").lstrip("/") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}

    def zeilen(pfad):
        for _, el in ET.iterparse(z.open(pfad if pfad.startswith("xl/") else "xl/" + pfad)):
            if el.tag == M + "row":
                zeile = {}
                for c in el.findall(M + "c"):
                    v = c.find(M + "v")
                    if v is not None:
                        zeile[re.match(r"[A-Z]+", c.get("r")).group(0)] = texte[int(v.text)] if c.get("t") == "s" else v.text
                yield zeile
                el.clear()

    return {s.get("name"): (lambda p=ziele[s.get(R + "id")]: zeilen(p)) for s in ET.fromstring(z.read("xl/workbook.xml")).iter(M + "sheet")}


def zahl(wert, typ):
    wert = (wert or "").strip()
    try:
        return typ(float(wert.replace(",", "."))) if wert else None
    except ValueError:
        return None  # "X", "-" oder "." stehen in den Tabellen für fehlende Werte


def stichtag(text):
    return re.search(r"(\d\d\.\d\d\.\d{4})", text).group(1)


def lese_gemeindeverzeichnis(datei):
    meta, kommunen, grunddaten = {}, [], []
    land = kreis = None
    verband = {}
    blatt = next(name for name in blaetter(datei) if name.startswith("Onlineprodukt_Gemeinden"))
    for z in blaetter(datei)[blatt]():
        a = z.get("A", "")
        if a.startswith("Gemeinden in Deutschland"):
            meta["gebietsstand"] = stichtag(a)
        elif z.get("J", "").endswith("(Jahr)"):
            meta["datenstand"] = stichtag(z["J"])
        elif a == "10":
            land = z["H"]
        elif a == "40":
            kreis = {"ars": z["C"] + z["D"] + z["E"], "name": z["H"], "art": KREIS_ART[z["B"]]}
        elif a == "50":
            verband = {"ars": z["C"] + z["D"] + z["E"] + z["F"], "name": z["H"], "art": VERBAND_ART.get(z["B"])}
        elif a == "60":
            # Einige Sondergebiete gehören keinem Kreis an; dann nicht den vorherigen übernehmen.
            if not kreis or kreis["ars"] != z["C"] + z["D"] + z["E"]:
                kreis = {"ars": None, "name": "", "art": None}
            if verband.get("ars") != z["C"] + z["D"] + z["E"] + z["F"]:
                verband = {"name": None, "art": None}
            kommunen.append({"name": z["H"], "bundesland": land, "kreis": kreis["name"]})
            grunddaten.append({
                "ags": z["C"] + z["D"] + z["E"] + z["G"],
                "name": z["H"],
                "art": GEMEINDE_ART[z["B"]],
                "bundesland": land,
                "kreis": kreis["name"],
                "kreisArt": kreis["art"],
                "verband": verband["name"] if verband["art"] else None,
                "verbandArt": verband["art"],
                "verbandArs": verband["ars"] if verband["art"] else None,
                "einwohner": zahl(z.get("J"), int),
                "flaecheKm2": zahl(z.get("I"), float),
                "einwohnerJeKm2": zahl(z.get("M"), int),
                "verstaedterung": z.get("T") or None,
            })
    if not (meta.get("gebietsstand") and meta.get("datenstand") and len(kommunen) > 10_000):
        sys.exit("Gemeindeverzeichnis: unerwartetes Format.")
    return meta, kommunen, grunddaten


def lese_schulden(datei):
    """Schulden pro Kopf je Gemeinde (AGS) und Landesdurchschnitte."""
    tabellen = blaetter(datei)
    stand, je_land, je_gemeinde = None, {}, {}
    laender = {}
    for z in tabellen["Übersicht"]():
        if z.get("A", "").startswith("Tabelle"):
            stand = stichtag(z["A"])
        elif z.get("A") == "Merkmal, Gliederung":
            laender = {spalte: name for spalte, name in z.items() if spalte != "A"}
        elif z.get("A", "").startswith("Schulden des öffentlichen Bereichs insgesamt pro Kopf"):
            je_land = {laender[spalte]: zahl(wert, int) for spalte, wert in z.items() if spalte in laender}
    for name, zeilen in tabellen.items():
        if not re.fullmatch(r"[A-Z]{2}", name):
            continue
        for z in zeilen():
            ars = (z.get("A") or "").strip()
            if re.fullmatch(r"\d{12}", ars):
                je_gemeinde[ars[:5] + ars[9:]] = {"proKopf": zahl(z.get("G"), int), "veraenderungProzent": zahl(z.get("F"), float)}
    if not (stand and je_land and len(je_gemeinde) > 9_000):
        sys.exit("Schuldentabelle: unerwartetes Format.")
    return stand, je_land, je_gemeinde


def lese_beschaeftigung(datei):
    """Sozialversicherungspflichtig Beschäftigte, Pendler und Betriebe je Gemeinde (AGS)."""
    stand, je_gemeinde = None, {}
    for z in blaetter(datei)["Gemeindedaten"]():
        if "Beschäftigte am" in z.get("C", ""):
            stand = stichtag(z["C"])
        ags = (z.get("A") or "").strip()
        if re.fullmatch(r"\d{8}", ags):
            je_gemeinde[ags] = {
                "wohnort": zahl(z.get("C"), int), "arbeitsort": zahl(z.get("K"), int),
                "einpendler": zahl(z.get("M"), int), "auspendler": zahl(z.get("N"), int), "betriebe": zahl(z.get("O"), int),
            }
    if not (stand and len(je_gemeinde) > 10_000):
        sys.exit("Beschäftigungstabelle: unerwartetes Format.")
    return stand, je_gemeinde


def unterscheide_gleichnamige(kommunen, grunddaten):
    # Gleichnamige Gemeinden im selben Kreis bekommen einen Zusatz, damit die Auswahl eindeutig bleibt
    # (src/lib/kommunen.ts, anzeigeText).
    gruppen = {}
    for i, k in enumerate(kommunen):
        gruppen.setdefault((k["name"], k["kreis"], k["bundesland"]), []).append(i)
    for indizes in gruppen.values():
        if len(indizes) < 2:
            continue
        for i in indizes:
            g = grunddaten[i]
            zusatz = "gemeindefreies Gebiet" if g["art"].startswith("Gemeindefrei") else f"{g['verbandArt']} {g['verband']}" if g["verband"] else None
            if zusatz:
                kommunen[i]["zusatz"] = g["zusatz"] = zusatz
        if len({kommunen[i].get("zusatz") for i in indizes}) < len(indizes):
            sys.exit(f"Nicht unterscheidbare Gemeinden: {[grunddaten[i]['ags'] for i in indizes]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("gemeindeverzeichnis")
    parser.add_argument("--schulden", required=True)
    parser.add_argument("--beschaeftigung", required=True)
    args = parser.parse_args()

    meta, kommunen, grunddaten = lese_gemeindeverzeichnis(args.gemeindeverzeichnis)
    schulden_stand, schulden_land, schulden = lese_schulden(args.schulden)
    beschaeftigung_stand, beschaeftigung = lese_beschaeftigung(args.beschaeftigung)
    unterscheide_gleichnamige(kommunen, grunddaten)

    for g in grunddaten:
        s = schulden.get(g["ags"])
        g["schulden"] = s and {**s, "landProKopf": schulden_land.get(g["bundesland"])}
        g["beschaeftigung"] = beschaeftigung.get(g["ags"])

    daten = {
        "quelle": "Statistisches Bundesamt (Destatis), Gemeindeverzeichnis-Informationssystem GV-ISys",
        "gebietsstand": meta["gebietsstand"],
        "datenstand": meta["datenstand"],
        "hinweis": "Bevölkerung auf Grundlage des Zensus 2022. Vervielfältigung und Verbreitung mit Quellenangabe gestattet.",
        "schulden": {
            "quelle": "Statistisches Bundesamt (Destatis), Integrierte Schulden der Gemeinden und Gemeindeverbände",
            "stand": schulden_stand,
            "hinweis": "Schulden beim nicht-öffentlichen Bereich einschließlich anteiliger Schulden von Extrahaushalten, Fonds, Einrichtungen und Unternehmen (anteilige Modellrechnung für den interkommunalen Vergleich).",
        },
        "beschaeftigung": {
            "quelle": "Statistik der Bundesagentur für Arbeit, Gemeindedaten der sozialversicherungspflichtig Beschäftigten",
            "stand": beschaeftigung_stand,
        },
        "gemeinden": grunddaten,
    }
    (ZIEL / "kommunen.json").write_text(json.dumps(kommunen, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (ZIEL / "kommunen-grunddaten.json").write_text(json.dumps(daten, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    abdeckung = lambda feld: sum(1 for g in grunddaten if g[feld])
    print(f"{len(kommunen)} Gemeinden, Gebietsstand {meta['gebietsstand']}, Datenstand {meta['datenstand']}")
    print(f"Schulden ({schulden_stand}): {abdeckung('schulden')} Gemeinden; Beschäftigung ({beschaeftigung_stand}): {abdeckung('beschaeftigung')} Gemeinden")


if __name__ == "__main__":
    main()
