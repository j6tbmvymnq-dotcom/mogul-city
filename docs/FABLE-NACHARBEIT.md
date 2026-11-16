# Fable – Nacharbeit (Stand 16.11.2026)

Antwort auf deine Abschlussliste. Was Claude schon erledigt hat, steht unten; was für dich bleibt, steht zuerst.

## 1. Schatten ausschneiden (wichtigster Punkt)

Entscheidung: **Schatten bleiben eigene Ebenen** (nachts sollen sie verschwinden), werden aber **ausgeschnitten**
und vom Spiel **nach** dem Gebäude gezeichnet.

- Jede `schatten_*.svg` enthält nur noch den **sichtbaren** Teil des Schattens: auf dem Grundstücksboden, auf Wegen,
  über die Grundstücksgrenze hinaus. Alles, was der Baukörper selbst verdeckt, ist frei (transparent).
- Farbe weiter Schwarz mit 100 % Deckkraft, gleiche Maße und Lage wie das Sprite. Das Spiel regelt die Stärke.
- Gilt für alle vorhandenen `schatten_*` (Gebäude, Ausbaustufen, `schatten_zoll`, `schatten_leuchtturm`, Deko).
- **Wenn alle fertig sind:** in `js/data.js` `MC.SHADOW_CUT = true` setzen. Erst dann zeichnet das Spiel die
  Schatten über das Gebäude. Vorher bitte nicht umstellen, sonst liegen die alten Schatten auf den Häusern.
- Prüfen im Spiel (siehe Abschnitt 4), tagsüber z. B. `?uhr=10:00`, und bei Sonnenuntergang `?uhr=17:00`.

## 2. Neue Schatten-Steckplätze (stehen jetzt in der Liste)

`schatten_m_*` (16 Mond-Gebäude), `schatten_starck_campus`, `schatten_starck_basis`, `schatten_starck_villa`,
`schatten_forschung` – gleich ausgeschnitten wie in Punkt 1.

## 3. Gestalterische Nachbesserungen (deine eigene Liste)

- `klippe_hinten_1/2`: Brandung deutlicher, dunkle Schnittfläche an der offenen rechten Kachelseite weg.
- `mondweg_*`: Rand an `mond_boden` angleichen, damit die Kachelraute nicht durchscheint.
- `supertower_s2`: deutlicher vom Grundhaus absetzen (Breite/Anbauten statt Höhe, wenn die Höhe ausgereizt ist).
- `forsch_bau`: Kran in 40 px lesbar (dicker, weniger Details, evtl. nur Kran + Uhr).
- Freiheitsmonument: Figur klarer; Tresorschlüssel: Griff schlanker.
- Autobahn-Kurven/Kreuzungen: **nicht nötig**, das Spiel nutzt nur Geraden, Endstück und `auffahrt`.
- Optional, falls Zeit: `ui_finger`, `bild_zurueck`.

## 4. Im Spiel ansehen (bisher nie gesehen)

Server im Projektordner: `python -m http.server 8830`, dann `http://localhost:8830/index.html?browser=1`.
Fertige Bildskripte (Bilder landen in `tools/test/ui/shots/`):

| Was | Befehl |
|---|---|
| Küste, mehrere Städte, Tag/Nacht | `node tools/test/ui/kueste.js` |
| Zoll, Leuchtturm, Berge nah | `node tools/test/ui/kueste-nah.js` |
| Autobahn: Stau / Anschluss | `node tools/test/ui/autobahn.js` |
| Tag-Nacht-Verlauf | `node tools/test/ui/nacht.js` |
| Ausbaustufen | `node tools/test/ui/run.js ausbau` |
| Autos, Leute, Boote, Vögel | `node tools/test/ui/run.js leben` |
| Mond | `node tools/test/ui/run.js mond` (läuft bei Claude fehlerfrei durch; `02-mond-aufbau.png` entsteht neu) |

Bitte nach einer Änderung auch nochmal ansehen: App-Symbol, `bild_willkommen`, `rakete_flamme_1..3`,
Lichtebene `supertower_s3`. Galerie: `tools/galerie.html` (über denselben Server).

## Schon erledigt (Claude)

- `bau.py`: `iconL`/`iconR`/`icon` (und `poly`/`schildL`) tragen Symbole nur noch **einmal** in die Lichtebene ein.
- `tools/assets.js` meldet jetzt Steuerzeichen und abgeschnittene Dateien als FEHLER.
- Schatten für Deko-Objekte (Zoll, Leuchtturm, Berge …) werden jetzt überhaupt gezeichnet, gespiegelt wo nötig.
- Dein Scratchpad (Sprites vor dem Schatten-Umbau, alte Klippen, `bau_vorher.py`) liegt gesichert in
  `tools/svg/archiv-vor-schatten/`.
- Küste: Bergkette in Reihen, Autobahn mit Anschluss, Stau vor dem Zoll, Auffahrt-Kachel im Einsatz.
