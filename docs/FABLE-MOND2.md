# Auftrag für Fable: Mond 2.0 (bebaubare Mondkarte, Raketen)

Der Mond wird zur **eigenen bebaubaren Karte wie die Erde**: Isometrie, Raster 64 × 32, Mondhäuser, Mondgewerbe,
Förderanlagen, Wege. Dazu Raketen, die sichtbar von der Erde starten und auf dem Mond landen, und der Mond am Himmel
über der Erde (antippen = hinfliegen).

Lies `assets/ASSETS.md`, `docs/FABLE-MOND.md` (Stil der bisherigen Mond-Grafiken – daran anknüpfen) und in
`assets/LISTE.md` den Abschnitt **Mond 2.0**. Den Spielcode nicht lesen/ändern.

## Hinweise
- Gebäude `m_*` wie Erd-Gebäude: Breite 64·n, Raute bündig unten, Licht von links oben, eigener Boden auf der Grundfläche
  (Regolith, Platten). Stil: weiße/graue Module, Glas, Solarflächen, Leitfarben Treibstoff `#4fc3f7`, Helium-3 `#b48cff`.
  Abstufung wie auf der Erde: Wohnkapsel klein und schlicht → Mega-Kuppel prächtig.
- Zu jedem Gebäude `licht_m_*` (nur leuchtende Teile, gleiche Maße). Auf dem Mond sieht man die Lichter immer etwas.
- `mondweg_0..15` wie die Straßenkacheln (Masken), nahtlos.
- Raketen: `rakete_rampe` (auf der Erde, 3×3), `rakete_flug` + `rakete_flamme_1..3` + `rakete_rauch` für die Animation
  (das Spiel setzt sie zusammen und bewegt sie).
- `mond_himmel` / `erde_himmel` 256 × 256 freigestellt mit weichem Schein.
- Eigene Datei `tools/svg/mond2.py` (Baukasten nur lesen).

## Prüfen
`node tools/assets.js`, Galerie `tools/galerie.html#Mond 2.0`. Am Ende melden, was fertig ist.
