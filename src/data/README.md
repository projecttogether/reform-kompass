# Data sources

The JSON files here are generated from public sources by the scripts in
[`scripts/`](../../scripts). They are not covered by the license of the code.
Keep the sources and dates when you reuse them.

| File | Source | Terms | Changes |
| --- | --- | --- | --- |
| `kommunen.json`, `kommunen-grunddaten.json` | Statistisches Bundesamt (Destatis), Gemeindeverzeichnis-Informationssystem GV-ISys; territory 30.09.2026, population 31.12.2025 | Reproduction and distribution permitted with source attribution | Selected columns, converted to JSON, display names added |
| `kommunen-grunddaten.json`, debt | Statistisches Bundesamt (Destatis), Integrierte Schulden der Gemeinden und Gemeindeverbände, 31.12.2025 | Reproduction and distribution permitted with source attribution | Selected columns, converted to JSON |
| `kommunen-grunddaten.json`, employment | Statistik der Bundesagentur für Arbeit, Gemeindedaten der sozialversicherungspflichtig Beschäftigten nach Wohn- und Arbeitsort, 30.06.2025 | Reuse with source attribution; contents must not be altered | Selected columns, converted to JSON, figures unchanged |
| `kommunen-wegweiser.json` | Bertelsmann Stiftung, Wegweiser Kommune, retrieved 05.11.2026 | CC0 1.0 | Selected indicators, converted to JSON |
| `oparl-koerperschaften.json` | OParl endpoint directory (dev.oparl.org) and the listed council information systems, 05.11.2026 | Interface addresses, no council documents | Matched to official municipality keys, partly through Wikidata (CC0) |

See [development](../../docs/development.md#editing-content) for the downloads
and how to update the files.
