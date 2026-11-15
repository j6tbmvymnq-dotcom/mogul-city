/* Mogul City – Spielzustand und Regeln (ohne DOM) */
(function () {
  'use strict';
  var MC = window.MC;
  var KEY = 'mogulcity.save.v1';
  var N = MC.MAP, SEC = MC.SECTOR;

  var G = MC.G = {};
  var S = null;            // Spielstand
  var grid = null;         // Belegung: 0 frei, -1 Straße, >0 Gebäude-ID
  var byId = {};
  var listeners = [];
  var cacheDirty = true;   // Bonus-/Kunden-Cache

  G.on = function (f) { listeners.push(f); };
  function emit(type, data) { for (var i = 0; i < listeners.length; i++) listeners[i](type, data || {}); }
  G.now = function () { return Date.now(); };

  // ---------- Laden / Speichern ----------
  function fresh() {
    var c = Math.floor(MC.SECTORS / 2);
    var o = c * SEC + SEC / 2 - 1;
    return {
      v: 1, name: '', cash: MC.START_CASH, gold: MC.START_GOLD, xp: 0, lvl: 1,
      land: [c + ',' + c], roads: [], nextId: 2,
      b: [{ id: 1, t: 'hq', x: o, y: o }],
      mission: 0, daily: { last: '', streak: 0 },
      st: { roads: 0, signed: 0, collected: 0, shopCollected: 0, expired: 0, earned: 0, sets: 0 },
      coll: {}, advisor: '', movePass: 0,
      tut: 0, seen: {}, sessions: 1, lastSeen: Date.now(), firstDrop: false,
      sound: true, sndTap: true, sndCash: true, daynight: true, music: true, voice: true, ignoreMute: true, created: Date.now()
    };
  }
  // ältere Spielstände auf den aktuellen Aufbau bringen
  function migrate(s) {
    var f = fresh(), k;
    // Spielstand von vor dem Tutorial: kein Tutorial, alle Funktionen frei
    if (s.tut === undefined && s.st) { s.tut = (s.st.collected > 0 || s.b.length > 1) ? 'done' : 0; s.legacy = s.tut === 'done'; }
    for (k in f) if (s[k] === undefined) s[k] = f[k];
    for (k in f.st) if (s.st[k] === undefined) s.st[k] = f.st[k];
    s.b = s.b.filter(function (b) { return MC.DEF[b.t]; });
    return s;
  }
  G.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { }
    S = null;
    if (raw) { try { S = JSON.parse(raw); } catch (e) { S = null; } }
    var isNew = !S || !S.b;
    S = isNew ? fresh() : migrate(S);
    rebuild();
    G.S = S;
    // neue Sitzung, wenn länger als 30 Minuten nicht gespielt
    G.away = isNew ? 0 : Math.max(0, Date.now() - (S.lastSeen || Date.now()));
    if (G.away > 30 * MC.MIN) S.sessions = (S.sessions || 1) + 1;
    // iOS soll den Spielstand nicht aufräumen dürfen
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    return isNew;
  };
  // Spielstand als Text sichern / wiederherstellen
  G.exportCode = function () {
    if (G.visiting) return '';   // nie eine besuchte Stadt exportieren
    G.saveNow();
    return 'MOGUL1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  };
  G.importCode = function (code) {
    try {
      code = String(code || '').trim();
      if (code.indexOf('MOGUL1:') !== 0) return 'Das ist kein Mogul-City-Spielstand.';
      var s = JSON.parse(decodeURIComponent(escape(atob(code.slice(7)))));
      if (!s || !s.b || !s.land) return 'Der Spielstand ist beschädigt.';
      s.syncRev = S.syncRev; s.cloudCode = S.cloudCode;
      G.replace(s); G.saveNow();
      return null;
    } catch (e) { return 'Der Code konnte nicht gelesen werden.'; }
  };
  // Kompletten Spielstand ersetzen (Import, Cloud)
  G.replace = function (s) {
    S = migrate(s); G.S = S; rebuild();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
    emit('reset');
  };
  var saveTimer = null;
  G.save = function () {
    if (saveTimer || G.visiting) return;
    saveTimer = setTimeout(G.saveNow, 400);
  };
  G.saveNow = function () {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var own = G.visiting ? G.visiting.own : S;   // beim Besuch immer die eigene Stadt sichern
    own.lastSeen = Date.now();
    own.worthCache = G.visiting ? own.worthCache : G.netWorth();
    try { localStorage.setItem(KEY, JSON.stringify(own)); } catch (e) { }
  };
  // ---------- Besuch: fremde Stadt nur ansehen (nichts speichern, nichts verändern) ----------
  G.visiting = null;
  G.visit = function (data, meta) {
    if (!G.visiting) G.visiting = { own: S };
    G.visiting.meta = meta || {};
    S = migrate(JSON.parse(JSON.stringify(data))); S.tut = 'done'; G.S = S; rebuild();
    emit('visit', G.visiting.meta);
  };
  G.endVisit = function () {
    if (!G.visiting) return;
    S = G.visiting.own; G.visiting = null; G.S = S; rebuild();
    emit('reset');
  };
  G.reset = function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
    G.load(); emit('reset');
  };

  function rebuild() {
    grid = new Int32Array(N * N);
    byId = {};
    var i, j, k;
    for (i = 0; i < S.roads.length; i++) grid[S.roads[i]] = -1;
    for (i = 0; i < S.b.length; i++) {
      var b = S.b[i], d = MC.DEF[b.t];
      byId[b.id] = b;
      for (j = 0; j < d.size; j++) for (k = 0; k < d.size; k++) grid[(b.y + k) * N + b.x + j] = b.id;
    }
    cacheDirty = true;
  }
  function dirty() { cacheDirty = true; }

  // ---------- Abfragen ----------
  G.at = function (x, y) { return (x < 0 || y < 0 || x >= N || y >= N) ? 0 : grid[y * N + x]; };
  G.get = function (id) { return byId[id]; };
  G.isRoad = function (x, y) { return G.at(x, y) === -1; };
  G.owned = function (x, y) {
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    return S.land.indexOf(Math.floor(x / SEC) + ',' + Math.floor(y / SEC)) >= 0;
  };
  G.sectorOwned = function (sx, sy) { return S.land.indexOf(sx + ',' + sy) >= 0; };
  G.sectorBuyable = function (sx, sy) {
    if (sx < 0 || sy < 0 || sx >= MC.SECTORS || sy >= MC.SECTORS || G.sectorOwned(sx, sy)) return false;
    return G.sectorOwned(sx - 1, sy) || G.sectorOwned(sx + 1, sy) || G.sectorOwned(sx, sy - 1) || G.sectorOwned(sx, sy + 1);
  };
  G.landPrice = function () { return MC.LAND[S.land.length - 1] || null; };

  G.has = function (wonderId) {
    for (var i = 0; i < S.b.length; i++) if (S.b[i].t === wonderId && !S.b[i].cu) return true;
    return false;
  };
  function effect(key) {
    var v = 0;
    for (var i = 0; i < S.b.length; i++) {
      var d = MC.DEF[S.b[i].t];
      if (d.kind !== 'wonder' || S.b[i].cu) continue;
      if (d.friend) { if (key === 'rent' || key === 'shop') v += G.friendBonus(); }
      else if (d.effect === key) v += d.val;
    }
    if (key === 'rent' && G.moonBonus) v += G.moonBonus();   // Kolonisten auf dem Mond (js/mond.js)
    return v;
  }
  G.effect = effect;
  G.friendBonus = function (n) { var f = n === undefined ? (S.friends || 0) : n; return f > 0 ? Math.min(MC.FRIEND_MAX, MC.FRIEND_FIRST + f - 1) : 0; };
  G.count = function (t) { var n = 0; for (var i = 0; i < S.b.length; i++) if (S.b[i].t === t) n++; return n; };

  G.hasRoad = function (b) {
    var d = MC.DEF[b.t], s = d.size, i;
    for (i = 0; i < s; i++) {
      if (G.isRoad(b.x + i, b.y - 1) || G.isRoad(b.x + i, b.y + s) || G.isRoad(b.x - 1, b.y + i) || G.isRoad(b.x + s, b.y + i)) return true;
    }
    return false;
  };

  // Rechteck-Abstand: liegt Gebäude h in der Reichweite r um Gebäude a?
  function inReach(a, da, r, h, dh) {
    return h.x < a.x + da.size + r && h.x + dh.size > a.x - r && h.y < a.y + da.size + r && h.y + dh.size > a.y - r;
  }
  G.inReach = inReach;

  function recache() {
    var i, j, b, d;
    for (i = 0; i < S.b.length; i++) { S.b[i]._bonus = 0; }
    for (i = 0; i < S.b.length; i++) {
      b = S.b[i]; d = MC.DEF[b.t];
      if (d.kind !== 'deco') continue;
      for (j = 0; j < S.b.length; j++) {
        var h = S.b[j], dh = MC.DEF[h.t];
        if (dh.kind === 'house' && inReach(b, d, d.reach, h, dh)) h._bonus += d.bonus;
      }
    }
    cacheDirty = false;
  }
  // Deko-Bonus eines Hauses in %
  G.bonus = function (b) {
    if (cacheDirty) recache();
    return Math.min(MC.MAX_BONUS, b._bonus || 0);
  };
  G.maxBonus = function () {
    var m = 0;
    for (var i = 0; i < S.b.length; i++) if (MC.DEF[S.b[i].t].kind === 'house') m = Math.max(m, G.bonus(S.b[i]));
    return m;
  };
  // Bonus, den ein Haus an Position (x,y) hätte (für die Bauvorschau)
  G.bonusAt = function (def, x, y, ignoreId) {
    var v = 0, h = { x: x, y: y };
    for (var i = 0; i < S.b.length; i++) {
      var b = S.b[i], d = MC.DEF[b.t];
      if (d.kind === 'deco' && b.id !== ignoreId && inReach(b, d, d.reach, h, def)) v += d.bonus;
    }
    return Math.min(MC.MAX_BONUS, v);
  };

  // Zustand eines Hauses: build | noroad | empty | running | ready | expired
  G.state = function (b, t) {
    t = t || G.now();
    var d = MC.DEF[b.t];
    if (b.cu) { if (t < b.cu) return 'build'; delete b.cu; delete b.cs; dirty(); emit('built', { b: b }); }
    if (d.kind === 'house') {
      if (b.c) {
        if (t < b.c.end) return 'running';
        if (t < b.c.end + G.grace(b.c)) return 'ready';
        return 'expired';
      }
      return G.hasRoad(b) ? 'empty' : 'noroad';
    }
    if (d.kind === 'shop') {
      if (!G.hasRoad(b)) return 'noroad';
      if (!b.s) b.s = t;
      return (t - b.s >= d.cycle) ? 'ready' : 'running';
    }
    return 'idle';
  };
  G.grace = function (c) { return MC.CONTRACT[c.k].grace * (1 + effect('grace') / 100); };

  G.tenants = function (b, t) {
    var st = G.state(b, t);
    return (st === 'running' || st === 'ready') ? b.c.n : 0;
  };
  G.totalTenants = function () {
    var n = 0, t = G.now();
    for (var i = 0; i < S.b.length; i++) if (MC.DEF[S.b[i].t].kind === 'house') n += G.tenants(S.b[i], t);
    return n;
  };
  // Kunden eines Gewerbes (auch als Vorschau für eine Position)
  G.customers = function (b, def, ignoreId) {
    def = def || MC.DEF[b.t];
    var n = 0, t = G.now();
    for (var i = 0; i < S.b.length; i++) {
      var h = S.b[i], dh = MC.DEF[h.t];
      if (dh.kind === 'house' && h.id !== ignoreId && inReach(b, def, def.reach, h, dh)) n += G.tenants(h, t);
    }
    return n;
  };
  G.shopIncome = function (b) {   // je Takt
    var d = MC.DEF[b.t];
    return Math.round(G.customers(b) * d.per * (1 + effect('shop') / 100));
  };
  // Volle Takte in der Kasse (füllt sich auch, wenn man nicht kassiert – bis MC.SHOP_CAP)
  G.shopCycles = function (b, t) {
    var d = MC.DEF[b.t]; t = t || G.now();
    if (!b.s) return 0;
    return Math.min(MC.SHOP_CAP, Math.floor((t - b.s) / d.cycle));
  };
  G.shopStored = function (b) { return G.shopIncome(b) * G.shopCycles(b); };
  G.shopFull = function (b) { return G.shopCycles(b) >= MC.SHOP_CAP; };

  // Vertragskonditionen für ein Haus
  G.offer = function (b, c) {
    var o = MC.offerOf(MC.DEF[b.t], c, G.bonus(b), effect('rent'));
    o.xp = xpGain(o.xp);
    return o;
  };
  function xpGain(x) { return Math.max(1, Math.round(x * (1 + effect('xp') / 100))); }

  // ---------- Freischaltungen und Tutorial ----------
  G.unlocked = function (f) { return !!S.legacy || S.lvl >= (MC.FEATURES[f] || 1); };
  G.kindUnlocked = function (d) {
    if (d.friend) return (S.friends || 0) > 0;
    if (d.gold && !G.unlocked('premium')) return false;
    return d.kind === 'house' || (d.kind === 'deco' && G.unlocked('deko')) || (d.kind === 'shop' && G.unlocked('gewerbe')) || (d.kind === 'wonder' && G.unlocked('wonder'));
  };
  G.inTut = function () { return S.tut !== 'done'; };
  G.isNew = function (key) { return !S.seen[key]; };
  G.markSeen = function (key) { if (!S.seen[key]) { S.seen[key] = 1; G.save(); } };
  G.finishTutorial = function (skipped) {
    if (S.tut === 'done') return;
    S.tut = 'done';
    // die ersten vier Ziele (Straße, Haus, Vertrag, Miete) deckt das Tutorial ab
    if (!skipped && S.mission < 4) { S.mission = 4; S.cash += MC.TUT.reward; S.gold += 1; }
    emit('tutorial', { skipped: !!skipped }); G.save();
  };
  // nächstes Level mit etwas Neuem (für die Vorschau an der XP-Leiste)
  G.nextUnlock = function () {
    for (var L = S.lvl + 1; L <= S.lvl + 40; L++) {
      var items = MC.BUILDINGS.filter(function (d) { return d.lvl === L && d.kind !== 'hq'; });
      var feats = Object.keys(MC.FEATURES).filter(function (f) { return MC.FEATURES[f] === L; });
      if (items.length || feats.length) return { lvl: L, items: items, feats: feats };
    }
    return null;
  };

  G.goldRate = function () { return MC.goldRate(S.lvl); };
  // Wert eines Gebäudes in Dollar (Gold zum aktuellen Kurs)
  G.value = function (d) { return d.cost + (d.gold || 0) * G.goldRate(); };
  G.worth = function () {
    var w = { cash: S.cash, gold: S.gold * G.goldRate(), buildings: 0, land: 0 }, i;
    for (i = 0; i < S.b.length; i++) w.buildings += G.value(MC.DEF[S.b[i].t]);
    for (i = 0; i < S.land.length - 1; i++) w.land += MC.LAND[i][0] + MC.LAND[i][1] * G.goldRate();
    w.total = w.cash + w.gold + w.buildings + w.land;
    return w;
  };
  G.netWorth = function () { return G.worth().total; };
  G.exchange = function (n) {
    if (!G.unlocked('goldex')) return 'Gold-Tausch gibt es ab Level ' + MC.FEATURES.goldex + '.';
    n = Math.min(n, S.gold);
    if (n <= 0) return 'Kein Gold vorhanden.';
    var v = n * G.goldRate();
    S.gold -= n; S.cash += v;
    emit('exchange', { gold: n, cash: v }); G.save();
    return null;
  };
  G.title = function () {
    var nw = G.netWorth(), t = MC.TITLES[0][1];
    for (var i = 0; i < MC.TITLES.length; i++) if (nw >= MC.TITLES[i][0]) t = MC.TITLES[i][1];
    return t;
  };

  // ---------- Aktionen ----------
  function addXp(x) {
    S.xp += x;
    var need = MC.xpNeed(S.lvl);
    while (S.xp >= need) {
      S.xp -= need; S.lvl++; S.gold += 1;
      var bonus = MC.levelBonus(S.lvl);
      S.cash += bonus;
      emit('levelup', { lvl: S.lvl, cash: bonus });
      need = MC.xpNeed(S.lvl);
    }
  }
  function pay(cash, gold) {
    if (S.cash < cash || S.gold < (gold || 0)) return false;
    S.cash -= cash; S.gold -= (gold || 0);
    return true;
  }

  // Darf def an (x,y) stehen? ignoreId = Gebäude, das gerade verschoben wird
  G.canPlace = function (def, x, y, ignoreId) {
    for (var j = 0; j < def.size; j++) for (var k = 0; k < def.size; k++) {
      if (!G.owned(x + j, y + k)) return false;
      var g = G.at(x + j, y + k);
      if (g !== 0 && g !== ignoreId) return false;
    }
    return true;
  };
  G.touchesRoad = function (def, x, y) {
    return G.hasRoad({ t: def.id, x: x, y: y });
  };

  // Einmalige Starthilfe: wer vor Level 6 mit weniger als 3 Häusern kein Geld mehr für einen Bungalow hat
  // (z. B. weil das Geld früh in Gewerbe oder Deko floss), bekommt den Fehlbetrag einmal geschenkt.
  G.startAidDue = function () {
    if (S.legacy || S.startAid || G.visiting || G.inTut() || S.lvl >= MC.TUT.rushLevel) return 0;
    var n = 0; S.b.forEach(function (b) { if (MC.DEF[b.t].kind === 'house') n++; });
    var need = MC.DEF.bungalow.cost;
    return n < G.SHOP_HOUSES && S.cash < need ? Math.ceil((need - S.cash) / 1000) * 1000 : 0;
  };
  G.startAid = function () {
    var a = G.startAidDue(); if (!a) return 0;
    S.cash += a; S.startAid = a; emit('cash'); G.save();
    return a;
  };
  // Gewerbe erst ab 3 Häusern: vorher hat es kaum Kunden, und das Geld fehlt für Häuser (Hänger auf Level 3)
  G.SHOP_HOUSES = 3;
  G.shopBlocked = function (d) {
    if (d.kind !== 'shop' || S.legacy || G.visiting) return false;
    var n = 0; S.b.forEach(function (b) { if (MC.DEF[b.t].kind === 'house') n++; });
    return n < G.SHOP_HOUSES ? G.SHOP_HOUSES - n : false;
  };
  G.build = function (id, x, y) {
    var d = MC.DEF[id];
    if (!d || d.kind === 'hq') return 'Nicht baubar.';
    if (d.lvl > S.lvl && !S.legacy) return 'Erst ab Level ' + d.lvl + '.';
    if (!G.kindUnlocked(d)) return 'Noch nicht freigeschaltet.';
    if (G.shopBlocked(d)) return 'Gewerbe lohnt sich erst ab ' + G.SHOP_HOUSES + ' Häusern.';
    if (d.kind === 'wonder' && G.count(id) > 0) return 'Jedes Weltwunder gibt es nur einmal.';
    if (!G.canPlace(d, x, y)) return 'Hier ist kein Platz.';
    if (S.gold < (d.gold || 0)) return 'Nicht genug Gold.';
    if (!pay(d.cost, d.gold)) return 'Nicht genug Geld.';
    var b = { id: S.nextId++, t: id, x: x, y: y };
    var bt = d.build * (1 - effect('build') / 100);
    if (G.inTut()) bt = Math.min(bt, MC.TUT.buildTime);
    else if (S.lvl < MC.TUT.rushLevel) bt = Math.min(bt, MC.TUT.rushTime);   // Starthilfe
    if (bt > 0) { b.cs = G.now(); b.cu = b.cs + bt; }
    S.b.push(b);
    rebuild();
    addXp(xpGain(MC.buildXp(d)));
    emit('build', { b: b });
    G.save();
    return null;
  };

  // Umsetzen: Gebühr (oder Umzugspass); laufende Verträge und Kassen starten neu – wie im Original
  G.passActive = function () { return S.movePass > G.now(); };
  G.moveFee = function (b) {
    var d = MC.DEF[b.t];
    if (d.kind === 'hq' || G.passActive()) return 0;
    return Math.max(50, Math.round(G.value(d) * MC.MOVE_FEE / 10) * 10);
  };
  G.buyPass = function () {
    if (G.passActive()) return null;
    if (!pay(0, MC.MOVE_PASS.gold)) return 'Nicht genug Gold.';
    S.movePass = G.now() + MC.MOVE_PASS.dur;
    emit('pass'); G.save();
    return null;
  };
  G.move = function (b, x, y) {
    var d = MC.DEF[b.t];
    if (b.x === x && b.y === y) return null;
    if (!G.canPlace(d, x, y, b.id)) return 'Hier ist kein Platz.';
    var fee = G.moveFee(b);
    if (!pay(fee)) return 'Nicht genug Geld für die Umzugsgebühr.';
    b.x = x; b.y = y;
    var t = G.now();
    // laufende/fällige Verträge starten neu (Original); verfallene bleiben verfallen – sonst Gratis-Rettung per Umzug
    if (b.c && !b.cu && t < b.c.end + G.grace(b.c)) { var dur = b.c.end - b.c.s; b.c.s = t; b.c.end = t + dur; }
    if (d.kind === 'shop') b.s = t;
    rebuild(); emit('move', { b: b, fee: fee }); G.save();
    return null;
  };

  G.refund = function (d) { return { cash: Math.round(d.cost * MC.REFUND), gold: Math.floor((d.gold || 0) * MC.REFUND) }; };
  G.demolish = function (b) {
    var d = MC.DEF[b.t];
    if (d.kind === 'hq') return 'Die Firmenzentrale bleibt stehen.';
    var r = G.refund(d), refund = r.cash;
    S.cash += refund; S.gold += r.gold;
    S.b.splice(S.b.indexOf(b), 1);
    rebuild(); emit('demolish', { b: b, refund: refund }); G.save();
    return null;
  };

  G.setRoad = function (x, y, on) {
    if (!G.owned(x, y)) return false;
    var i = y * N + x;
    if (on) {
      if (grid[i] !== 0) return false;
      grid[i] = -1; S.roads.push(i); S.st.roads++;
    } else {
      if (grid[i] !== -1) return false;
      grid[i] = 0; S.roads.splice(S.roads.indexOf(i), 1);
    }
    emit('road'); G.save();
    return true;
  };

  // Sofort fertigstellen: Preis sinkt mit der Restzeit
  G.finishPrice = function (b) {
    var d = MC.DEF[b.t], t = G.now();
    var left = Math.max(0, b.cu - t), total = Math.max(1, b.cu - b.cs);
    return {
      cash: Math.max(100, Math.round(G.value(d) * 0.6 * left / total)),   // Gold-Gebäude: Wert des Golds zählt mit
      gold: Math.max(1, Math.ceil(left / MC.H))
    };
  };
  G.freeFinish = function () { return !S.legacy && !G.inTut() && !S.usedFreeFinish; };
  G.finish = function (b, withGold, free) {
    if (!b.cu) return null;
    if (free) { if (!G.freeFinish()) return 'Schon verbraucht.'; S.usedFreeFinish = 1; b.cu = G.now() - 1; G.state(b); G.save(); return null; }
    var p = G.finishPrice(b);
    if (withGold ? !pay(0, p.gold) : !pay(p.cash)) return withGold ? 'Nicht genug Gold.' : 'Nicht genug Geld.';
    b.cu = G.now() - 1;
    G.state(b); G.save();
    return null;
  };

  G.sign = function (b, cid) {
    var c = MC.CONTRACT[cid], d = MC.DEF[b.t];
    if (!c || d.kind !== 'house') return 'Kein Wohnhaus.';
    if (c.lvl > S.lvl) return 'Erst ab Level ' + c.lvl + '.';
    var st = G.state(b);
    if (st === 'noroad') return 'Das Haus braucht einen Straßenanschluss.';
    if (st === 'expired') { delete b.c; S.st.expired++; }
    else if (st !== 'empty') return 'Hier läuft schon ein Vertrag.';
    var o = G.offer(b, c);
    if (!pay(o.cost)) return 'Nicht genug Geld.';
    var t = G.now();
    b.c = { k: cid, s: t, end: t + c.dur, pay: o.pay, cost: o.cost, n: o.n, xp: o.xp };
    // Probemieter im Tutorial: kurz und mit genug XP für Level 2
    if (G.inTut() && S.st.signed === 0) { b.c.end = t + MC.TUT.contractTime; b.c.xp = Math.max(b.c.xp, MC.TUT.contractXp); }
    S.st.signed++;
    emit('sign', { b: b }); G.save();
    return null;
  };

  G.cancel = function (b) {
    if (!b.c) return null;
    var refund = Math.round(b.c.cost * MC.CANCEL_REFUND);
    S.cash += refund; delete b.c;
    emit('cancel', { b: b, refund: refund }); G.save();
    return null;
  };

  // Verfallenen Vertrag räumen (Mieter sind weg)
  G.clearExpired = function (b) {
    if (b.c && G.state(b) === 'expired') { delete b.c; S.st.expired++; emit('expired', { b: b }); G.save(); }
  };
  // Mieter gegen Gold zurückholen
  // Retten kostet Gold im Verhältnis zur Miete (etwa die halbe Miete, mindestens 1 Gold)
  G.rescueCost = function (b) { return b.c ? Math.max(1, Math.ceil(b.c.pay / (2 * G.goldRate()))) : 1; };
  G.rescue = function (b) {
    if (!b.c || G.state(b) !== 'expired') return null;
    if (!pay(0, G.rescueCost(b))) return 'Nicht genug Gold.';
    b.c.end = G.now() - 1;
    return G.collect(b) ? null : 'Fehler';
  };

  // Miete oder Gewerbe-Einnahmen kassieren. Liefert {cash, xp} oder null
  G.collect = function (b) {
    var d = MC.DEF[b.t], st = G.state(b), res = null;
    if (st !== 'ready') return null;
    if (d.kind === 'house') {
      res = { cash: b.c.pay, xp: b.c.xp, last: b.c.k };
      b.last = b.c.k;
      delete b.c;
      S.st.collected++;
    } else if (d.kind === 'shop') {
      var per = G.shopIncome(b), n = G.shopCycles(b), inc = per * n;
      if (inc <= 0) return { cash: 0, xp: 0, none: true };
      res = { cash: inc, xp: xpGain(Math.max(1, inc / 500)), cycles: n };   // XP wie in der Simulation geprüft
      var now = G.now(), cyc = MC.DEF[b.t].cycle;
      b.s = n >= MC.SHOP_CAP ? now : b.s + n * cyc;   // angefangener Takt läuft weiter
      S.st.shopCollected++;
    }
    if (res) {
      S.cash += res.cash; S.st.earned += res.cash;
      addXp(res.xp);
      emit('collect', { b: b, cash: res.cash, xp: res.xp });
      var chance = d.kind === 'house' ? MC.DROP_HOUSE + d.tier * 0.005 : MC.DROP_SHOP;
      // Sammelstücke bleiben selten: nach jedem Fund eine Pause (MC.DROP_PAUSE), sonst würfelt jedes kassierte Haus alle 3 Min.
      if (G.unlocked('sets') && G.now() >= (S.nextDrop || 0)) {
        if (!S.firstDrop) chance = 1;          // erstes Sammelstück gleich nach der Freischaltung
        if (Math.random() < chance) {
          res.found = drop(b); S.firstDrop = true;
          var pz = S.st.sets > 0 ? MC.DROP_PAUSE_LATER : MC.DROP_PAUSE;
          S.nextDrop = G.now() + (pz[0] + Math.random() * (pz[1] - pz[0])) * MC.MIN;
        }
      }
      G.save();
    }
    return res;
  };

  // ---------- Sammlungen ----------
  function drop(b) {
    var sets = MC.COLLECTIONS.filter(function (c) { return c.lvl <= S.lvl; });
    if (!sets.length) return null;
    var c = sets[Math.floor(Math.random() * sets.length)], i = Math.floor(Math.random() * c.items.length);
    // meistens ein fehlendes Stück der am weitesten gesammelten Sammlung – sonst dauert die erste volle Sammlung ewig
    if (!(S.st.sets > 0) && Math.random() < MC.DROP_SMART) {   // nur bis zur ersten eingelösten Sammlung (Ziel „Sammelleidenschaft“)
      var best = null, bn = -1;
      sets.forEach(function (x) { var a = S.coll[x.id] || [0, 0, 0, 0, 0], n = a.filter(function (v) { return v > 0; }).length; if (n < 5 && n > bn) { bn = n; best = x; } });
      if (best) { var a = S.coll[best.id] || [0, 0, 0, 0, 0], miss = []; a.forEach(function (v, k) { if (!v) miss.push(k); }); c = best; i = miss[Math.floor(Math.random() * miss.length)]; }
    }
    if (!S.coll[c.id]) S.coll[c.id] = [0, 0, 0, 0, 0];
    S.coll[c.id][i]++;
    var f = { set: c.id, i: i, name: c.items[i], setName: c.name };
    emit('found', { b: b, f: f });
    return f;
  }
  G.setComplete = function (id) {
    var a = S.coll[id];
    return !!a && a.every(function (n) { return n > 0; });
  };
  G.claimSet = function (id) {
    var c = MC.COLLECTIONS.filter(function (x) { return x.id === id; })[0];
    if (!c || !G.setComplete(id)) return null;
    S.coll[id] = S.coll[id].map(function (n) { return n - 1; });
    S.cash += c.r.cash || 0; S.gold += c.r.gold || 0; S.st.sets++;
    if (c.r.xp) addXp(c.r.xp);
    emit('set', { c: c }); G.save();
    return c.r;
  };
  G.setsReady = function () {
    var n = 0;
    MC.COLLECTIONS.forEach(function (c) { if (G.setComplete(c.id)) n++; });
    return n;
  };
  G.setAdvisor = function (id) { S.advisor = id; emit('advisor'); G.save(); };
  G.advisorById = function (id) { for (var i = 0; i < MC.ADVISORS.length; i++) if (MC.ADVISORS[i].id === id) return MC.ADVISORS[i]; return MC.ADVISORS[0]; };
  G.advisor = function () {
    for (var i = 0; i < MC.ADVISORS.length; i++) if (MC.ADVISORS[i].id === S.advisor) return MC.ADVISORS[i];
    return MC.ADVISORS[0];
  };

  // Alles Fällige kassieren – Gewerbe zuerst, solange die Mieter noch da sind
  G.collectAll = function () {
    var total = 0, n = 0, i, r, list = S.b.slice();
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < list.length; i++) {
        var k = MC.DEF[list[i].t].kind;
        if ((pass === 0 && k === 'shop') || (pass === 1 && k === 'house')) {
          r = G.collect(list[i]);
          if (r && !r.none) { total += r.cash; n++; }
        }
      }
    }
    return { cash: total, n: n };
  };
  G.readyCount = function () {
    var n = 0, t = G.now();
    for (var i = 0; i < S.b.length; i++) {
      var b = S.b[i], k = MC.DEF[b.t].kind;
      if ((k === 'house' || k === 'shop') && G.state(b, t) === 'ready') {
        if (k === 'shop' && G.customers(b) === 0) continue;
        n++;
      }
    }
    return n;
  };

  G.buyLand = function (sx, sy) {
    if (!G.unlocked('land')) return 'Grundstücke gibt es ab Level ' + MC.FEATURES.land + '.';
    if (!G.sectorBuyable(sx, sy)) return 'Dieses Grundstück grenzt nicht an deine Stadt.';
    var p = G.landPrice();
    if (!p) return 'Kein Land mehr verfügbar.';
    if (S.cash < p[0]) return 'Nicht genug Geld.';
    if (S.gold < p[1]) return 'Nicht genug Gold.';
    pay(p[0], p[1]);
    S.land.push(sx + ',' + sy);
    addXp(xpGain(20 * S.land.length));
    emit('land', { sx: sx, sy: sy }); G.save();
    return null;
  };

  G.setName = function (n) { S.name = String(n || '').trim().slice(0, 24); emit('name'); G.save(); };

  // ---------- Missionen ----------
  G.mission = function () {
    var m = MC.MISSIONS[S.mission];
    if (!m) return null;
    // Ziel braucht eine Funktion, die erst später kommt: bis dahin heißt das Ziel „Level X erreichen“
    if (m.lvl && S.lvl < m.lvl && !S.legacy) {
      return { m: { t: 'Level ' + m.lvl + ' erreichen', d: 'Steig auf Level ' + m.lvl + ' auf – dann geht es hier weiter mit: ' + m.t + '. Bauen, vermieten und kassieren bringt Erfahrung.', r: {} },
        have: S.lvl, need: m.lvl, done: false, idx: S.mission, waiting: true };
    }
    var p = m.check(S, G);
    // einmal erreicht = erreicht (z. B. „100 Bewohner gleichzeitig“ schwankt beim Kassieren kurz)
    if (p[0] >= p[1]) S.mLatch = S.mission;
    var done = p[0] >= p[1] || S.mLatch === S.mission;
    return { m: m, have: done ? p[1] : Math.min(p[0], p[1]), need: p[1], done: done, idx: S.mission };
  };
  G.claimMission = function () {
    var cur = G.mission();
    if (!cur || !cur.done) return null;
    var r = cur.m.r;
    if (r.cash) S.cash += r.cash;
    if (r.gold) S.gold += r.gold;
    S.mission++;
    if (r.xp) addXp(r.xp);
    emit('mission', { r: r }); G.save();
    return r;
  };

  // ---------- Tagesbonus ----------
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  // Tagesbonus: ab Level 4 und erst ab der zweiten Sitzung – als Belohnung fürs Wiederkommen
  G.dailyDue = function () { return G.unlocked('daily') && (S.sessions >= 2 || S.legacy) && !G.inTut() && S.daily.last !== dayKey(G.now()); };
  G.dailyPreview = function () {
    var yesterday = dayKey(G.now() - MC.D);
    var streak = (S.daily.last === yesterday) ? (S.daily.streak % 5) + 1 : 1;
    var mult = 1 + effect('daily') / 100;
    var cash = Math.round((5000 + S.lvl * S.lvl * 400) * streak * mult / 100) * 100;
    return { streak: streak, cash: cash, gold: streak === 5 ? Math.round(2 * mult) : 0 };
  };
  G.claimDaily = function () {
    if (!G.dailyDue()) return null;
    var p = G.dailyPreview();
    S.cash += p.cash; S.gold += p.gold;
    S.daily.last = dayKey(G.now()); S.daily.streak = p.streak;
    emit('daily', p); G.save();
    return p;
  };

  // Regelmäßige Prüfung: Bauten fertig? Verträge verfallen?
  G.tick = function () {
    var t = G.now(), i, changed = false;
    for (i = 0; i < S.b.length; i++) {
      var b = S.b[i], had = !!b.cu;
      G.state(b, t);
      if (had && !b.cu) changed = true;
    }
    if (changed) G.save();
  };
})();
