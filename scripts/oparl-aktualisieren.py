"""Ordnet Gemeinden (amtlicher Gemeindeschlüssel) ihrem Ratsinformationssystem mit OParl-Schnittstelle zu.

Aufruf:
    python3 -I scripts/oparl-aktualisieren.py

Quelle: das OParl-Endpunktverzeichnis (https://dev.oparl.org/api/endpoints). Für jedes
System werden die Körperschaften (bodies) gelesen; deren Feld "ags" ergibt die Zuordnung.
Fehlt es, wird der Gemeindeschlüssel über die Wikidata-Kennung des Endpunkts ergänzt.

Schreibt:
    src/data/oparl-koerperschaften.json   {ags: {name, paper}} (nur Server; name aus dem Gemeindeverzeichnis)
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ZIEL = Path(__file__).resolve().parent.parent / "src" / "data" / "oparl-koerperschaften.json"
GEMEINDEN = Path(__file__).resolve().parent.parent / "src" / "data" / "kommunen-grunddaten.json"
UA = "Reform-Kompass/0.1 (https://github.com/projecttogether/reform-kompass)"


def hole(url, timeout=25):
    anfrage = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(anfrage, timeout=timeout) as antwort:
        return json.load(antwort)


def endpunkte():
    url, alle = "https://dev.oparl.org/api/endpoints?limit=100", []
    while url:
        seite = hole(url)
        alle += seite["data"]
        url = seite["meta"].get("next")
    return alle


def koerperschaften(endpunkt):
    """Liefert (endpunkt, [body, ...]) oder (endpunkt, None) bei Fehlern."""
    try:
        system = endpunkt.get("system") or hole(endpunkt["url"])
        bodies, url = [], system["body"]
        while url and len(bodies) < 500:
            seite = hole(url)
            bodies += seite.get("data", [])
            url = (seite.get("links") or {}).get("next")
        return endpunkt, bodies
    except Exception as fehler:  # nicht erreichbare Systeme überspringen
        print(f"  übersprungen: {endpunkt['title']} ({type(fehler).__name__})", file=sys.stderr)
        return endpunkt, None


def ags_aus_wikidata(kennungen):
    if not kennungen:
        return {}
    werte = " ".join(f"wd:{q}" for q in kennungen)
    abfrage = f'SELECT ?item ?ags WHERE {{ VALUES ?item {{ {werte} }} ?item wdt:P439 ?ags. }}'
    daten = hole("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": abfrage, "format": "json"}), timeout=60)
    return {b["item"]["value"].rsplit("/", 1)[1]: b["ags"]["value"] for b in daten["results"]["bindings"]}


def main():
    gueltig = {g["ags"]: g["name"] for g in json.loads(GEMEINDEN.read_text(encoding="utf-8"))["gemeinden"]}
    liste = endpunkte()
    print(f"{len(liste)} Endpunkte im Verzeichnis")
    with ThreadPoolExecutor(max_workers=8) as pool:
        ergebnisse = list(pool.map(koerperschaften, liste))

    zuordnung, ohne_ags = {}, []
    for endpunkt, bodies in ergebnisse:
        if not bodies:
            continue
        treffer = False
        for body in bodies:
            ags = re.sub(r"\D", "", str(body.get("ags") or ""))[:8]
            if ags in gueltig and body.get("paper"):
                zuordnung.setdefault(ags, {"name": gueltig[ags], "paper": body["paper"]})
                treffer = True
        # Ohne AGS in den Körperschaften: nur eindeutige Systeme mit einer Körperschaft übernehmen.
        if not treffer and len(bodies) == 1 and bodies[0].get("paper") and endpunkt.get("wikidata"):
            ohne_ags.append((endpunkt["wikidata"], bodies[0]))

    wd = ags_aus_wikidata(sorted({q for q, _ in ohne_ags}))
    for q, body in ohne_ags:
        ags = wd.get(q)
        if ags in gueltig:
            zuordnung.setdefault(ags, {"name": gueltig[ags], "paper": body["paper"]})

    daten = {
        "quelle": "OParl-Endpunktverzeichnis (dev.oparl.org) und Ratsinformationssysteme der Kommunen",
        "stand": date.today().strftime("%d.%m.%Y"),
        "koerperschaften": dict(sorted(zuordnung.items())),
    }
    ZIEL.write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(zuordnung)} Gemeinden mit OParl-Schnittstelle")


if __name__ == "__main__":
    main()
