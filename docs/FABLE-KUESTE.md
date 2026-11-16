# Auftrag für Fable: Küstenstadt (Gelände, Autobahn, Zoll)

Die Karte wird von einer Insel zu einer **Küstenstadt** (Stimmung Kapstadt): auf einer Seite Meer mit Stränden und Buchten,
gegenüber Berge und Felshänge, dazwischen Bauland. Eine **Autobahn** kommt vom Kartenrand, passiert eine **Zollstation**
und mündet über eine Abfahrt ins Straßennetz. Jede Stadt wird per Zufalls-Seed etwas anders – deine Grafiken sind die
Bausteine, die das Spiel kombiniert (deshalb mehrere Varianten).

Lies `assets/ASSETS.md` (Stil/Regeln) und in `assets/LISTE.md` den Abschnitt **Küste**. Den Spielcode nicht lesen/ändern.

## Hinweise
- Boden-Kacheln (`boden_fels`, `boden_berg`, `boden_duene`) nahtlos kachelbar wie `boden_gras`, Farben passend zu Gras,
  Strand und Wasser. Keine Rautenlinien.
- `berg_1..4`: naturnahe Bergkuppen/Felsmassive (2×2, bis 360 px hoch erlaubt), unterschiedlich in Form, gemeinsam wirken
  sie wie eine Bergkette (Tafelberg-Anmutung). Licht von links oben.
- Autobahn wie die Straßenkacheln (Maske N=1, O=2, S=4, W=8), aber breiter wirkend: zwei Spuren je Richtung, Mittelleitplanke.
  Fahrbahnkanten müssen an Nachbarkacheln nahtlos passen.
- `zoll`: über der Autobahn (Autobahn läuft von N nach S durch die Mitte der 3×3-Fläche).
- Für alle beleuchteten Bauten `licht_*` mitliefern (siehe Liste). Schatten wie im Leben-Auftrag als eigene Ebene, falls
  der Baukasten das schon kann.
- Neue Skripte in eigener Datei `tools/svg/kueste.py` (vorhandene Baukasten-Dateien nur lesen, nicht umbauen – es laufen
  andere Aufträge parallel).

## Prüfen
`node tools/assets.js`, Galerie `tools/galerie.html#Küste`. Am Ende melden, was fertig ist.
