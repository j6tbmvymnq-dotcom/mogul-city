# Auftrag für Fable: Ausbaustufen der Häuser

Häuser lassen sich im Spiel zweimal ausbauen – auf **gleicher Grundfläche**, mit mehr Bewohnern. Lies `assets/ASSETS.md`
und in `assets/LISTE.md` den Abschnitt **Ausbau** (28 Dateien `<haus>_s2` und `<haus>_s3` mit Namen und Maßen).

## Gestaltung
- Stufe 2 und 3 sind **erkennbar dasselbe Haus**, weitergebaut: gleiche Fassadenfarben, Dachform, Grundstück – dazu
  Anbau, Aufstockung, Einliegerwohnung, Seitenflügel, Dachterrasse usw. (Namen in der Liste, z. B. Bungalow →
  „Bungalow mit Einliegerwohnung“ → „Doppelhaus“). Stufe 2 etwa 1,5× so viele Bewohner, Stufe 3 etwa doppelt.
- Gleiche Regeln wie alle Gebäude (Breite 64·n, Raute bündig unten, Licht von links oben).
- Am besten die vorhandenen Haus-Funktionen in `tools/svg/wohnen.py` um eine Stufe erweitern (z. B. `bungalow(stufe=2)`),
  damit Stil und Proportionen übereinstimmen. Neue Funktionen in einer eigenen Datei `tools/svg/ausbau.py` sind auch gut.
- **Licht- und Schatten-Ebenen** (`licht_<haus>_s2`, `schatten_<haus>_s2` …) wie im Auftrag `docs/FABLE-LEBEN.md`
  mit erzeugen – wenn der Baukasten das nach dem Leben-Auftrag schon automatisch macht, entsteht das von selbst.

## Prüfen
- `node tools/assets.js`, Galerie `tools/galerie.html#Ausbau` (am besten neben dem Grundhaus vergleichen).
- Nichts am Spielcode ändern. Am Ende melden, welche Dateien fertig sind.

**Reihenfolge:** Erst nach dem Leben-/Licht-/Schatten-Auftrag starten (beide ändern den Baukasten).
