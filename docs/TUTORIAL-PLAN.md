# Einstieg, Tutorial und Freischaltungen – Plan

## 1. Was moderne Mobile-Spiele dabei richtig machen (Recherche)
- **Kernschleife zuerst:** In den ersten Minuten nur das, was den Spaß ausmacht (bauen → vermieten → kassieren).
  Alles andere kommt später, schrittweise („progressive disclosure“), damit niemand überfordert wird.
- **Tun statt lesen:** Keine Textwände. Ein Satz, ein Fingerzeig, eine Aktion. Ausgegrauter Rest, nur das Ziel leuchtet.
- **Schnelle Erfolge am Anfang:** Timer in den ersten Minuten sehr kurz (SimCity BuildIt: anfangs nur Produktion
  unter 5 Minuten, damit die ersten Sitzungen lang und flüssig sind). Erstes Level-up nach 1–2 Minuten.
- **Immer ein nächstes Ziel sichtbar** – und eine Belohnung, auf die man hinarbeitet („noch 40 XP bis zum Kaffeehaus“).
- **Freischalten als Ereignis:** Jede neue Funktion wird gefeiert, kurz erklärt und mit einem kleinen Auftrag sofort benutzt.
- **Grund zum Wiederkommen** schon in der ersten Sitzung: laufende Bauten, lange Verträge, Tagesbonus-Serie.
- Branchenwerte: Tag-1-Bindung im Schnitt um 26 %, gut ab ~40 %; die meisten springen in der ersten Sitzung ab.
  Messen später (Online-Phase): Abschluss je Tutorial-Schritt, Absprungstellen.

## 2. Stand Mogul City
- Gebäude und Verträge werden schon nach Level freigeschaltet, **alle Werkzeuge und Systeme sind aber ab Sekunde 1 da**
  (Umsetzen, Abriss, Landkauf, Gold, Sammlungen, Wunder-Reiter, Tagesbonus). Kein geführter Einstieg.
- XP-Kurve: Level 2 = 40 XP, 3 = 120, 4 = 230, 5 = 370 … Ein Bungalow bringt 19 XP, ein 3-Min.-Vertrag nur 1 XP.
  → Aufstieg hängt fast nur am Bauen; Vermieten (der Kern!) fühlt sich nach XP wertlos an.

## 3. Freischalt-Fahrplan (Vorschlag)
Zielzeiten bei normalem Spiel: Level 2 im Tutorial (~2 Min.), Level 3 nach ~6 Min., Level 5 nach ~20 Min.,
Level 8 am Ende von Tag 1/Anfang Tag 2, danach langsamer (Stunden/Tage), wie im Original.

| Level | Neu (Funktion) | Neu (Inhalte) |
|---|---|---|
| 1 | Bauen (nur „Häuser“), Straße, Kassieren, Ziele | Bungalow, Blumenbeet; Verträge 3 Min. und 1 Std. |
| 2 | Reiter **Deko** und **Gewerbe**, Einzugsgebiet erklärt | Kaffeehaus, Eiche; Vertrag 30 Min. |
| 3 | Werkzeuge **Umsetzen** und **Abriss** | Reihenhaus; Vertrag 4 Std. |
| 4 | **Tagesbonus** (erst ab der 2. Sitzung bzw. Level 4) und **Sammel-Kassieren** für alle Häuser | Palme; Vertrag 8 Std. |
| 5 | **Landkauf** (Verkaufsschilder erscheinen) | Landhaus; Vertrag 1 Tag |
| 6 | **Sammlungen** (erstes Stück garantiert direkt danach) | Bäckerei, Parkbank |
| 7 | Reiter **Wunder**, **Gold-Tausch**, Premium-Gebäude im Laden | Gründerdenkmal, Luxus-Reihenhaus |
| 8+ | wie bisher (Gebäude, Verträge, Wunder nach Level) | Villa, Künstler-Vertrag … |

Darstellung:
- Gesperrte Werkzeuge sind **unsichtbar**, nicht ausgegraut (aufgeräumte Leiste wie bei modernen Spielen).
- Im Laden: alles Freigeschaltete + **die nächsten 2 Gebäude als Silhouette mit „Level X“** (Vorfreude), Rest verborgen.
- Neue Dinge tragen ein **„Neu“-Abzeichen**, bis man sie einmal angetippt hat (Werkzeug, Laden-Reiter, Gebäude).
- Neben der XP-Leiste: **Symbol der nächsten Freischaltung** („Level 3: Reihenhaus“), Antippen zeigt die Vorschau.
- Level-up-Fenster (gibt es) zeigt Neues; bei einer neuen *Funktion* folgt direkt ein Mini-Auftrag mit Fingerzeig.

Balancing dazu:
- Vertrags-XP deutlich anheben (z. B. 3 Min. = 4 XP, 1 Std. = 12 XP), damit Kassieren spürbar zum Aufstieg beiträgt.
- Die ersten 3 Bauten dauern nur wenige Sekunden; der erste Vertrag im Tutorial läuft 20 Sekunden („Probemieter“).
- Missionen an den Fahrplan anpassen (Reihenfolge, XP-Belohnungen), damit sie genau die Freischaltungen anteasern.

## 4. Tutorial (≈ 3 Minuten, geführt vom gewählten Berater, mit Stimme)
Berater wählen und Stadt benennen bleiben vorne. Danach:

| # | Berater sagt (1 Satz) | Spieler tut | Technik |
|---|---|---|---|
| 1 | „Jede Stadt beginnt mit einer Straße.“ | Straßen-Knopf, dann vorgezeichnete Strecke nachziehen | nur Straße aktiv, Finger-Animation über die Kacheln |
| 2 | „Jetzt dein erstes Haus – direkt an die Straße.“ | Bauen → Bungalow → auf markierter Stelle bauen | Zielfeld leuchtet, Bau dauert 3 Sek. |
| 3 | „Ein Haus ohne Mieter bringt nichts. Unterschreib den Vertrag.“ | Vertragssymbol → „Tagesgäste“ | nur dieser Vertrag antippbar, läuft 20 Sek. |
| 4 | „Während wir warten: Ein Blumenbeet macht die Miete teurer.“ | Geschenk-Blumenbeet neben das Haus setzen | Bonusanzeige „+1 %“ hervorheben |
| 5 | „Die Miete ist fällig – hol sie dir!“ | Münze antippen | großer Münzregen, XP → **Level 2** |
| 6 | „Wichtig: Wer zu spät kommt, dessen Mieter ziehen aus.“ | – (kurzer Hinweis mit Uhr-Symbol) | zeigt die Frist im Vertragsfenster |
| 7 | „Hier siehst du immer, was als Nächstes zu tun ist.“ | Ziele-Knopf antippen | Abschluss: +1 Gold, +Startgeld |

Regeln:
- Ein Schritt = eine Aktion; alles andere abgedunkelt und gesperrt (Spotlight). Karte bleibt schieb-/zoombar.
- „Überspringen“ klein in der Ecke (für Erfahrene / Neuanfang). Fortschritt wird gespeichert (`S.tut`), Abbruch mitten
  drin setzt beim nächsten Start am selben Schritt fort.
- Stimme und Sprechblase pro Schritt; **neue Sprecherzeilen** (`tut_1` … `tut_7`, plus je eine pro neuer Funktion:
  `neu_deko`, `neu_werkzeuge`, `neu_tagesbonus`, `neu_land`, `neu_sammlung`, `neu_wunder`) – werden mit den
  festen Referenzstimmen nachvertont (nur fehlende Zeilen, ~13 je Berater).

## 5. Nach dem Tutorial: Lust auf mehr
- **Erste Sitzung endet mit einem Haken:** Ab ~10 Minuten Tipp des Beraters „Wenn du gleich weg musst, nimm einen
  langen Vertrag – die Miete wartet auf dich.“ + laufender Bau mit längerer Zeit.
- **„Willkommen zurück“-Übersicht** beim Öffnen: was fällig ist, was fertig wurde, was verfallen ist – ein Knopf
  „Alles kassieren“. (Push-Nachrichten folgen in der Online-Phase.)
- **Tagesbonus** erst ab der zweiten Sitzung zeigen – dann wirkt er als Belohnung fürs Wiederkommen.
- Jede Freischaltung wird mit einem kleinen Auftrag sofort ausprobiert (z. B. Level 5: „Kauf dein erstes Grundstück“).

## 6. Umsetzung (Reihenfolge)
1. Daten: `MC.FEATURES` (Funktion → Level), `G.unlocked(name)`, „Neu“-Merker im Spielstand.
2. Oberfläche: Werkzeuge/Reiter/Systeme nach Freischaltung ein-/ausblenden, „Neu“-Abzeichen, Laden-Teaser,
   Vorschau der nächsten Freischaltung an der XP-Leiste.
3. Tutorial-Motor: Schrittliste mit Bedingungen (reagiert auf Spielereignisse), Spotlight-Ebene über DOM-Elementen
   und Kartenfeldern, Finger-Animation, Sprechblase, Überspringen, Fortsetzen.
4. Balancing: XP-Kurve, Vertrags-XP, Tutorial-Timer, Missionsreihenfolge; per Simulation prüfen (Zielzeiten oben).
5. „Willkommen zurück“-Übersicht und Session-Ende-Tipp.
6. Neue Sprecherzeilen vertonen; neue Grafiken an die Asset-Liste anhängen: `ui_finger` (Zeigefinger),
   `ui_neu` (Abzeichen), `bild_zurueck` (optional).
7. Test: kompletter Neustart im iPhone-Format, Tutorial durchspielen, Überspringen, Abbruch/Fortsetzen, alter
   Spielstand (Bestandsspieler bekommen kein Tutorial, alle Funktionen ihres Levels sind frei).

Quellen: Unity „10 FTUE tips“, Liquid & Grit (FTUE-Toolkit), Deconstructor of Fun (SimCity BuildIt),
Supersonic, Keewano, adriancrook.com, Roblox Creator Docs (Onboarding).
