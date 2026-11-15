/* Mogul City – Mondkolonie (Spiellogik). Freigeschaltet durch die fertige Raumfähre (Weltwunder).
   Rohstoffe statt Geld: Baustoffe (bauen), Treibstoff (größere Bauten, Raketenflüge), Helium-3 (Export zur Erde),
   Kolonisten (Wohnkuppeln; höhere Betriebe brauchen Arbeiter). Betriebe antippen = ein Durchgang; Manager
   (bezahlt mit Erd-Dollar) arbeiten automatisch, auch offline bis MOON.OFFLINE. Kolonisten geben Mietbonus auf der Erde.
   Alle Zahlen in MC.MOON – zum Nachjustieren. Plan: docs/MOND-PLAN.md */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G, MIN = MC.MIN, H = MC.H;
  // Noch nicht live: erst wenn Fables Grafiken da sind auf true setzen. Zum Testen: Spiel mit ?mond=1 öffnen.
  MC.MOON_LIVE = true;
  var TRY = typeof location !== 'undefined' && /[?&]mond=1/.test(location.search);

  MC.MOON = {
    OFFLINE: 8 * H,             // so lange arbeiten Manager ohne dich weiter
    START: { bau: 60, fuel: 0, he3: 0, free: { bagger: 1 } },   // Startpaket der Raumfähre
    RES: { bau: 'Baustoffe', fuel: 'Treibstoff', he3: 'Helium-3', kol: 'Kolonisten' },
    // out: erzeugter Rohstoff je Stück und Durchgang · cyc: Dauer · cost: Grundpreis · grow: Preisanstieg je Stück
    // crew: Arbeiter (Kolonisten) je Stück · home: Wohnplätze je Stück · mgr: Managerpreis in Erd-Dollar
    // ship: + Frachtkapazität je Stück (Raumhafen)
    B: [
      { id: 'bagger', name: 'Regolith-Bagger', out: 'bau', amt: 1, cyc: 3000, cost: { bau: 10 }, grow: 1.07, crew: 0, mgr: 50000,
        desc: 'Schürft Mondgestein und macht daraus Baustoffe.' },
      { id: 'eis', name: 'Eisbohrer', out: 'fuel', amt: 1, cyc: 12000, cost: { bau: 60 }, grow: 1.08, crew: 0, mgr: 200000,
        desc: 'Roboter-Bohrer: holt Wassereis aus den Kratern und spaltet es zu Treibstoff.' },
      { id: 'kuppel', name: 'Wohnkuppel', home: 4, cost: { bau: 150, fuel: 20 }, grow: 1.10, crew: 0,
        desc: 'Platz für 4 Kolonisten. Ohne Kolonisten keine Arbeiter für Minen und Fabriken.' },
      { id: 'mine', name: 'Helium-Mine', out: 'he3', amt: 1, cyc: 60000, cost: { bau: 800, fuel: 100 }, grow: 1.10, crew: 2, mgr: 2000000,
        desc: 'Fördert Helium-3 – das wertvollste Exportgut des Mondes.' },
      { id: 'werk', name: 'Baustoff-Fabrik', out: 'bau', amt: 40, cyc: 30000, cost: { bau: 3000, fuel: 300 }, grow: 1.11, crew: 3, mgr: 5000000,
        desc: 'Presst Mondbeton in großen Mengen.' },
      { id: 'raff', name: 'Helium-Raffinerie', out: 'he3', amt: 25, cyc: 8 * MIN, cost: { bau: 20000, fuel: 2500, he3: 50 }, grow: 1.12, crew: 5, mgr: 20000000,
        desc: 'Reinigt Helium-3 in großem Stil.' },
      { id: 'hafen', name: 'Raumhafen', ship: 100, cost: { bau: 50000, fuel: 8000 }, grow: 1.15, crew: 4,
        desc: 'Mehr Ladung und kürzere Flüge für die Frachtrakete.' },
      { id: 'mega', name: 'Mega-Kuppel', home: 60, cost: { bau: 250000, fuel: 40000, he3: 500 }, grow: 1.20, crew: 0,
        desc: 'Eine ganze Stadt unter Glas: Platz für 60 Kolonisten.' }
    ],
    // Meilensteine je Betrieb: ab n Stück schneller (Dauer halbiert) bzw. doppelter Ertrag
    MILE: [[10, 'x2'], [25, 'speed'], [50, 'x2'], [100, 'speed'], [200, 'x2'], [400, 'x2']],
    ROCKET: { base: 50, fuel: 20, fuelPer: 0.2, dur: 15 * MIN, durPerPort: MIN, minDur: 5 * MIN, rate: 500 },   // rate: Dollar je Helium-3
    BONUS: { per: 40, max: 15 },  // je 40 Kolonisten +1 % Miete auf der Erde, höchstens +15 %
    // Mond-Sammlungen: Funde beim Fertigstellen von Durchgängen (wie auf der Erde beim Kassieren), danach Pause
    COLL: [
      { id: 'meteor', name: 'Meteoriten', items: ['Eisenmeteorit', 'Steinmeteorit', 'Pallasit', 'Tektit', 'Sternenstaub'], r: { he3: 50, gold: 3 } },
      { id: 'andenken', name: 'Raumfahrt-Andenken', items: ['Missionsabzeichen', 'Helm-Modell', 'Flaggenwimpel', 'Bordbuch', 'Fußabdruck-Abguss'], r: { bau: 2000, fuel: 500, gold: 5 } },
      { id: 'proben', name: 'Mondproben', items: ['Basalt', 'Anorthosit', 'Regolith-Glas', 'Eiskern', 'Helium-Kristall'], r: { he3: 200, gold: 8 } }
    ],
    DROP: { chance: 0.05, pause: [20, 60], firstAfter: 5 },
    // Mond-Ziele (der Reihe nach)
    GOALS: [
      { t: 'Bagger-Flotte', d: 'Besitze 5 Regolith-Bagger.', c: function (m) { return [G.moonCount('bagger'), 5]; }, r: { bau: 100 } },
      { t: 'Eis aus dem Krater', d: 'Baue einen Eisbohrer.', c: function () { return [G.moonCount('eis'), 1]; }, r: { fuel: 30 } },
      { t: 'Erste Kolonisten', d: 'Baue eine Wohnkuppel.', c: function () { return [G.moonCount('kuppel'), 1]; }, r: { bau: 300 } },
      { t: 'Das weiße Gold', d: 'Baue eine Helium-Mine.', c: function () { return [G.moonCount('mine'), 1]; }, r: { he3: 5 } },
      { t: 'Fracht zur Erde', d: 'Schicke eine Frachtrakete zur Erde.', c: function (m) { return [m.flights || 0, 1]; }, r: { gold: 3 } },
      { t: 'Chef vom Mond', d: 'Stelle einen Manager ein.', c: function (m) { var n = 0; Object.keys(m.b).forEach(function (k) { if (m.b[k].mgr) n++; }); return [n, 1]; }, r: { bau: 1000 } },
      { t: 'Kleine Kolonie', d: 'Biete 40 Kolonisten Platz.', c: function () { return [G.moonHomes(), 40]; }, r: { fuel: 500 } },
      { t: 'Sternensammler', d: 'Vervollständige eine Mond-Sammlung.', c: function (m) { return [m.sets || 0, 1]; }, r: { he3: 100, gold: 5 } },
      { t: 'Tor zu den Sternen', d: 'Baue einen Raumhafen.', c: function () { return [G.moonCount('hafen'), 1]; }, r: { he3: 200 } },
      { t: 'Stadt unter Glas', d: 'Baue die Mega-Kuppel.', c: function () { return [G.moonCount('mega'), 1]; }, r: { gold: 20 } }
    ]
  };
  var M = MC.MOON, BY = {};
  M.B.forEach(function (b) { BY[b.id] = b; });
  M.byId = BY;

  function S() { return G.S; }
  G.moonUnlocked = function () {
    if (!MC.MOON_LIVE && !TRY) return false;
    var s = S();
    return s.b.some(function (b) { return b.t === 'w_rakete' && !b.cu; });
  };
  G.moon = function () {   // Mondstand anlegen (beim ersten Flug)
    var s = S();
    if (!s.moon) {
      s.moon = { bau: M.START.bau, fuel: M.START.fuel, he3: M.START.he3, b: {}, rocket: null, last: G.now(), shipped: 0 };
      Object.keys(M.START.free).forEach(function (id) { s.moon.b[id] = { n: M.START.free[id], s: 0, mgr: false }; });
      G.save();
    }
    return s.moon;
  };
  function st(id) { var m = G.moon(); return m.b[id] || (m.b[id] = { n: 0, s: 0, mgr: false }); }
  G.moonCount = function (id) { var m = S().moon; return m && m.b[id] ? m.b[id].n : 0; };

  // Kolonisten (Wohnplätze) und Arbeiter
  G.moonHomes = function () { var h = 0; M.B.forEach(function (b) { if (b.home) h += b.home * G.moonCount(b.id); }); return h; };
  G.moonCrew = function () { var c = 0; M.B.forEach(function (b) { if (b.crew) c += b.crew * G.moonCount(b.id); }); return c; };
  G.moonFreeCrew = function () { return G.moonHomes() - G.moonCrew(); };
  G.moonBonus = function () {   // Mietbonus auf der Erde in %
    if (!S().moon) return 0;
    return Math.min(M.BONUS.max, Math.floor(G.moonHomes() / M.BONUS.per));
  };

  // Meilensteine
  function mult(id) {
    var n = G.moonCount(id), x = 1, sp = 1;
    M.MILE.forEach(function (m) { if (n >= m[0]) { if (m[1] === 'x2') x *= 2; else sp *= 2; } });
    return { x: x, sp: sp };
  }
  G.moonCycle = function (id) { return BY[id].cyc / mult(id).sp; };
  G.moonYield = function (id) { var b = BY[id]; return b.out ? b.amt * G.moonCount(id) * mult(id).x : 0; };   // je Durchgang
  G.moonNextMile = function (id) { var n = G.moonCount(id); for (var i = 0; i < M.MILE.length; i++) if (n < M.MILE[i][0]) return M.MILE[i]; return null; };

  // Preis für k weitere Stück (geometrische Reihe)
  G.moonCost = function (id, k) {
    var b = BY[id], n = G.moonCount(id), f = Math.pow(b.grow, n) * (Math.pow(b.grow, k) - 1) / (b.grow - 1), out = {};
    Object.keys(b.cost).forEach(function (r) { out[r] = Math.ceil(b.cost[r] * f); });
    return out;
  };
  function canPay(c) { var m = G.moon(); return Object.keys(c).every(function (r) { return (m[r] || 0) >= c[r]; }); }
  G.moonMaxBuy = function (id) {   // wie viele Stück gehen gerade (Rohstoffe und Arbeiter)
    var b = BY[id], k = 0;
    while (k < 1000 && canPay(G.moonCost(id, k + 1)) && (!b.crew || G.moonFreeCrew() >= b.crew * (k + 1))) k++;
    return k;
  };
  G.moonBuy = function (id, k) {
    var b = BY[id]; k = Math.max(1, k || 1);
    if (!G.moonUnlocked()) return 'Erst die Raumfähre bauen.';
    if (b.crew && G.moonFreeCrew() < b.crew * k) return 'Zu wenig Kolonisten als Arbeiter – baue Wohnkuppeln.';
    var c = G.moonCost(id, k);
    if (!canPay(c)) return 'Zu wenig Rohstoffe.';
    var m = G.moon(); Object.keys(c).forEach(function (r) { m[r] -= c[r]; });
    st(id).n += k; G.save();
    return null;
  };

  // Durchgang starten (antippen); fertig = Rohstoff gutgeschrieben
  G.moonTap = function (id) {
    var b = BY[id], s = st(id), t = G.now();
    if (!b.out || !s.n) return false;
    if (s.s && t < s.s + G.moonCycle(id)) return false;   // läuft noch
    s.s = t; G.save();
    return true;
  };
  G.moonProgress = function (id) {
    var s = (S().moon && S().moon.b[id]) || null; if (!s || !s.s) return 0;
    return Math.min(1, (G.now() - s.s) / G.moonCycle(id));
  };
  G.moonHire = function (id) {
    var b = BY[id], s = st(id);
    if (!b.mgr || s.mgr) return 'Nicht möglich.';
    if (S().cash < b.mgr) return 'Dafür fehlen dir ' + MC.money(b.mgr - S().cash) + ' auf der Erde.';
    S().cash -= b.mgr; s.mgr = true; if (!s.s) s.s = G.now(); G.save();
    return null;
  };

  // Zeit fortschreiben: fertige Durchgänge gutschreiben, Manager starten neu (offline höchstens M.OFFLINE)
  G.moonTick = function () {
    var m = S().moon; if (!m) return null;
    var t = G.now(), got = { bau: 0, fuel: 0, he3: 0 };
    M.B.forEach(function (b) {
      var s = m.b[b.id]; if (!b.out || !s || !s.n || !s.s) return;
      var cyc = G.moonCycle(b.id), y = G.moonYield(b.id);
      if (s.mgr) {
        var from = Math.max(s.s, t - M.OFFLINE), n = Math.floor((t - from) / cyc);
        if (n > 0) { got[b.out] += n * y; s.s = from + n * cyc; if (!got.found) got.found = moonDrop(m, Math.min(n, 3)); }
      } else if (t >= s.s + cyc) { got[b.out] += y; s.s = 0; m.taps = (m.taps || 0) + 1; if (!got.found) got.found = moonDrop(m, 1); }
    });
    // Frachtrakete gelandet?
    if (m.rocket && t >= m.rocket.arrive) {
      var cash = m.rocket.cargo * M.ROCKET.rate;
      S().cash += cash; S().st.earned += cash; m.shipped += m.rocket.cargo; m.flights = (m.flights || 0) + 1; got.cash = cash; m.rocket = null;
    }
    ['bau', 'fuel', 'he3'].forEach(function (r) { m[r] += got[r]; });
    m.last = t;
    if (got.bau || got.fuel || got.he3 || got.cash || got.found) G.save();
    return got;
  };

  // ---------- Mond-Sammlungen ----------
  function moonDrop(m, tries) {
    var t = G.now(); m.coll = m.coll || {};
    if (t < (m.nextDrop || 0)) return null;
    var hit = !m.firstDrop && (m.taps || 0) >= M.DROP.firstAfter;
    for (var i = 0; i < tries && !hit; i++) if (Math.random() < M.DROP.chance) hit = true;
    if (!hit) return null;
    var c = M.COLL[Math.floor(Math.random() * M.COLL.length)];
    // wie auf der Erde: bis zur ersten Sammlung meist ein fehlendes Stück der besten Sammlung
    if (!(m.sets > 0) && Math.random() < MC.DROP_SMART) {
      var best = null, bn = -1;
      M.COLL.forEach(function (x) { var a = m.coll[x.id] || [0, 0, 0, 0, 0], n = a.filter(function (v) { return v > 0; }).length; if (n < 5 && n > bn) { bn = n; best = x; } });
      if (best) c = best;
    }
    var a = m.coll[c.id] || (m.coll[c.id] = [0, 0, 0, 0, 0]), miss = [];
    a.forEach(function (v, k) { if (!v) miss.push(k); });
    var idx = miss.length && !(m.sets > 0) && Math.random() < MC.DROP_SMART ? miss[Math.floor(Math.random() * miss.length)] : Math.floor(Math.random() * 5);
    a[idx]++; m.firstDrop = true;
    m.nextDrop = t + (M.DROP.pause[0] + Math.random() * (M.DROP.pause[1] - M.DROP.pause[0])) * MIN;
    return { set: c.id, i: idx, name: c.items[idx], setName: c.name };
  }
  G.moonSetComplete = function (id) { var m = S().moon, a = m && m.coll && m.coll[id]; return !!a && a.every(function (v) { return v > 0; }); };
  G.moonClaimSet = function (id) {
    var m = G.moon(), c = M.COLL.filter(function (x) { return x.id === id; })[0];
    if (!c || !G.moonSetComplete(id)) return null;
    m.coll[id] = m.coll[id].map(function (v) { return v - 1; });
    m.sets = (m.sets || 0) + 1; giveR(c.r); G.save();
    return c.r;
  };
  function giveR(r) {
    var m = G.moon();
    Object.keys(r).forEach(function (k) { if (k === 'gold') S().gold += r[k]; else if (k === 'cash') S().cash += r[k]; else m[k] = (m[k] || 0) + r[k]; });
  }
  // ---------- Mond-Ziele ----------
  G.moonGoal = function () {
    var m = S().moon; if (!m) return null;
    var g = M.GOALS[m.goal || 0]; if (!g) return null;
    var p = g.c(m); if (p[0] >= p[1]) m.gLatch = m.goal || 0;
    var done = p[0] >= p[1] || m.gLatch === (m.goal || 0);
    return { g: g, have: Math.min(p[0], p[1]), need: p[1], done: done, idx: m.goal || 0 };
  };
  G.moonClaimGoal = function () {
    var cur = G.moonGoal(); if (!cur || !cur.done) return null;
    var m = G.moon(); giveR(cur.g.r); m.goal = (m.goal || 0) + 1; G.save();
    return cur.g.r;
  };

  // Frachtrakete: Helium-3 zur Erde, kostet Treibstoff
  G.moonRocketCap = function () { return M.ROCKET.base + M.byId.hafen.ship * G.moonCount('hafen'); };
  G.moonRocketDur = function () { return Math.max(M.ROCKET.minDur, M.ROCKET.dur - M.ROCKET.durPerPort * G.moonCount('hafen')); };
  G.moonRocketPlan = function () {
    var m = G.moon(), cargo = Math.min(Math.floor(m.he3), G.moonRocketCap());
    return { cargo: cargo, fuel: Math.ceil(M.ROCKET.fuel + cargo * M.ROCKET.fuelPer), cash: cargo * M.ROCKET.rate, dur: G.moonRocketDur() };
  };
  G.moonLaunch = function () {
    var m = G.moon(), p = G.moonRocketPlan();
    if (m.rocket) return 'Die Rakete ist schon unterwegs.';
    if (p.cargo < 1) return 'Kein Helium-3 zum Verschicken.';
    if (m.fuel < p.fuel) return 'Zu wenig Treibstoff (' + p.fuel + ' nötig).';
    m.fuel -= p.fuel; m.he3 -= p.cargo;
    m.rocket = { cargo: p.cargo, start: G.now(), arrive: G.now() + p.dur };
    G.save();
    return null;
  };
})();
