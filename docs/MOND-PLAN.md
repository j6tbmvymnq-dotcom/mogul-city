# Mondkolonie – Plan und Stand

Spät im Spiel (Weltwunder **Raumfähre**, ab Level 32) wird der Mond freigeschaltet. Vorbild für das Spielgefühl:
AdVenture Capitalist (Betriebe antippen, mehr davon kaufen, Manager automatisieren). Bei uns mit Rohstoffen statt Geld.

## Spielablauf
1. **Freischaltung:** Sobald die Raumfähre fertig ist, kündigt der Berater den Mond an („Der Mond wartet!“).
   Rechts unten erscheint der Knopf **Mond**, außerdem „Zum Mond fliegen“ im Fenster der Raumfähre.
2. **Startpaket:** 60 Baustoffe und ein Regolith-Bagger.
3. **Antippen:** Ein Betrieb mit mindestens einem Stück startet einen Durchgang. Ist er fertig, wird der Rohstoff
   gutgeschrieben. Mehr Stück = mehr Ertrag je Durchgang.
4. **Kaufen:** Betriebe kosten Rohstoffe, der Preis steigt je Stück (×1,07 … ×1,20). Kauf ×1, ×10 oder Max.
5. **Arbeiter:** Minen, Fabriken, Raffinerien und Raumhäfen brauchen Kolonisten. Kolonisten wohnen in
   Wohnkuppeln (4) und der Mega-Kuppel (60). Ohne freie Arbeiter kein Kauf.
6. **Meilensteine:** Ab 10 / 50 / 200 / 400 Stück doppelter Ertrag, ab 25 / 100 doppelt so schnell.
7. **Manager:** Kosten Dollar von der Erde (50 k … 20 Mio.). Danach läuft der Betrieb von selbst – auch offline,
   höchstens 8 Stunden.
8. **Frachtrakete:** Fliegt Helium-3 zur Erde (Ladung 50 + 100 je Raumhafen, Flug 15 Min. − 1 Min. je Raumhafen,
   mindestens 5 Min.). Kostet Treibstoff (20 + 0,2 je Helium-3). Bei Ankunft: 500 $ je Helium-3 auf der Erde.
9. **Erd-Bonus:** Je 40 Kolonisten +1 % Miete auf der Erde, höchstens +15 %.
10. **Mond-Ziele:** 10 Ziele der Reihe nach (Bagger-Flotte … Stadt unter Glas), Belohnung Rohstoffe oder Gold.
11. **Mond-Sammlungen:** Meteoriten, Raumfahrt-Andenken, Mondproben (je 5 Stück). Funde beim Fertigstellen von
    Durchgängen (5 %, danach 20–60 Min. Pause, das erste nach 5 Durchgängen sicher). Bis zur ersten vollen Sammlung
    meist fehlende Stücke. Eintauschen gegen Rohstoffe und Gold, danach erneut sammelbar.

## Betriebe
| Betrieb | erzeugt | Dauer | Grundpreis | Arbeiter | Manager |
|---|---|---|---|---|---|
| Regolith-Bagger | 1 Baustoff | 3 s | 10 Baustoffe | – | 50 k $ |
| Eisbohrer (Roboter) | 1 Treibstoff | 12 s | 60 Baustoffe | – | 200 k $ |
| Wohnkuppel | +4 Wohnplätze | – | 150 Baustoffe, 20 Treibstoff | – | – |
| Helium-Mine | 1 Helium-3 | 60 s | 800 Baustoffe, 100 Treibstoff | 2 | 2 Mio. $ |
| Baustoff-Fabrik | 40 Baustoffe | 30 s | 3.000 Baustoffe, 300 Treibstoff | 3 | 5 Mio. $ |
| Helium-Raffinerie | 25 Helium-3 | 8 Min. | 20.000 Baustoffe, 2.500 Treibstoff, 50 Helium-3 | 5 | 20 Mio. $ |
| Raumhafen | +100 Ladung, −1 Min. Flug | – | 50.000 Baustoffe, 8.000 Treibstoff | 4 | – |
| Mega-Kuppel | +60 Wohnplätze | – | 250.000 Baustoffe, 40.000 Treibstoff, 500 Helium-3 | – | – |

Alle Zahlen stehen in `js/mond.js` (`MC.MOON`) und lassen sich dort nachjustieren.

## Technik
- `js/mond.js` – Logik (Zustand `S.moon`, Kaufen, Antippen, Manager, Offline-Fortschritt, Rakete, Bonus, Ziele, Sammlungen).
- `js/mondui.js` – Vollbild-Bereich `#moon` (Rohstoffe, Panorama, Ziel, Rakete, Sammlungen, Liste). Lädt Fable-Grafiken
  `mond_*`, sonst gezeichnete Platzhalter. Musik wechselt auf `musik_mond`, falls vorhanden.
- Erd-Bonus wirkt über `effect('rent')` in `js/game.js`.
- Tests: `tools/test/spieltest.js` (Abschnitt Mondkolonie), `tools/test/ui/sz/mond.js`.
- Berater-Ansagen: `neu_mond`, `mond_start`, `mond_kuppel`, `mond_manager`, `mond_rakete`, `mond_bonus`, `mond_sammeln`.

## Offen / später
- Balance mit echten Spielern (Vocheltown testet das Late Game). Besonders: Raketen-Erlös je Helium-3, Managerpreise.
- Upgrades mit Helium-3 (z. B. „Bessere Bohrköpfe“ ×3 Ertrag), Mond-Weltwunder, später Mars nach demselben Muster.
- Start-Animation der Rakete beim Wechsel Erde ↔ Mond.
