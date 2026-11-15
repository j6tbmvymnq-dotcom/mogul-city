# Briefing: Grafik, Sound und Stimmen für Mogul City

Ziel: Das Spiel soll aussehen und klingen wie ein fertiges Mobile-Spiel – das Gefühl von Millionaire City
(Facebook, 2010), aber moderner und hochwertiger. **Den Spielcode muss niemand lesen.** Alles Nötige steht
hier und in der automatisch erzeugten [LISTE.md](LISTE.md) (jede Datei mit Maßen, Inhalt, Status).

## Ablauf (Tokens sparen)
1. Nur diese Datei und `LISTE.md` lesen. Arbeiten in Gruppen, Reihenfolge nach Wirkung:
   Gebäude → Boden → Straße → Kartensymbole → Bäume → Oberfläche → Sammelstücke → Figuren → App-Symbol → optionale.
2. SVG-Dateien nach `assets/sprites/<name>.svg` schreiben – von Hand oder per Python mit dem Baukasten
   `tools/svg/iso.py` (Isometrie-Formen, Licht und Kanten schon richtig; Beispiel im Dateikopf).
3. `node tools/assets.js` ausführen → meldet jede Abweichung als `PROBLEM …`, trägt gültige Dateien ins Manifest ein.
   Das Spiel nutzt fertige Dateien sofort; fehlende bleiben gezeichnete Platzhalter.
4. Sichtprüfung: Vorschau „mogul-city“ starten, `http://localhost:8830/tools/galerie.html` öffnen
   (Anker `#Gebäude`, `#Straße` …, Schalter „nur fehlende“). Grün = echt, Rot = fehlerhaft.
   Im Spiel selbst prüfen: Gebäude auf der Karte, Straßenkacheln im Verbund.
5. Sounds: Rezepte in `tools/klang/rezepte.py` (Bibliothek `klang.py`: Oszillatoren, Hüllkurven, Filter, Hall,
   Instrumente, Sequenzer; ein Beispielrezept „collect“ ist drin) → `python tools/klang/rezepte.py` → `node tools/assets.js`.
6. App-Symbol: `assets/sprites/app_icon.svg` → `python tools/icons.py`.
7. Stimmen (lokal, nicht durch Fable): siehe unten.

## Stil
- **Look:** freundlicher, sauberer Cartoon-Vektorstil, kräftige aber nicht grelle Farben, weiche Verläufe,
  klare Silhouetten. Lesbar schon bei halber Größe (iPhone, herausgezoomt). Keine Fotorealistik, kein Pixel-Art.
- **Perspektive:** 2:1-Isometrie. 1 Feld = 64 × 32 px. Senkrechte bleiben senkrecht. Ein Stockwerk ≈ 14–16 px.
- **Licht:** von links oben. Dachflächen am hellsten, linke Wand (zeigt nach links unten) mittel, rechte Wand
  (zeigt nach rechts unten) dunkel (−30 %). Schlagschatten weich nach rechts unten auf das eigene Grundstück.
- **Kanten:** feine Konturen (0,5–1 px) in dunklerem Ton der Fläche, nie reines Schwarz.
- **Grundstück:** Jedes Gebäude bringt seinen Boden mit (Rasen, Pflaster, Beete, Wege, Pool …) und füllt die Raute
  seiner Grundfläche – die Karte zeigt darunter nur Gras.
- **Abstufung:** Häuser von Stufe 0 (Bungalow) bis 9 (Super-Tower) werden sichtbar größer, edler, detailreicher.
  Premium (Gold) mit Goldakzenten. Gewerbe mit erkennbarem Thema (Schild als Grafik, Markise, Auslage).
  Weltwunder sind Hingucker mit eigener Silhouette, deutlich höher als normale Gebäude.
- **Farben (Anhaltspunkte, damit alles zusammenpasst):** Rasen #7cc46a / #8fd47c, Wildwiese #62a85a,
  Pflaster #cfd4da, Straße #5a626e, Sand #ecdca5, Wasser #3f9ec4, Gold #f2b632, Oberfläche Dunkelblau #16233b,
  Glas #8fd0ea, warmes Fensterlicht #ffe9a3.
- Eigene Gestaltung, keine Kopie realer Marken, Logos oder der Original-Grafiken.

## Technische Regeln (prüft `tools/assets.js`)
- SVG mit `width`, `height` und gleichem `viewBox`, z. B. `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="140" viewBox="0 0 128 140">`.
- **Kein `<text>`** (Schriften fehlen auf iOS) – Buchstaben/Zahlen als Pfade. Keine externen Verweise, keine Skripte,
  keine eingebetteten Fotos. Max. 600 KB, angestrebt < 60 KB. Verläufe und Transparenz sind erlaubt.
- Alternativ PNG in **doppelter** Auflösung (z. B. 256 × 280 für ein 128 × 140-Sprite).
- **Gebäude, Bäume, Baustellen, Straßen (Größe n):** Breite exakt `64·n`. Die Grundfläche (Raute) liegt bündig am
  **unteren Bildrand**: Ecken links (0 | H−16n), oben (32n | H−32n), rechts (64n | H−16n), unten (32n | H).
  Alles darüber ist Platz für das Gebäude; Höhe H frei zwischen 32n und 32n+360. Nichts ragt seitlich heraus.
- **Straßenkacheln** `strasse_<maske>`: 64 breit, Raute wie oben; Maske = Summe der Anschlüsse N=1, O=2, S=4, W=8
  (N = Kante oben rechts, O = unten rechts, S = unten links, W = oben links). Fahrbahn mittig, Anschlüsse stoßen
  nahtlos an die Nachbarkachel (Fahrbahnbreite überall gleich, z. B. 60 % der Kante; Mittellinie gestrichelt).
- **Boden** `boden_*`, `wasser`: rechteckige Kachel 128 × 64 (oder 256 × 128), nahtlos in beide Richtungen kachelbar,
  dezente Struktur (keine erkennbaren Wiederholungen, keine Rautenlinien – das Raster zeichnet das Spiel).
- **Symbole/Oberfläche:** quadratisch 64 × 64, Motiv mit ~4 px Rand. Kartensymbole haben einen hellen Rand/Schatten,
  damit sie auf jedem Untergrund lesbar sind (Anzeige 40 px). UI-Symbole hell auf Dunkelblau (Anzeige 26 px).
- **Sammelstücke** 128 × 128, **Berater-Porträts** 256 × 256 (Brustbild, Gesicht mittig, wird rund beschnitten),
  **Illustrationen** 480 × 300, **App-Symbol** 1024 × 1024 vollflächig ohne Transparenz.

## Sound
- Alles in `assets/sounds/<name>.mp3`; Namen und Wirkung in `LISTE.md`. Effekte 0,03–5 s, Musik 20–300 s.
- Charakter: hochwertig, warm, „belohnend“ (Münzen, Kasse, kleine Fanfaren), nie schrill. Häufige Klänge
  (`tap`, `road`, `collect`) kurz und dezent, seltene (`level`, `set`, `land`) dürfen größer sein.
- Musik: entspannter, beschwingter Lounge/Jazz-Pop, nahtlose Schleife (`schleife()` in klang.py), leise genug
  für Sprache darüber (das Spiel senkt die Musik ab, während ein Berater spricht).
- `speichern()` normalisiert automatisch; Ränder werden weich ausgeblendet.

## Stimmen (lokal mit Qwen3-TTS aus dem Podcast-Projekt)
Texte: `assets/voice/zeilen.json` (41 Zeilen je Berater, erzeugt aus den Spieldaten). Einstellungen: `tools/stimmen/stimmen.json`.
```
PY="../Einschlafen in Vice City/produktion/venv-gpu/Scripts/python.exe"
"$PY" tools/stimmen/vertone.py referenz     # je Berater 3 Stimmentwürfe → besten als referenz.wav speichern
"$PY" tools/stimmen/vertone.py zeilen       # alle Zeilen per Stimmklon → assets/voice/<berater>/*.mp3
node tools/assets.js
```
Der erste Schritt lädt einmalig das Modell „VoiceDesign“ (~4 GB) herunter. Vor dem Vertonen die Aussprache neuer
Namen per Hörprobe prüfen (Ersetzungen in `stimmen.json` → `aussprache`).
