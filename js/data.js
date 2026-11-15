/* Mogul City – Spieldaten (Katalog, Verträge, Missionen) */
(function () {
  'use strict';
  var MC = window.MC = window.MC || {};

  var MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
  MC.MIN = MIN; MC.H = H; MC.D = D;

  MC.SECTOR = 12;          // Kantenlänge eines Grundstücks-Sektors in Feldern
  MC.SECTORS = 5;          // 5 x 5 Sektoren
  MC.MAP = MC.SECTOR * MC.SECTORS;
  MC.START_CASH = 150000;
  MC.FRIEND_MAX = 25;      // höchstens +25 % durch Freunde
  MC.FRIEND_FIRST = 5;     // erster Freund: +5 %, jeder weitere +1 %
  MC.FRIEND_PROMPTS = [5, 8, 12];   // Berater werben bei diesen Level-Aufstiegen fürs Einladen (solange kein Freund mitspielt)
  MC.FRIEND_LVL = 5;       // ein Freund zählt ab diesem Level (= dort, wo er selbst zum Einladen aufgefordert wird)
  // Fahnenmasten auf dem Platz der Freundschaft (Felder, Höhe in px) – gleiche Formel wie tools/svg/freunde.py
  MC.FRIEND_POLES = (function () { var o = []; for (var i = 0; i < 12; i++) { var a = (i + 0.5) * Math.PI / 6; o.push([1 + 0.84 * Math.cos(a), 1 + 0.84 * Math.sin(a)]); } return o; })();  // Tutorial-Bungalow + Kapital für die ersten Ziele (Teststadt: sonst zäher Start)
  MC.START_GOLD = 5;
  MC.REFUND = 0.35;        // Abriss-Erstattung
  MC.CANCEL_REFUND = 0.5;  // Erstattung bei Vertragskündigung
  MC.MAX_BONUS = 400;

  /* Mietverträge nach dem Original (tools/wirtschaft/original.json):
     f = Einnahme als Vielfaches der 1-Std.-Miete des Hauses, sign = Abschlusskosten (× Hausfaktor sk),
     xv / xe = XP als Vielfaches der 1-Std.-XP (xv normale Häuser, xe kleine Häuser), grace = Frist, lvl = ab Level */
  MC.CONTRACTS = [
    { id: 'c3m',  name: 'Tagesgäste',        dur: 3 * MIN,  grace: 1 * H,  f: 0.2258, sign: 90,   xv: 0.055, xe: 0.143, occ: 1,    lvl: 1 },
    { id: 'c30m', name: 'Geschäftsreisende', dur: 30 * MIN, grace: 1 * H,  f: 0.7935, sign: 500,  xv: 0.51,  xe: 0.43,  occ: 1,    lvl: 2 },
    { id: 'c1h',  name: 'Studenten',         dur: 1 * H,    grace: 1 * H,  f: 1,      sign: 750,  xv: 1,     xe: 1,     occ: 1,    lvl: 1 },
    { id: 'c2h',  name: 'Musiker',           dur: 2 * H,    grace: 2 * H,  f: 1.6594, sign: 937,  xv: 1.96,  xe: 1.43,  occ: 1,    lvl: 3 },
    { id: 'c4h',  name: 'Sportler',          dur: 4 * H,    grace: 4 * H,  f: 2.7742, sign: 1062, xv: 3.85,  xe: 2.14,  occ: 1,    lvl: 3 },
    { id: 'c8h',  name: 'Pendler',           dur: 8 * H,    grace: 8 * H,  f: 3.7419, sign: 1250, xv: 7.4,   xe: 2.86,  occ: 1,    lvl: 4 },
    { id: 'c12h', name: 'Paare',             dur: 12 * H,   grace: 12 * H, f: 5.4839, sign: 3750, xv: 10.6,  xe: 4.14,  occ: 1,    lvl: 5 },
    { id: 'c18h', name: 'Promis',            dur: 18 * H,   grace: 18 * H, f: 7.0968, sign: 4500, xv: 15.5,  xe: 6,     occ: 1.15, lvl: 8 },
    { id: 'c1d',  name: 'Familien',          dur: 1 * D,    grace: 1 * D,  f: 7.7419, sign: 5000, xv: 20.2,  xe: 7.86,  occ: 1,    lvl: 5 },
    { id: 'c2d',  name: 'Künstler',          dur: 2 * D,    grace: 2 * D,  f: 10.968, sign: 6250, xv: 22.2,  xe: 8.71,  occ: 1,    lvl: 8 },
    { id: 'c3d',  name: 'Ruheständler',      dur: 3 * D,    grace: 3 * D,  f: 13.355, sign: 7500, xv: 26,    xe: 10.29, occ: 1,    lvl: 10 }
  ];
  MC.CONTRACT = {};
  MC.CONTRACTS.forEach(function (c) { MC.CONTRACT[c.id] = c; });

  /* Katalog. kind: house | shop | deco | wonder | hq
     size = Kantenlänge, cost, build = Bauzeit, lvl = ab Level
     house: rent (Grundmiete), cap (Wohnplätze), tier
     shop:  reach (Felder über den Rand hinaus), per ($ je Kunde), cycle
     deco:  reach, bonus (%)
     wonder: effect-Schlüssel + Text */
  var B = [
    { id: 'hq', kind: 'hq', name: 'Firmenzentrale', size: 2, cost: 0, build: 0, lvl: 1,
      desc: 'Dein Hauptsitz. Hier siehst du, was dein Imperium wert ist.' },

    // ---------- Häuser ----------
    { id: 'bungalow', kind: 'house', name: 'Bungalow', size: 2, cost: 30000, build: 10 * MIN, lvl: 1, rent: 1570, cap: 3, xp1: 7, sk: 1, tier: 0,
      desc: 'Klein, günstig, schnell gebaut. Der Anfang von allem.' },
    { id: 'reihenhaus', kind: 'house', name: 'Reihenhaus', size: 2, cost: 45000, build: 20 * MIN, lvl: 3, rent: 1930, cap: 3, xp1: 3, sk: 1, tier: 1,
      desc: 'Solide Mieten, mehr Bewohner.' },
    { id: 'landhaus', kind: 'house', name: 'Landhaus', size: 3, cost: 300000, build: 4 * H, lvl: 7, rent: 6350, cap: 6, xp1: 6, sk: 1.08, tier: 3,
      desc: 'Zahlungskräftige Mieter. Liebt Deko in der Nähe.' },
    { id: 'villa', kind: 'house', name: 'Villa', size: 3, cost: 1500000, build: 8 * H, lvl: 17, rent: 6975, cap: 5, xp1: 41, sk: 1.16, tier: 5,
      desc: 'Hohe Miete, wenige Bewohner.' },
    { id: 'wohnblock', kind: 'house', name: 'Wohnblock', size: 2, cost: 270000, build: 3 * H, lvl: 10, rent: 2450, cap: 9, xp1: 4, sk: 1.16, tier: 3,
      desc: 'Viele Bewohner – ideal als Kundschaft für Gewerbe.' },
    { id: 'kolonial', kind: 'house', name: 'Kolonialhaus', size: 3, cost: 900000, build: 8 * H, lvl: 13, rent: 10540, cap: 7, xp1: 55, sk: 1.16, tier: 4,
      desc: 'Prachtvoll. Mit Deko-Bonus eine Goldgrube.' },
    { id: 'luxusapart', kind: 'house', name: 'Luxus-Apartments', size: 3, cost: 750000, build: 6 * H, lvl: 15, rent: 5580, cap: 21, xp1: 20, sk: 1.16, tier: 5,
      desc: 'Massig Bewohner mit ordentlicher Miete.' },
    { id: 'chateau', kind: 'house', name: 'Château', size: 4, cost: 8000000, build: 14 * H, lvl: 27, rent: 8000, cap: 7, xp1: 92, sk: 1.6, tier: 8,
      desc: 'Ein Anwesen für die oberen Zehntausend.' },
    { id: 'luxreihenhaus', kind: 'house', name: 'Luxus-Reihenhaus', size: 2, cost: 70000, build: 30 * MIN, lvl: 5, rent: 2070, cap: 3, xp1: 3, sk: 1, tier: 2,
      desc: 'Edle Fassade, edle Mieter.' },
    { id: 'penthouse', kind: 'house', name: 'Penthouse-Turm', size: 3, cost: 0, gold: 40, build: 2 * H, lvl: 12, rent: 12000, cap: 12, xp1: 55, sk: 1.16, tier: 5,
      desc: 'Premium-Gebäude: Spitzenmiete schon früh im Spiel.' },
    { id: 'luxvilla', kind: 'house', name: 'Luxus-Villa', size: 3, cost: 3000000, build: 9 * H, lvl: 21, rent: 7905, cap: 5, xp1: 41, sk: 1.16, tier: 6,
      desc: 'Pool, Palmen, Promis.' },
    { id: 'wolkenkratzer', kind: 'house', name: 'Wolkenkratzer', size: 3, cost: 5000000, build: 10 * H, lvl: 23, rent: 6820, cap: 35, xp1: 138, sk: 1.2, tier: 7,
      desc: 'Wohnen über den Wolken – und über deinen Läden.' },
    { id: 'schloss', kind: 'house', name: 'Hochland-Schloss', size: 4, cost: 55000000, build: 19 * H, lvl: 45, rent: 42600, cap: 5, xp1: 222, sk: 16, tier: 9,
      desc: 'Mieter mit Adelstitel und dickem Konto.' },
    { id: 'supertower', kind: 'house', name: 'Super-Tower', size: 4, cost: 45000000, build: 24 * H, lvl: 37, rent: 50000, cap: 56, xp1: 333, sk: 14, tier: 9,
      desc: 'Das Nonplusultra: Top-Miete und Top-Kundschaft.' },

    // ---------- Gewerbe ----------
    { id: 'cafe', kind: 'shop', name: 'Kaffeehaus', size: 2, cost: 100000, build: 20 * MIN, lvl: 2, reach: 3, per: 45, cycle: 3 * MIN,
      desc: 'Verdient an jedem Bewohner im Einzugsgebiet.' },
    { id: 'baeckerei', kind: 'shop', name: 'Bäckerei', size: 2, cost: 150000, build: 30 * MIN, lvl: 4, reach: 3, per: 48, cycle: 3 * MIN,
      desc: 'Frische Brötchen, frisches Geld.' },
    { id: 'blumen', kind: 'shop', name: 'Blumenladen', size: 2, cost: 250000, build: 1 * H, lvl: 7, reach: 4, per: 50, cycle: 3 * MIN,
      desc: 'Großes Einzugsgebiet für wenig Fläche.' },
    { id: 'hafenbar', kind: 'shop', name: 'Hafenbar', size: 3, cost: 0, gold: 30, build: 1 * H, lvl: 8, reach: 4, per: 52, cycle: 3 * MIN,
      desc: 'Premium-Gewerbe mit großem Einzugsgebiet.' },
    { id: 'burger', kind: 'shop', name: 'Burger-Palast', size: 3, cost: 500000, build: 2 * H, lvl: 10, reach: 3, per: 53, cycle: 3 * MIN,
      desc: 'Fast Food, fast Cash.' },
    { id: 'kino', kind: 'shop', name: 'Kino', size: 3, cost: 3000000, build: 6 * H, lvl: 18, reach: 3, per: 60, cycle: 3 * MIN,
      desc: 'Großes Kino für große Viertel.' },
    { id: 'bowling', kind: 'shop', name: 'Bowlingbahn', size: 3, cost: 2000000, build: 4 * H, lvl: 16, reach: 4, per: 55, cycle: 3 * MIN,
      desc: 'Alle Neune – jede Stunde.' },
    { id: 'club', kind: 'shop', name: 'Nachtclub', size: 3, cost: 4000000, build: 8 * H, lvl: 20, reach: 4, per: 65, cycle: 3 * MIN,
      desc: 'Hier wird das Geld der Nachbarschaft verfeiert.' },
    { id: 'mall', kind: 'shop', name: 'Einkaufszentrum', size: 4, cost: 5000000, build: 10 * H, lvl: 24, reach: 5, per: 70, cycle: 3 * MIN,
      desc: 'Riesiges Einzugsgebiet, riesige Umsätze.' },
    { id: 'casino', kind: 'shop', name: 'Casino-Hotel', size: 4, cost: 15000000, build: 16 * H, lvl: 32, reach: 5, per: 85, cycle: 3 * MIN,
      desc: 'Die Bank gewinnt immer. Du bist die Bank.' },

    // ---------- Dekoration ----------
    { id: 'blumenbeet', kind: 'deco', name: 'Blumenbeet', size: 1, cost: 2000, build: 0, lvl: 1, reach: 1, bonus: 2, desc: '+2 % Miete für Häuser direkt daneben.' },
    { id: 'eiche', kind: 'deco', name: 'Eiche', size: 1, cost: 3000, build: 0, lvl: 3, reach: 2, bonus: 2, desc: '+2 % Miete im Umkreis.' },
    { id: 'palme', kind: 'deco', name: 'Palme', size: 1, cost: 5000, build: 0, lvl: 5, reach: 1, bonus: 3, desc: '+3 % Miete im Umkreis.' },
    { id: 'bank', kind: 'deco', name: 'Parkbank', size: 1, cost: 24000, build: 0, lvl: 8, reach: 2, bonus: 5, desc: '+5 % Miete, größerer Umkreis.' },
    { id: 'brunnen', kind: 'deco', name: 'Springbrunnen', size: 2, cost: 80000, build: 0, lvl: 11, reach: 2, bonus: 14, desc: '+14 % Miete im Umkreis.' },
    { id: 'kristallbrunnen', kind: 'deco', name: 'Kristallbrunnen', size: 2, cost: 0, gold: 15, build: 0, lvl: 7, reach: 2, bonus: 20, desc: 'Premium-Deko: +25 % Miete im Umkreis.' },
    { id: 'goldstatue', kind: 'deco', name: 'Goldstatue', size: 1, cost: 120000, build: 0, lvl: 15, reach: 3, bonus: 10, desc: '+10 % Miete, großer Umkreis.' },
    { id: 'park', kind: 'deco', name: 'Stadtpark', size: 3, cost: 2000000, build: 0, lvl: 20, reach: 4, bonus: 30, desc: '+30 % Miete im Umkreis.' },
    { id: 'skulptur', kind: 'deco', name: 'Skulpturengarten', size: 2, cost: 3500000, build: 0, lvl: 26, reach: 5, bonus: 35, desc: '+35 % Miete, sehr großer Umkreis.' },

    // ---------- Weltwunder ----------
    { id: 'w_statue', kind: 'wonder', name: 'Gründerdenkmal', size: 2, cost: 175000, build: 12 * H, lvl: 7, effect: 'rent', val: 5, desc: '+5 % Miete in der ganzen Stadt.' },
    { id: 'w_uhr', kind: 'wonder', name: 'Großer Uhrturm', size: 2, cost: 1000000, build: 18 * H, lvl: 11, effect: 'grace', val: 50, desc: '+50 % Zeit zum Kassieren, bevor Mieter abspringen.' },
    { id: 'w_rad', kind: 'wonder', name: 'Riesenrad', size: 3, cost: 2000000, build: 24 * H, lvl: 14, effect: 'xp', val: 10, desc: '+10 % Erfahrung auf alles.' },
    { id: 'w_turm', kind: 'wonder', name: 'Stahlturm', size: 3, cost: 5000000, build: 36 * H, lvl: 18, effect: 'shop', val: 15, desc: '+15 % Gewerbe-Einnahmen in der ganzen Stadt.' },
    { id: 'w_freiheit', kind: 'wonder', name: 'Freiheitsmonument', size: 3, cost: 8000000, build: 48 * H, lvl: 21, effect: 'daily', val: 100, desc: 'Verdoppelt den Tagesbonus.' },
    { id: 'w_pyramide', kind: 'wonder', name: 'Sonnenpyramide', size: 4, cost: 20000000, build: 60 * H, lvl: 26, effect: 'rent', val: 10, desc: '+10 % Miete in der ganzen Stadt.' },
    { id: 'w_rakete', kind: 'wonder', name: 'Raumfähre', size: 3, cost: 60000000, build: 72 * H, lvl: 32, effect: 'build', val: 25, desc: 'Alle Bauzeiten 25 % kürzer.' },
    // Freunde werben: erster geworbener Freund schaltet es frei, jeder Freund (ab Level 3) bringt +1 % auf Mieten und Gewerbe
    { id: 'w_freunde', kind: 'wonder', name: 'Platz der Freundschaft', size: 2, cost: 0, build: 1 * MIN, lvl: 1, effect: 'friends', val: 1, friend: true,
      desc: 'Erster Freund: +5 % auf alle Mieten und Gewerbe-Einnahmen, jeder weitere Freund +1 % (bis 25 %). Für jeden Freund weht hier eine Fahne.' }
  ];
  MC.BUILDINGS = B;
  MC.DEF = {};
  B.forEach(function (d) { MC.DEF[d.id] = d; });

  MC.KINDS = [
    { id: 'house', name: 'Häuser' },
    { id: 'shop', name: 'Gewerbe' },
    { id: 'deco', name: 'Deko' },
    { id: 'wonder', name: 'Wunder' }
  ];

  // Preise der Landerweiterungen (in Kaufreihenfolge): [Dollar, Gold]
  MC.LAND = [
    [60000, 0], [1000000, 0], [4000000, 5], [6000000, 8], [7000000, 10], [9000000, 12],
    [30000000, 15], [36000000, 18], [42000000, 20], [48000000, 22], [60000000, 25], [75000000, 28],
    [90000000, 30], [110000000, 32], [130000000, 35], [155000000, 38], [180000000, 40], [210000000, 42],
    [245000000, 45], [285000000, 48], [330000000, 50], [380000000, 55], [440000000, 60], [510000000, 65]
  ];

  MC.TITLES = [
    [0, 'Kleinunternehmer'], [100000, 'Geschäftsmann'], [1000000, 'Millionär'], [10000000, 'Multimillionär'],
    [100000000, 'Tycoon'], [1000000000, 'Milliardär'], [10000000000, 'Mogul']
  ];

  /* Freischaltungen: Funktion -> ab Level (Plan: docs/TUTORIAL-PLAN.md). Gesperrtes wird ausgeblendet. */
  MC.FEATURES = {
    deko: 1,        // Laden-Reiter Deko (anfangs nur Blumenbeet)
    gewerbe: 2,     // Laden-Reiter Gewerbe
    move: 3,        // Werkzeug Umsetzen
    bulldoze: 3,    // Werkzeug Abriss
    lease: 3,       // Werkzeug Vermieten (Vertrag wählen, über Häuser wischen)
    collectall: 4,  // Knopf „Kassieren“ für alles
    daily: 4,       // Tagesbonus (zusätzlich erst ab der 2. Sitzung)
    land: 5,        // Grundstücke kaufen
    sets: 6,        // Sammlungen
    wonder: 7,      // Laden-Reiter Wunder
    goldex: 7,      // Gold eintauschen
    premium: 7      // Premium-Gebäude (Gold) im Laden
  };
  // Vorstellung einer neuen Funktion nach dem Level-up: Level -> [Sprecherzeile, Ziel-Element]
  MC.FEATURE_INTRO = {
    2: ['neu_gewerbe', '[data-act=shop]'],
    3: ['neu_werkzeuge', '[data-act=move]'],
    4: ['neu_tagesbonus', '[data-act=collect]'],
    5: ['neu_land', null],
    6: ['neu_sammlung', '#lvlBox'],
    7: ['neu_wunder', '[data-act=shop]']
  };

  // Wert eines Goldbarrens in Dollar (Tausch und Firmenwert), steigt mit dem Level
  MC.goldRate = function (L) { return Math.max(1000, Math.round(500 * Math.pow(L, 1.6) / 100) * 100); };
  MC.MOVE_FEE = 0.1;       // Umsetzen kostet 10 % des Gebäudewerts
  MC.MOVE_PASS = { gold: 10, dur: 24 * H };

  /* Berater (Spieler wählt zu Beginn). Porträts: assets/sprites/berater_<id>.svg,
     Stimmen: assets/voice/<id>/<zeile>.mp3 */
  MC.ADVISORS = [
    { id: 'viktor', name: 'Viktor Kronberg', role: 'Alter Hase im Immobiliengeschäft', color: '#3b6ea8',
      voice: 'männlich, ca. 60, tief, warm, verschmitzt, leicht rauchig' },
    { id: 'bella', name: 'Bella Diamant', role: 'Investorin aus Kyjiw mit Riecher für gute Geschäfte', color: '#c2417a',
      voice: 'weiblich, ca. 30, Ukrainerin mit charmantem Akzent, warm, leicht rauchig, natürlich, trockener Humor' }
  ];

  /* Sammlungen: Sammelstücke fallen zufällig beim Kassieren. Icons: assets/sprites/samm_<set>_<n>.svg */
  MC.COLLECTIONS = [
    { id: 'muenzen', name: 'Alte Münzen', lvl: 1, items: ['Kupferpfennig', 'Silbertaler', 'Golddukat', 'Kaisermünze', 'Fehlprägung'], r: { cash: 50000, gold: 1, xp: 50 } },
    { id: 'schluessel', name: 'Schlüsselbund', lvl: 4, items: ['Hausschlüssel', 'Tresorschlüssel', 'Autoschlüssel', 'Schlüsselkarte', 'Generalschlüssel'], r: { cash: 100000, gold: 2, xp: 120 } },
    { id: 'marken', name: 'Briefmarken', lvl: 8, items: ['Blaue Marke', 'Rote Marke', 'Jubiläumsmarke', 'Luftpost', 'Fehldruck'], r: { cash: 250000, gold: 2, xp: 300 } },
    { id: 'uhren', name: 'Taschenuhren', lvl: 12, items: ['Messinguhr', 'Silberuhr', 'Golduhr', 'Chronograph', 'Mondphasenuhr'], r: { cash: 600000, gold: 3, xp: 700 } },
    { id: 'steine', name: 'Edelsteine', lvl: 16, items: ['Amethyst', 'Saphir', 'Smaragd', 'Rubin', 'Diamant'], r: { cash: 1500000, gold: 4, xp: 1500 } },
    { id: 'oldtimer', name: 'Oldtimer-Modelle', lvl: 20, items: ['Roadster', 'Limousine', 'Cabrio', 'Rennwagen', 'Luxuscoupé'], r: { cash: 4000000, gold: 5, xp: 3000 } }
  ];
  MC.DROP_HOUSE = 0.06;    // Grundchance je kassierter Miete (+0,5 % je Haus-Stufe)
  MC.DROP_SHOP = 0.03;

  /* Soundeffekte: assets/sounds/<id>.mp3 (fehlt eine Datei, spielt ein Ersatzklang) */
  MC.SOUNDS = [
    ['tap', 'Knopf gedrückt (sehr kurz, dezent)'],
    ['open', 'Fenster/Menü öffnet'],
    ['close', 'Fenster schließt'],
    ['collect', 'Miete kassiert (Münzklimpern, befriedigend)'],
    ['collect_all', 'Viele Einnahmen auf einmal (Münzregen)'],
    ['shop_collect', 'Gewerbe-Kasse (Registrierkasse)'],
    ['sign', 'Mietvertrag unterschrieben (Stift + Stempel)'],
    ['build', 'Gebäude platziert (Baustellen-Rumms)'],
    ['built', 'Gebäude fertig (kleine Fanfare)'],
    ['road', 'Straßenstück gelegt (kurzes Klacken)'],
    ['move', 'Gebäude umgesetzt'],
    ['demolish', 'Abriss (Einsturz, Staub)'],
    ['expired', 'Mieter weg / Miete verfallen (enttäuscht)'],
    ['level', 'Level-Aufstieg (große Fanfare)'],
    ['mission', 'Ziel erreicht'],
    ['daily', 'Tagesbonus eingesammelt'],
    ['land', 'Grundstück gekauft'],
    ['found', 'Sammelstück gefunden (Glitzern)'],
    ['set', 'Sammlung komplett'],
    ['gold', 'Gold ausgegeben / Sofort fertig'],
    ['error', 'Geht nicht / zu wenig Geld (sanft)']
  ];
  MC.MUSIC = [['musik_1', 'Hauptthema: entspannt, beschwingt, Lounge/Jazz-Pop, nahtlose Schleife 60–120 s'],
    ['musik_2', 'Zweites Stück im selben Stil (optional, wird abwechselnd gespielt)']];

  /* Sprecherzeilen der Berater (zusätzlich liest der Berater jede Ziel-Beschreibung vor: mission_<nr>) */
  MC.VOICE = {
    begruessung: 'Willkommen in deiner neuen Stadt, Chef! Ich bin dein Berater. Lass uns aus diesem Stück Land ein Imperium machen.',
    ziel_fertig: 'Hervorragend! Das Ziel ist erreicht. Hol dir deine Belohnung ab.',
    level: 'Ein neues Level! Schau ins Baumenü, da gibt es Neues für dich.',
    verfallen: 'Oh nein, die Mieter sind weg! Beim nächsten Mal rechtzeitig kassieren.',
    tagesbonus: 'Schön, dass du wieder da bist! Hier ist dein Tagesbonus.',
    land: 'Mehr Land, mehr Möglichkeiten. Gute Investition!',
    sammlung: 'Eine Sammlung komplett! Das zahlt sich aus.',
    kein_geld: 'Dafür reicht das Geld noch nicht. Erst ein paar Mieten kassieren.',
    wunder: 'Ein Weltwunder! Die ganze Stadt profitiert davon.',
    million: 'Die erste Million! Ich wusste, dass in dir ein Mogul steckt.',
    alles: 'Du hast alle Ziele geschafft. Ich bin sprachlos, Chef!',
    // Tutorial
    tut_1: 'Jede Stadt beginnt mit einer Straße. Tippe auf Straße und zieh sie entlang der Markierung.',
    tut_2: 'Sehr gut. Jetzt dein erstes Haus: Tippe auf Bauen und wähle den Bungalow.',
    tut_3: 'Setz ihn auf das leuchtende Feld direkt an der Straße und tippe dann auf Bauen.',
    tut_4: 'Ein Haus ohne Mieter bringt nichts. Tippe auf das Vertragssymbol und nimm die Tagesgäste.',
    tut_5: 'Während wir warten: Ein Blumenbeet macht die Miete teurer. Ich schenke dir eins. Setz es direkt neben das Haus.',
    tut_6: 'Die Miete ist fällig! Tippe auf die Münze und hol sie dir.',
    tut_7: 'Merk dir eins: Jede Miete muss rechtzeitig abgeholt werden. Wer zu spät kommt, dessen Mieter ziehen aus.',
    tut_8: 'Unter Ziele siehst du immer, was als Nächstes zu tun ist. Viel Erfolg, Chef!',
    // neue Funktionen
    neu_gewerbe: 'Neu: Gewerbe! Ein Kaffeehaus verdient an jedem Bewohner in seiner Nähe. Bau es mitten zwischen deine Häuser.',
    neu_werkzeuge: 'Ab jetzt kannst du Gebäude umsetzen und abreißen. Die Werkzeuge findest du unten in der Leiste.',
    neu_tagesbonus: 'Neu: Mit Kassieren holst du alle fälligen Mieten auf einmal. Und wer jeden Tag vorbeischaut, bekommt einen Tagesbonus.',
    neu_land: 'Deine Stadt wird zu klein? Ab jetzt kannst du Grundstücke kaufen. Tippe auf ein Verkaufsschild am Stadtrand.',
    neu_sammlung: 'Neu: Sammlungen! Beim Kassieren findest du manchmal Sammelstücke. Volle Sammlungen tauschst du in der Zentrale gegen Belohnungen.',
    neu_wunder: 'Jetzt wird es groß: Weltwunder! Sie wirken auf die ganze Stadt. Außerdem kannst du Gold eintauschen und Premium-Gebäude bauen.',
    // Sitzungen
    freunde: 'Chef, ich hab eine Idee: Lad deine Freunde ein! Sobald der erste mitspielt, baust du den Platz der Freundschaft, und alle Mieten und Läden bringen fünf Prozent mehr. Jeder weitere Freund legt noch ein Prozent drauf.',
    freunde_erinnerung: 'Denk an deine Freunde, Chef! Schon ein einziger Freund bringt dir fünf Prozent mehr auf die ganze Stadt.',
    freund_neu: 'Großartig, dein erster Freund spielt mit! Der Platz der Freundschaft wartet auf dich. Bau ihn gleich!',
    freund_mehr: 'Noch ein Freund ist dabei! Wieder ein Prozent mehr für deine ganze Stadt.',
    tipp_vertraege: 'Kurz erklärt, Chef: Kurze Verträge bringen pro Stunde am meisten, aber nur, wenn du gleich wieder kassierst. Perfekt für ein paar Minuten zwischendurch, in der Bahn oder auf dem Klo. Lange Verträge zahlen pro Vertrag mehr, pro Stunde aber weniger. Die nimmst du, wenn du länger weg bist, zum Beispiel über Nacht.',
    tipp_lang: 'Legst du das Handy gleich weg? Dann gib deinen Häusern jetzt lange Verträge. Sonst verfällt die Miete, bevor du zurück bist.',
    tipp_verfallen: 'Autsch, da sind Mieter abgesprungen, weil die Miete zu lange lag. Vor einer längeren Pause also lieber lange Verträge abschließen.',
    tipp_deko: 'Deko ist mehr als Schmuck: Jedes Beet und jeder Baum hebt die Miete der Häuser daneben, und mehrere Stücke um ein Haus zählen zusammen. Beim Platzieren siehst du den Bonus.',
    tipp_gewerbe: 'Dein Laden verdient an jedem Bewohner in der Nähe, aber nur, solange dessen Mietvertrag läuft. Halte die Häuser rundherum also vermietet.',
    tipp_pinsel: 'Viele Häuser auf einmal? Tipp unten auf Vermieten, wähl einen Vertrag und wisch einfach über die Häuser. Fällige werden dabei gleich kassiert.',
    tipp_strasse: 'Ohne Straße keine Mieter! Jedes Haus und jeder Laden braucht eine Straße direkt daneben.',
    tipp_sammeln: 'Ein Sammelstück! Die findest du ab und zu beim Kassieren. Eine volle Sammlung tauschst du in der Firmenzentrale gegen eine Belohnung ein.',
    langer_vertrag: 'Kleiner Tipp: Wenn du gleich weg musst, nimm einen langen Vertrag. Die Miete wartet dann auf dich.',
    zurueck: 'Schön, dass du zurück bist, Chef! Schau mal, was in der Zwischenzeit passiert ist.'
  };
  /* Tutorial: feste Stellen relativ zur Firmenzentrale (dx, dy) */
  MC.TUT = {
    road: [[-3, 3], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3]],
    house: [-2, 1],          // Bungalow 2×2, unten an der Straße
    deco: [-3, 2],           // Blumenbeet links neben dem Haus
    buildTime: 3000,         // Bauzeit im Tutorial
    contractTime: 20000,     // Probemieter
    contractXp: 15,          // damit das Kassieren Level 2 auslöst
    reward: 50000,           // Abschlussbelohnung (+1 Gold)
    rushLevel: 6,            // Starthilfe: bis zu diesem Level höchstens rushTime Bauzeit (erste ~20 Min. ohne Warten)
    rushTime: 60000
  };

  // XP, die für den Aufstieg von Level L auf L+1 nötig sind
  // XP für den Aufstieg von Level L auf L+1: am Anfang kleine Schritte (Freischaltungen in der ersten Sitzung),
  // danach steiler wie im Original (Ziel: aktiv Level 10 an Tag 1-2, Level 17 nach ~1 Woche, Level 37 nach ~2 Monaten)
  MC.XP_EARLY = [0, 120, 330, 450, 600, 800, 1000, 1200, 1400, 1600];   // L3 ~6 Min., L4 ~12, L5 ~20 (Einstiegs-Test)
  MC.xpNeed = function (L) { return L < MC.XP_EARLY.length ? MC.XP_EARLY[L] : Math.round(1300 * Math.pow(L / 9, 2.75) / 50) * 50; };
  // Bau-XP wie im Original: Baukosten / 300 (Gold-Gebäude zum Kurs ihres Levels)
  MC.buildXp = function (def) { return Math.max(5, Math.round((def.cost + (def.gold || 0) * MC.goldRate(def.lvl)) / 300)); };
  MC.levelBonus = function (L) { return Math.round(L * L * 250 / 100) * 100; };
  /* Vertragskonditionen (eine Quelle für Spiel und Simulation). bonus = Deko-%, rentFx = Wunder-% auf Miete */
  MC.offerOf = function (d, c, bonus, rentFx) {
    var mult = (1 + (bonus || 0) / 100) * (1 + (rentFx || 0) / 100);
    var xf = d.xp1 <= 8 ? c.xe : c.xv;
    return {
      cost: Math.round(c.sign * (d.sk || 1)),
      pay: Math.round(d.rent * c.f * mult),
      n: Math.max(1, Math.round(d.cap * (c.occ || 1))),
      xp: Math.max(1, Math.round(d.xp1 * xf))
    };
  };

  /* Missionen (der Reihe nach). check(S, G) -> [ist, soll]; reward: {cash, gold, xp} */
  function count(S, f) { var n = 0; for (var i = 0; i < S.b.length; i++) if (f(S.b[i], MC.DEF[S.b[i].t])) n++; return n; }
  function done(b) { return !b.cu; }
  MC.MISSIONS = [
    { t: 'Erste Straße', d: 'Baue 3 Felder Straße. Häuser und Läden brauchen einen Straßenanschluss.', check: function (S) { return [S.st.roads, 3]; }, r: { cash: 10000 } },
    { t: 'Das erste Haus', d: 'Baue einen Bungalow direkt an eine Straße.', check: function (S) { return [count(S, function (b, d) { return d.id === 'bungalow'; }), 1]; }, r: { cash: 15000 } },
    { t: 'Mieter gesucht', d: 'Tippe auf das fertige Haus und schließe einen Mietvertrag ab.', check: function (S) { return [S.st.signed, 1]; }, r: { xp: 15 } },
    { t: 'Zahltag', d: 'Kassiere die Miete, sobald der Vertrag abgelaufen ist – aber lass sie nicht verfallen!', check: function (S) { return [S.st.collected, 1]; }, r: { cash: 15000 } },
    { t: 'Kleine Siedlung', d: 'Besitze 3 fertige Häuser.', check: function (S) { return [count(S, function (b, d) { return d.kind === 'house' && done(b); }), 3]; }, r: { cash: 60000, xp: 100 } },
    { t: 'Grüner Daumen', d: 'Setze 3 Dekorationen neben deine Häuser. Deko erhöht die Miete.', check: function (S) { return [count(S, function (b, d) { return d.kind === 'deco'; }), 3]; }, r: { cash: 50000 } },
    { t: 'Koffein fürs Viertel', lvl: 2, d: 'Baue ein Kaffeehaus mitten zwischen deine Häuser.', check: function (S) { return [count(S, function (b, d) { return d.id === 'cafe' && done(b); }), 1]; }, r: { cash: 80000, gold: 1 } },
    { t: 'Laufkundschaft', lvl: 2, d: 'Kassiere Einnahmen aus einem Gewerbe. Es verdient an Bewohnern mit laufendem Mietvertrag.', check: function (S) { return [S.st.shopCollected, 1]; }, r: { cash: 50000 } },
    { t: 'Aufhübschen I', d: 'Bringe ein Haus auf mindestens 12 % Deko-Bonus.', check: function (S, G) { return [G.maxBonus(), 12]; }, r: { cash: 70000, xp: 150 } },
    { t: 'Fleißiger Vermieter', d: 'Kassiere 15 Mal Miete.', check: function (S) { return [S.st.collected, 15]; }, r: { cash: 70000 } },
    { t: 'Sechsstellig', d: 'Erreiche einen Firmenwert von 100.000 $.', check: function (S, G) { return [G.netWorth(), 100000]; }, r: { cash: 20000, gold: 1 } },
    { t: 'Mehr Platz', lvl: 5, d: 'Kaufe ein angrenzendes Grundstück. Tippe auf ein Verkaufsschild am Stadtrand.', check: function (S) { return [S.land.length - 1, 1]; }, r: { cash: 60000, xp: 150 } },
    { t: 'Aufhübschen II', d: 'Bringe ein Haus auf mindestens 30 % Deko-Bonus.', check: function (S, G) { return [G.maxBonus(), 30]; }, r: { cash: 150000 } },
    { t: 'Einkaufsstraße', lvl: 2, d: 'Besitze 3 fertige Gewerbe.', check: function (S) { return [count(S, function (b, d) { return d.kind === 'shop' && done(b); }), 3]; }, r: { cash: 150000, gold: 1 } },
    { t: 'Volles Haus', d: 'Beherberge gleichzeitig 100 Bewohner.', check: function (S, G) { return [G.totalTenants(), 100]; }, r: { cash: 150000 } },
    { t: 'Ein Denkmal für mich', lvl: 7, d: 'Errichte das Gründerdenkmal (Weltwunder).', check: function (S) { return [count(S, function (b, d) { return d.id === 'w_statue' && done(b); }), 1]; }, r: { cash: 100000, gold: 2 } },
    { t: 'Sammelleidenschaft', lvl: 6, d: 'Beim Kassieren findest du manchmal Sammelstücke. Vervollständige eine Sammlung in deiner Firmenzentrale.', check: function (S) { return [S.st.sets || 0, 1]; }, r: { cash: 150000, gold: 2 } },
    { t: 'Die erste Million', d: 'Erreiche einen Firmenwert von 1 Million $.', check: function (S, G) { return [G.netWorth(), 1000000]; }, r: { cash: 100000, gold: 3 } },
    { t: 'Aufhübschen III', d: 'Bringe ein Haus auf mindestens 60 % Deko-Bonus.', check: function (S, G) { return [G.maxBonus(), 60]; }, r: { cash: 200000 } },
    { t: 'Großgrundbesitzer', lvl: 5, d: 'Besitze 5 Grundstücke.', check: function (S) { return [S.land.length, 5]; }, r: { cash: 1500000, gold: 2 } },
    { t: 'Kleinstadt', d: 'Beherberge gleichzeitig 500 Bewohner.', check: function (S, G) { return [G.totalTenants(), 500]; }, r: { cash: 1000000 } },
    { t: 'Sparfuchs', d: 'Habe 3 Millionen $ auf dem Konto.', check: function (S) { return [S.cash, 3000000]; }, r: { gold: 3 } },
    { t: 'Zehn Millionen', d: 'Erreiche einen Firmenwert von 10 Millionen $.', check: function (S, G) { return [G.netWorth(), 10000000]; }, r: { cash: 1000000, gold: 3 } },
    { t: 'Rockstar-Villa', d: 'Bringe ein Haus auf mindestens 90 % Deko-Bonus.', check: function (S, G) { return [G.maxBonus(), 90]; }, r: { cash: 1500000 } },
    { t: 'Wunder über Wunder', lvl: 7, d: 'Besitze 3 fertige Weltwunder.', check: function (S) { return [count(S, function (b, d) { return d.kind === 'wonder' && done(b); }), 3]; }, r: { cash: 3000000, gold: 5 } },
    { t: 'Skyline', d: 'Baue einen Wolkenkratzer.', check: function (S) { return [count(S, function (b, d) { return d.id === 'wolkenkratzer' && done(b); }), 1]; }, r: { cash: 3000000, gold: 3 } },
    { t: 'Tycoon', d: 'Erreiche einen Firmenwert von 100 Millionen $.', check: function (S, G) { return [G.netWorth(), 100000000]; }, r: { cash: 10000000, gold: 5 } },
    { t: 'Großstadt', d: 'Beherberge gleichzeitig 3.000 Bewohner.', check: function (S, G) { return [G.totalTenants(), 3000]; }, r: { cash: 20000000, gold: 5 } },
    { t: 'Milliardär', d: 'Erreiche einen Firmenwert von 1 Milliarde $.', check: function (S, G) { return [G.netWorth(), 1000000000]; }, r: { cash: 100000000, gold: 20 } },
    { t: 'Alle Weltwunder', d: 'Besitze alle 7 Weltwunder.', check: function (S) { return [count(S, function (b, d) { return d.kind === 'wonder' && done(b); }), 7]; }, r: { gold: 50 } }
  ];

  // ---------- Formatierung ----------
  MC.money = function (n) {
    n = Math.floor(n);
    var a = Math.abs(n);
    if (a >= 1e9) return trim(n / 1e9) + ' Mrd. $';
    if (a >= 1e7) return trim(n / 1e6) + ' Mio. $';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' $';
  };
  MC.short = function (n) {
    n = Math.floor(n);
    var a = Math.abs(n);
    if (a >= 1e9) return trim(n / 1e9) + ' Mrd.';
    if (a >= 1e6) return trim(n / 1e6) + ' Mio.';
    if (a >= 1e4) return trim(n / 1e3) + ' Tsd.';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  function trim(x) {
    var s = (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  MC.dur = function (ms) {
    if (ms < 0) ms = 0;
    var s = Math.ceil(ms / 1000);
    if (s < 60) return s + ' Sek.';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' Min.' + (m < 5 && s % 60 ? ' ' + (s % 60) + ' Sek.' : '');
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' Std.' + (m % 60 ? ' ' + (m % 60) + ' Min.' : '');
    var d = Math.floor(h / 24);
    return d + (d === 1 ? ' Tag' : ' Tage') + (h % 24 ? ' ' + (h % 24) + ' Std.' : '');
  };
  MC.durShort = function (ms) {
    var m = Math.round(ms / MIN);
    if (m < 1) return Math.round(ms / 1000) + ' Sek.';
    if (m < 60) return m + ' Min.';
    if (m < 1440) return (m / 60) + ' Std.';
    return (m / 1440) + (m === 1440 ? ' Tag' : ' Tage');
  };
})();
