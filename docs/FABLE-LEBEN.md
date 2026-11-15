# Auftrag für Fable: Leben, Nachtlicht und Schatten

Lies zuerst `assets/ASSETS.md` (Stil, Regeln, Ablauf) und in `assets/LISTE.md` die Abschnitte **Leben**, **Licht** und
**Schatten** (jede Datei mit Maßen und Inhalt). Den Spielcode musst du nicht lesen und nicht ändern – das Spiel nutzt
fertige Dateien automatisch, fehlende bleiben die heutigen einfachen Platzhalter.

## 1. Leben (neue Datei `tools/svg/leben.py`, Gerüst liegt bereit)
- **Autos** `auto_<typ>_vorn` / `auto_<typ>_hinten` für Kleinwagen, Limousine, Lieferwagen, Taxi, Cabrio – je 48 × 36.
  „vorn“ = fährt Richtung rechts unten (Front sichtbar), „hinten“ = fährt Richtung rechts oben (Heck sichtbar).
  Die beiden Richtungen nach links spiegelt das Spiel selbst. Unterkante Mitte = Punkt auf der Fahrbahn, Auto etwa
  30 px lang (passt auf eine Fahrspur einer 64er-Straßenkachel). Eher Spielzeug-Look, kräftige Farben, Fenster dunkelblau.
- **Boote** `boot_segel_*`, `boot_motor_*` (vorn/hinten) – 72 × 56, Wasserlinie unten, ohne Kielwasser.
- **Fußgänger** `person_1..6_1/2` – 16 × 26, zwei Schrittbilder je Person (Gehen), läuft nach rechts unten.
- **Vögel** `vogel_1/2` – 24 × 14, Flügel oben/unten.
- **Laterne** `laterne` 16 × 48 und **Lichtschein** `laterne_licht` 64 × 64 (weicher warmer Schein, transparent).

## 2. Nachtlicht je Gebäude: `licht_<gebäude>`
- Gleiche Maße und Lage wie das Gebäude-Sprite. **Nur** die leuchtenden Teile auf transparentem Grund: Fenster in
  warmem Licht `#ffcf7a` (etwa 6 von 10 an, ein paar kühler bläulich wie Fernseher), Leuchtschilder, Lampen am Eingang,
  Pool-Beleuchtung, Werbetafeln. Das Spiel dunkelt nachts die Welt ab und legt diese Ebene additiv darüber.
- **Alle Häuser brauchen Licht**, auch Bungalows und Reihenhäuser (heute erkennt das Spiel dort zu wenig Fenster).
- Empfehlung: Im Baukasten (`tools/svg/iso.py` / `bau.py`) beim Zeichnen von Fenstern, Türen, Schildern die Formen
  zusätzlich in eine Licht-Ebene schreiben und beim `speichern()` als `licht_<name>.svg` ablegen. Dann bekommen alle
  Gebäude ihre Ebene aus den vorhandenen Skripten, ohne jedes Haus neu zu zeichnen.

## 3. Schatten als eigene Ebene: `schatten_<gebäude>`
- Heute ist der Schlagschatten in jedes Gebäude eingebaut – nachts wirkt das falsch. Ziel: Gebäude-Sprites **ohne**
  Schlagschatten, dazu `schatten_<gebäude>.svg` in gleichen Maßen, nur der Schatten (schwarz, 100 % Deckkraft).
  Das Spiel zeichnet ihn je nach Sonnenstand (Tag kräftig, Dämmerung lang und weich, Nacht fast weg).
- Auch hier am besten zentral im Baukasten: `schatten()`/`schatten_rund()` in eine eigene Ebene umleiten.
- Wichtig: Gebäude und Schatten **im selben Durchlauf** erzeugen, damit nie ein Gebäude ohne Schatten-Datei live geht.

## Prüfen
- `node tools/assets.js` (meldet Abweichungen), Galerie `tools/galerie.html#Leben`, `#Licht`, `#Schatten`.
- Im Spiel: lokale Vorschau „mogul-city“ (Port 8830) starten.
  Nacht ansehen: `http://localhost:8830/index.html?browser=1&uhr=22:00`, Dämmerung `uhr=16:45`.
  Bilder per Test: `node tools/test/ui/nacht.js` (Bellas Stadt bei verschiedenen Sonnenständen → `tools/test/ui/shots/nacht-*.png`)
  und `node tools/test/ui/run.js leben 390 844` (Autos, Fußgänger).
- Nichts am Spielcode ändern. Am Ende melden, welche Dateien fertig sind.
