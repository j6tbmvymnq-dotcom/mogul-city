# Auftrag für Fable: Grafiken und Klänge für die Mondkolonie

Lies zuerst `assets/ASSETS.md` (Stil, Regeln, Ablauf) und `assets/LISTE.md`, Abschnitt **Mond** (jede Datei mit Maßen
und Inhalt, Status „fehlt“). Den Spielcode musst du nicht lesen. Kurzbeschreibung des Spielteils: `docs/MOND-PLAN.md`.

## Arbeitsweise
- Gerüst: `tools/svg/mond.py` – eine leere Funktion je Datei, Hilfen schon importiert (`schreiben`, `farbe`, `funke`,
  `schatten`, `lg`). Funktionen füllen, dann `python tools/svg/mond.py` (oder nur einzelne: `python tools/svg/mond.py bagger`).
- Klänge: neue Rezepte `mond_tap`, `mond_start`, `mond_bau` und Musik `musik_mond` in `tools/klang/rezepte.py`
  (wie die vorhandenen, `@rezept(...)`), dann `python tools/klang/rezepte.py`.
- Nach jedem Schritt `node tools/assets.js` – meldet Fehler, trägt gültige Dateien ein.
- Sichtprüfung im Spiel: lokale Vorschau „mogul-city“ (Port 8830) starten, dann
  `node tools/test/ui/run.js mond 390 844` → Bilder `tools/test/ui/shots/01-mond-start.png` und `02-mond-aufbau.png`.

## Was gebraucht wird (alles optional – fehlende Dateien bleiben Platzhalter)
- **Panorama** `mond_panorama` 1200 × 400: Sternenhimmel, Erde oben rechts, untere 35 % graue Mondoberfläche.
  Darauf stehen später kleine Gebäude in einer Reihe (je ca. 12 % Breite) – der Boden dort also ruhig halten.
- **8 Betriebe** `mond_bagger`, `mond_eis`, `mond_kuppel`, `mond_mine`, `mond_werk`, `mond_raff`, `mond_hafen`,
  `mond_mega` – je 160 × 140, freigestellt, Seitenansicht leicht von oben, steht unten mittig.
  Müssen auch in 56 px Größe erkennbar sein (klare Silhouette, je eine Leitfarbe).
- **Frachtrakete** `mond_rakete` 160 × 140.
- **Rohstoff-Symbole** `mond_bau` (Baustoffe, grau), `mond_fuel` (Treibstoff, blau), `mond_he3` (Helium-3, violett),
  `mond_kol` (Kolonist mit Helm) – je 64 × 64, lesbar in 18 px auf dunklem Grund.
- **15 Mond-Sammelstücke** `mond_samm_meteor_1..5`, `mond_samm_andenken_1..5`, `mond_samm_proben_1..5` – je 128 × 128,
  gleicher Stil wie die Sammelstücke der Erde.
- **Einladungsbild** `bild_mond` 480 × 300: Raumfähre startet von der Stadt, Mond groß am Himmel.
- **Klänge** (Rezepte in `tools/klang/rezepte.py`): `mond_tap` (kurzes freundliches Sci-Fi-Piepen, sehr häufig –
  dezent!), `mond_start` (Raketenstart 1–2 s), `mond_bau` (metallisches Einrasten), Musik `musik_mond`
  (sphärisch, ruhig, freundlich, Schleife 60–120 s).

## Stil auf dem Mond
- Gleicher freundlicher Cartoon-Vektorstil wie die Stadt, aber Sci-Fi: weiße und graue Module, Glas, Solarflächen,
  kleine Lichter. Leitfarben: Baustoffe grau-beige, Treibstoff hellblau `#4fc3f7`, Helium-3 violett `#b48cff`.
- Licht weiterhin von links oben, Schatten weich. Hintergrund dunkel – Gebäude brauchen helle Kanten/Lichter,
  damit sie sich abheben.
- Keine Schrift in den Grafiken, keine realen Logos oder Marken.

## Prüfen
`node tools/assets.js` (meldet Abweichungen), Galerie `tools/galerie.html#Mond`.
Im Spiel: Der Mond ist noch nicht live (`MC.MOON_LIVE = false` in `js/mond.js`). Zum Ansehen das Spiel mit `?mond=1` öffnen
(lokale Vorschau `http://localhost:8830/index.html?browser=1&mond=1`), eine Teststadt mit fertiger Raumfähre nutzen
(UI-Test `tools/test/ui/sz/mond.js` zeigt, wie). Den Schalter auf `true` setzt Claude erst nach der Abnahme.
