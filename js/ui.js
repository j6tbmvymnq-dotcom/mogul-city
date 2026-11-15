/* Mogul City – Oberfläche: Kopfzeile, Werkzeuge, Sheets, Dialoge, Ton/Sprache, Start */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G, V = MC.V, A = MC.Art, AS = MC.Assets;
  var UI = MC.UI = {};
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var COIN = '<span class="ic sm coin"></span>', GOLD = '<span class="ic sm gold"></span>';
  var KIND = { house: 'Wohnhaus', shop: 'Gewerbe', deco: 'Dekoration', wonder: 'Weltwunder', hq: 'Hauptsitz' };

  var cur = null;          // offenes Sheet: {type, id, sig}
  var shopTab = 'house';
  var applyAll = false;
  var missionWasDone = null;   // null = erster Durchlauf, keine Meldung für schon erreichte Ziele
  var modalQueue = [], modalOpen = false;

  // ---------- Töne: Datei aus assets/sounds, sonst Ersatzklang ----------
  function tone(f, t0, len, type, vol) {
    var ac = AS.ctx(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, ac.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + len);
    o.connect(g); g.connect(AS.master());
    o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + len + 0.02);
  }
  var SYNTH = {
    tap: function () { tone(700, 0, 0.03, 'sine', 0.04); },
    open: function () { tone(520, 0, 0.06, 'sine', 0.05); tone(780, 0.04, 0.08, 'sine', 0.04); },
    close: function () { tone(600, 0, 0.06, 'sine', 0.04); tone(420, 0.04, 0.08, 'sine', 0.035); },
    collect: function () { tone(988, 0, 0.09, 'triangle', 0.14); tone(1319, 0.07, 0.22, 'triangle', 0.14); },
    collect_all: function () { [988, 1175, 1319, 1568].forEach(function (f, i) { tone(f, i * 0.06, 0.2, 'triangle', 0.12); }); },
    shop_collect: function () { tone(1568, 0, 0.06, 'square', 0.05); tone(2093, 0.06, 0.2, 'triangle', 0.1); },
    sign: function () { tone(660, 0, 0.08, 'sine', 0.1); tone(880, 0.08, 0.12, 'sine', 0.1); },
    build: function () { tone(196, 0, 0.1, 'square', 0.06); tone(294, 0.08, 0.14, 'square', 0.06); },
    built: function () { tone(784, 0, 0.12, 'triangle', 0.1); tone(1047, 0.1, 0.25, 'triangle', 0.1); },
    road: function () { tone(520, 0, 0.04, 'square', 0.03); },
    move: function () { tone(330, 0, 0.08, 'triangle', 0.08); tone(440, 0.07, 0.1, 'triangle', 0.08); },
    demolish: function () { tone(110, 0, 0.25, 'sawtooth', 0.09); tone(70, 0.05, 0.3, 'square', 0.07); },
    expired: function () { tone(392, 0, 0.18, 'triangle', 0.09); tone(311, 0.16, 0.3, 'triangle', 0.09); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.3, 'triangle', 0.13); }); },
    mission: function () { [659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.25, 'triangle', 0.11); }); },
    daily: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, i * 0.07, 0.25, 'triangle', 0.1); }); },
    land: function () { [392, 523, 659, 784].forEach(function (f, i) { tone(f, i * 0.1, 0.3, 'sine', 0.12); }); },
    found: function () { [1319, 1760, 2093].forEach(function (f, i) { tone(f, i * 0.05, 0.2, 'sine', 0.07); }); },
    set: function () { [523, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, i * 0.08, 0.3, 'triangle', 0.11); }); },
    gold: function () { tone(1760, 0, 0.1, 'sine', 0.08); tone(2637, 0.05, 0.25, 'sine', 0.06); },
    error: function () { tone(150, 0, 0.18, 'sawtooth', 0.06); }
  };
  UI.sound = function (id) {
    if (!G.S.sound) return;
    try { if (!AS.play(id) && SYNTH[id]) SYNTH[id](); } catch (e) { }
  };

  // ---------- Berater ----------
  function advisorPic(a, cls) {
    a = a || G.advisor();
    var u = AS.url('berater_' + a.id);
    if (u) return '<img class="' + (cls || 'pic') + '" src="' + u + '" alt="">';
    return '<span class="' + (cls || 'pic') + ' initials" style="background:' + a.color + '">' + a.name.charAt(0) + '</span>';
  }
  var sayTimer = null, lastSay = {};
  // Sprechblase + (falls vorhanden) Sprachaufnahme; line = Schlüssel aus MC.VOICE oder mission_<nr>
  UI.say = function (line, text, minGap) {
    if (MC.Tut && MC.Tut.active()) return;   // während das Tutorial läuft, spricht nur das Tutorial
    var now = Date.now();
    if (minGap && lastSay[line] && now - lastSay[line] < minGap) return;
    lastSay[line] = now;
    var a = G.advisor();
    text = text || MC.VOICE[line];
    if (!text) return;
    $('advisor').innerHTML = advisorPic(a) + '<div class="txt"><b>' + esc(a.name) + '</b>' + esc(text) + '</div>';
    // bei offenem Fenster nur die Stimme (Text steht z. B. im Ziele-Fenster schon, Blase würde Bedienung verdecken)
    $('advisor').hidden = !$('sheet').hidden;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { $('advisor').hidden = true; }, Math.max(4000, text.length * 75));
    if (G.S.voice) AS.say(AS.voice(a.id, line));
  };
  $('advisor').addEventListener('click', function () { $('advisor').hidden = true; });
  // Tipp des Beraters, je Stadt einmal. Mit Stimme sofort; ohne Stimme wartet die Sprechblase, bis kein Fenster mehr offen ist.
  function tip(key, delay) {
    var S = G.S;
    if (S.legacy || G.inTut() || G.visiting || S.seen['tip_' + key] || !MC.VOICE[key]) return false;
    G.markSeen('tip_' + key);
    var tries = 0;
    function go() {
      if (G.visiting) return;
      if ((!$('sheet').hidden || modalOpen) && !G.S.voice && tries++ < 240) return setTimeout(go, 500);
      UI.say(key);
    }
    setTimeout(go, delay || 300);   // erst nach dem Öffnen eines Fensters prüfen (das blendet die Blase sonst gleich wieder aus)
    return true;
  }
  UI.tip = tip;

  UI.toast = function (msg, err, img) {
    var d = document.createElement('div');
    d.className = 'toast' + (err ? ' err' : '');
    d.innerHTML = (img ? '<img src="' + img + '" alt="">' : '') + esc(msg);
    $('toasts').appendChild(d);
    if (err) UI.sound('error');
    while ($('toasts').children.length > 3) $('toasts').removeChild($('toasts').firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
  };

  // ---------- Kopfzeile ----------
  function hud() {
    var S = G.S;
    $('lvl').textContent = S.lvl;
    $('city').textContent = S.name || 'Meine Stadt';
    $('xpfill').style.width = Math.min(100, 100 * S.xp / MC.xpNeed(S.lvl)) + '%';
    $('cash').textContent = MC.short(S.cash);
    $('gold').textContent = S.gold;
    $('worth').textContent = MC.short(G.netWorth());
    var n = G.readyCount(), b = $('collectBadge');
    b.hidden = n === 0; b.textContent = n;
    document.querySelector('[data-act=collect]').classList.toggle('idle', n === 0);
    var m = G.mission(), done = !!(m && m.done) && !G.inTut() && !G.visiting;
    $('missionDot').hidden = !done;
    if (done && missionWasDone === false) { UI.toast('Ziel erreicht: ' + m.m.t); UI.sound('mission'); UI.say('ziel_fertig'); }
    missionWasDone = done;
    goalBox(m);
    flatBtn();
    if (V.mode === 'move') moveBanner();
    features();
  }

  // ---------- Flache Ansicht (2D) zum Bearbeiten: Knopf rechts über der Leiste ----------
  function flatBtn() {
    var b = $('flatBtn'); if (!b) return;
    var show = !G.inTut() && !G.visiting;
    if (!show && V.flat) V.setFlat(false);
    b.hidden = !show;
    $('flatTxt').textContent = V.flat ? '3D' : '2D';
    b.classList.toggle('on', V.flat);
  }
  UI.flatChanged = flatBtn;

  // ---------- Aktuelles Ziel dauerhaft oben links (mit Fortschritt, Tippen öffnet die Ziele) ----------
  function goalShort(m) {
    if (m.waiting) return m.m.t;
    var d = String(m.m.d || m.m.t).split(/\.\s|\s[–-]\s|:\s/)[0].replace(/\.$/, '');
    return d.length > 64 ? m.m.t : d;
  }
  function progText(m) {
    var pct = /Deko-Bonus/.test(m.m.d || '') ? ' %' : '';
    return (m.need > 9999 ? MC.short(Math.min(m.have, m.need)) + ' / ' + MC.short(m.need) : Math.min(m.have, m.need) + ' / ' + m.need) + pct;
  }
  function goalBox(m) {
    var box = $('goal'); if (!box) return;
    var show = !!m && !G.inTut() && !G.visiting && V.mode === 'idle' && !G.S.legacy;
    box.hidden = !show; if (!show) return;
    var done = !!m.done;
    box.classList.toggle('done', done);
    $('goalT').textContent = done ? 'Ziel erreicht – Belohnung abholen' : goalShort(m);
    $('goalFill').style.width = Math.max(4, Math.min(100, 100 * m.have / m.need)) + '%';
    $('goalN').textContent = done ? '' : progText(m);
  }

  // ---------- Freischaltungen: Werkzeuge ein-/ausblenden, „Neu“-Abzeichen, nächste Freischaltung ----------
  var TOOL_FEATURE = { move: 'move', bulldoze: 'bulldoze', collect: 'collectall' };
  var featSig = '';
  function shopHasNew() {
    if (G.inTut()) return false;
    var tabs = MC.KINDS.some(function (k) { return k.id !== 'house' && tabUnlocked(k.id) && G.isNew('tab_' + k.id); });
    return tabs || MC.BUILDINGS.some(function (d) { return d.kind !== 'hq' && d.lvl <= G.S.lvl && G.kindUnlocked(d) && G.isNew('b_' + d.id) && d.lvl > 1; });
  }
  function tabUnlocked(k) { return k === 'house' || (k === 'deco' && G.unlocked('deko')) || (k === 'shop' && G.unlocked('gewerbe')) || (k === 'wonder' && G.unlocked('wonder')); }
  function features() {
    var S = G.S, nx = G.nextUnlock();
    var sig = S.lvl + ':' + Object.keys(S.seen).length + ':' + S.tut + ':' + (S.legacy ? 1 : 0);
    if (sig === featSig) return;
    featSig = sig;
    Object.keys(TOOL_FEATURE).forEach(function (a) {
      var b = document.querySelector('[data-act=' + a + ']'), on = G.unlocked(TOOL_FEATURE[a]);
      b.hidden = !on;
      setNew(b, on && !G.inTut() && G.isNew('tool_' + a) && !S.legacy);
    });
    setNew(document.querySelector('[data-act=shop]'), shopHasNew());
    // Vorschau: was kommt mit dem nächsten Level?
    var ic = $('nextIc');
    if (nx && !S.legacy) {
      var d = nx.items[0];
      ic.innerHTML = (d ? '<img src="' + A.url(d.id) + '" alt="">' : '<svg viewBox="0 0 24 24" style="width:20px;height:20px;color:#fff"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>') + '<b>' + nx.lvl + '</b>';
      ic.hidden = false;
    } else ic.hidden = true;
  }
  function setNew(el, on) {
    var t = el.querySelector('.newtag');
    if (on && !t) el.insertAdjacentHTML('beforeend', '<i class="newtag">NEU</i>');
    if (!on && t) t.parentNode.removeChild(t);
  }
  var FEAT_NAME = { deko: 'Deko', gewerbe: 'Gewerbe', move: 'Umsetzen', bulldoze: 'Abriss', collectall: 'Alles kassieren', daily: 'Tagesbonus', land: 'Grundstücke kaufen', sets: 'Sammlungen', wonder: 'Weltwunder', goldex: 'Gold-Tausch', premium: 'Premium-Gebäude' };
  function num(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  // „noch 11.033 XP bis Level 30“ – bei mehreren Leveln bis zur Freischaltung zusätzlich die Gesamtsumme
  function xpTo(L) {
    var S = G.S, first = MC.xpNeed(S.lvl) - S.xp, all = first;
    for (var l = S.lvl + 1; l < L; l++) all += MC.xpNeed(l);
    return 'noch ' + num(first) + ' XP bis Level ' + (S.lvl + 1) + (L > S.lvl + 1 ? ' · bis Level ' + L + ' insgesamt ' + num(all) + ' XP' : '');
  }
  function nextBox() {
    if (G.visiting) return '';
    var nx = G.nextUnlock();
    if (!nx || G.S.legacy) return '';
    var names = nx.feats.map(function (f) { return FEAT_NAME[f]; }).concat(nx.items.map(function (d) { return d.name; }));
    var d = nx.items[0];
    return '<div class="nextbox">' + (d ? '<img src="' + A.url(d.id) + '" alt="">' : '') + '<div><b>Level ' + nx.lvl + ' bringt:</b><br>' + esc(names.join(', ')) +
      '<br><span class="sub">' + xpTo(nx.lvl) + '</span></div></div>';
  }
  // neue Funktion nach dem Level-up vorstellen (im Tutorial erst danach)
  var pendingIntro = [];
  function introFeature(lvl) {
    var f = MC.FEATURE_INTRO[lvl];
    if (!f || G.S.legacy) return;
    if (G.inTut()) { pendingIntro.push(lvl); return; }
    setTimeout(function () {
      UI.say(f[0]);
      if (f[0] === 'neu_land') V.zoomOut(Math.min(window.innerWidth, window.innerHeight) < 500 ? 0.34 : 0.5);
      var el = f[1] && document.querySelector(f[1]);
      if (el) { el.classList.add('pulse'); setTimeout(function () { el.classList.remove('pulse'); }, 6000); }
    }, 300);
  }
  UI.runPendingIntros = function () { var p = pendingIntro; pendingIntro = []; p.forEach(introFeature); };

  // ---------- Modi ----------
  function moveBanner() {
    var t = G.passActive() ? 'Umzugspass aktiv, noch ' + MC.dur(G.S.movePass - G.now()) + '. ' : 'Umsetzen kostet 10 % des Werts. ';
    var html = 'Gebäude antippen. ' + t + (G.passActive() ? '' : '<button class="mini" data-pass>Pass 24 Std. · ' + MC.MOVE_PASS.gold + ' Gold</button>');
    if ($('bannerText').getAttribute('data-h') !== html) { $('bannerText').innerHTML = html; $('bannerText').setAttribute('data-h', html); }
  }
  UI.modeChanged = function () {
    var m = V.mode, place = m === 'place';
    goalBox(G.mission());
    if (m !== 'idle') $('advisor').hidden = true;
    $('bar').hidden = place; $('placebar').hidden = !place;
    $('banner').hidden = m === 'idle';
    var txt = { road: 'Straße: tippen oder ziehen. Tippen auf eine Straße entfernt sie.', bulldoze: 'Abriss: Gebäude oder Straße antippen.' }[m];
    if (place) txt = esc(V.ghost.def.name) + (V.ghost.moving ? ' umsetzen' : '') + ': Karte antippen oder ziehen.' +
      (V.ghost.moving && V.ghost.moving.c ? ' Der Mietvertrag startet danach neu.' : '');
    $('bannerText').removeAttribute('data-h');
    if (m === 'move') moveBanner(); else $('bannerText').innerHTML = txt || '';
    $('bannerDone').hidden = place;
    var btns = document.querySelectorAll('#bar button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-act') === m);
    if (m !== 'idle') closeSheet(true);
    UI.ghostMoved();
  };
  UI.ghostMoved = function () {
    var q = V.ghost; if (!q) return;
    var ok = V.ghostOk(), b = $('placeOk'), poor;
    if (q.moving) {
      var fee = (q.moving.x === q.x && q.moving.y === q.y) ? 0 : G.moveFee(q.moving);
      b.innerHTML = 'Hier absetzen' + (fee ? ' · ' + MC.money(fee) : '');
      poor = G.S.cash < fee;
    } else {
      b.innerHTML = 'Bauen · ' + price(q.def);
      poor = G.S.cash < q.def.cost || G.S.gold < (q.def.gold || 0);
    }
    b.classList.toggle('off', !ok || poor);
  };
  function price(d) { return d.gold ? d.gold + ' Gold' + (d.cost ? ' + ' + MC.money(d.cost) : '') : MC.money(d.cost); }

  // ---------- Sheet ----------
  function openSheet(title, html, state) {
    var wasOpen = !$('sheet').hidden;
    $('advisor').hidden = true;   // Sprechblase darf keine Bedienelemente verdecken
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = html;
    if (!state || !cur || cur.type !== state.type || cur.id !== state.id) $('sheetBody').scrollTop = 0;
    $('sheet').hidden = false;
    if (!wasOpen) UI.sound('open');
    cur = state || { type: 'x' };
    V.highlight = (cur.type === 'b') ? G.get(cur.id) : null;
  }
  function closeSheet(silent) {
    if (!$('sheet').hidden && !silent) UI.sound('close');
    $('sheet').hidden = true; cur = null; V.highlight = null;
  }
  UI.closeSheet = closeSheet;

  function statLine(d) {
    if (d.kind === 'house') return 'Miete ' + MC.short(d.rent) + ' $/Std. · ' + d.cap + ' Bewohner';
    if (d.kind === 'shop') return d.per + ' $ je Kunde / ' + MC.durShort(d.cycle) + ' · Radius ' + d.reach;
    if (d.kind === 'deco') return '+' + d.bonus + ' % Miete · Radius ' + d.reach;
    return d.desc;
  }
  function openShop(tab) {
    shopTab = tab || shopTab;
    if (!tabUnlocked(shopTab)) shopTab = 'house';
    if (shopTab === 'deco') tip('tipp_deko');
    var S = G.S, h = '<div class="tabs">', teasers = 0, seenNow = [];
    MC.KINDS.forEach(function (k) {
      if (!tabUnlocked(k.id)) return;
      var nw = k.id !== 'house' && G.isNew('tab_' + k.id) && !G.inTut() && !S.legacy;
      h += '<button data-tab="' + k.id + '"' + (k.id === shopTab ? ' class="on"' : '') + '>' + k.name + (nw ? '<i class="newtag">NEU</i>' : '') + '</button>';
    });
    h += '</div><div class="grid">';
    MC.BUILDINGS.slice().sort(function (x, y) { return (x.lvl - y.lvl) || ((x.gold ? 1 : 0) - (y.gold ? 1 : 0)); }).forEach(function (d) {
      if ((d.friend ? (tabUnlocked('wonder') ? 'wonder' : 'deco') : d.kind) !== shopTab) return;
      var lock = (d.lvl > S.lvl && !S.legacy) || !G.kindUnlocked(d), own = d.kind === 'wonder' && G.count(d.id) > 0;
      if (d.friend && lock) {
        if (!MC.Cloud.enabled || G.inTut()) return;
        h += '<button class="item teaser friend" data-do="invite"><img src="' + A.url(d.id) + '" alt=""><span class="nm">' + esc(d.name) + '</span><span class="st">Erster Freund: +' + MC.FRIEND_FIRST + ' % auf alles</span><span class="pr">Freund einladen</span></button>';
        return;
      }
      if (lock) {
        // nur die nächsten zwei gesperrten als Silhouette zeigen (Vorfreude), der Rest bleibt verborgen
        if (teasers >= 2 || (d.gold && !G.unlocked('premium') && d.lvl <= S.lvl)) return;
        teasers++;
        h += '<button class="item teaser" data-build="' + d.id + '"><img src="' + A.url(d.id) + '" alt=""><span class="nm">???</span><span class="st">Wird bald freigeschaltet</span>' +
          '<span class="pr">Ab Level ' + Math.max(d.lvl, d.gold ? MC.FEATURES.premium : 0) + '</span></button>';
        return;
      }
      var blk = G.shopBlocked(d), poor = !own && (blk || S.cash < d.cost || S.gold < (d.gold || 0));
      var nw = G.isNew('b_' + d.id) && d.lvl > 1 && !G.inTut() && !S.legacy;
      seenNow.push('b_' + d.id);
      h += '<button class="item' + (poor ? ' poor' : '') + (own ? ' own' : '') + (d.gold ? ' prem' : '') + '" data-build="' + d.id + '">' +
        (d.gold ? '<span class="premtag">Premium</span>' : '') + (nw ? '<i class="newtag">NEU</i>' : '') +
        '<img src="' + A.url(d.id) + '" alt=""><span class="nm">' + esc(d.name) + '</span><span class="st">' + esc(statLine(d)) +
        (d.build ? '<br>Bauzeit ' + MC.dur(d.build) : '') + '</span>' +
        '<span class="pr">' + (own ? 'Gebaut' : blk ? 'Ab ' + G.SHOP_HOUSES + ' Häusern' : (d.gold ? GOLD + ' ' : '') + price(d)) + '</span></button>';
    });
    openSheet('Bauen', h + '</div>', { type: 'shop', id: shopTab });
    // gesehen: Abzeichen verschwinden beim nächsten Öffnen
    if (!G.inTut()) { G.markSeen('tab_' + shopTab); seenNow.forEach(G.markSeen); }
  }

  function hero(d, chips, text) {
    return '<div class="hero"><img src="' + A.url(d.id) + '" alt=""><div><p>' + esc(text || d.desc) + '</p><div class="chips">' + chips.join('') + '</div></div></div>';
  }
  function chip(t, c) { return '<span class="chip' + (c ? ' ' + c : '') + '">' + t + '</span>'; }
  function footer(b, d) {
    if (!G.unlocked('move')) return '';
    var h = '<div class="row"><button class="btn ghost" data-do="move">Umsetzen' + (G.moveFee(b) ? ' · ' + MC.money(G.moveFee(b)) : '') + '</button>';
    if (d.kind !== 'hq' && G.unlocked('bulldoze')) h += '<button class="btn danger" data-do="demolish">Abreißen</button>';
    return h + '</div>';
  }
  // leere Häuser (für „Für alle“): dieses Haus zuerst
  function emptyHouses(b) {
    var l = [b];
    G.S.b.forEach(function (x) { if (x !== b && MC.DEF[x.t].kind === 'house') { var st = G.state(x); if (st === 'empty' || st === 'expired') l.push(x); } });
    return l;
  }
  function contractList(b) {
    var S = G.S, h = '<h4>Mietvertrag wählen</h4><div class="list">', teased = false;
    var all = applyAll ? emptyHouses(b) : [b];
    MC.CONTRACTS.slice().sort(function (a, c) { return a.dur - c.dur; }).forEach(function (c) {
      var o = G.offer(b, c), lock = c.lvl > S.lvl && !S.legacy, poor = !lock && S.cash < o.cost;
      // bei „Für alle“: Gesamtgebühr und Gesamteinnahme anzeigen
      var sumFee = 0, sumPay = 0;
      all.forEach(function (x) { var ox = G.offer(x, c); sumFee += ox.cost; sumPay += ox.pay; });
      if (all.length > 1) { o = { cost: sumFee, pay: sumPay, n: o.n, xp: o.xp }; poor = !lock && S.cash < sumFee; }
      if (lock) { if (teased) return; teased = true; }   // nur der nächste gesperrte Vertrag als Vorschau
      h += '<button class="contract' + (lock ? ' lock teaser' : '') + (poor ? ' poor' : '') + (b.last === c.id && !lock ? ' last' : '') + '" data-sign="' + c.id + '">' +
        '<span class="t">' + esc(c.name) + '<small>' + MC.durShort(c.dur) + '</small></span>' +
        '<span class="p">+' + MC.money(o.pay) + '<small>' + (lock ? 'ab Level ' + c.lvl : 'Gebühr ' + MC.money(o.cost)) + '</small></span>' +
        '<span class="m">' + o.n + ' Bewohner · +' + o.xp + ' XP · verfällt nach ' + MC.durShort(G.grace({ k: c.id })) + '</span></button>';
    });
    var cnt = emptyHouses(b).length;
    h += '</div>' + (cnt > 1 ? '<button class="check' + (applyAll ? ' on' : '') + '" data-do="all"><i></i>Für alle ' + cnt + ' leeren Häuser abschließen' +
      (applyAll ? ' – Beträge gelten für alle zusammen' : '') + '</button>' : '');
    return h;
  }

  function buildingSig(b) { return b.id + ':' + G.state(b) + ':' + (b.c ? b.c.k : '') + ':' + G.S.lvl; }
  function openBuilding(b) {
    var d = MC.DEF[b.t], st = G.state(b), h = '', chips = [chip(KIND[d.kind])];
    if (d.kind === 'house' && (st === 'empty' || st === 'expired') && !G.visiting) tip('tipp_vertraege', 500);
    if (d.gold) chips.push(chip('Premium', 'y'));
    if (st === 'build') {
      var p = G.finishPrice(b);
      h = hero(d, chips) + '<div class="mission"><h3>Im Bau</h3><p>Fertig in <b data-left="' + b.cu + '"></b></p>' +
        '<div class="prog"><i data-prog="' + b.cs + ',' + b.cu + '"></i></div></div>' +
        (G.freeFinish() ? '<div class="row" style="margin-bottom:8px"><button class="btn goldbtn" style="width:100%" data-do="finishfree">Einmal gratis fertigstellen</button></div>' : '') +
        '<div class="row"><button class="btn primary two" data-do="finish"><small>Sofort fertig</small><span data-fin="cash">' + MC.money(p.cash) + '</span></button>' +
        '<button class="btn goldbtn two" data-do="finishgold"><small>Sofort fertig</small><span><span data-fin="gold">' + p.gold + '</span> ' + GOLD + '</span></button></div>' +
        (footer(b, d) ? '<h4>Sonstiges</h4>' + footer(b, d) : '');
    } else if (d.kind === 'house') {
      var bonus = G.bonus(b);
      chips.push(chip(d.cap + ' Wohnplätze'));
      chips.push(chip('Deko-Bonus +' + bonus + ' %', bonus ? 'g' : ''));
      h = hero(d, chips);
      if (st === 'noroad') h += '<div class="note">Kein Straßenanschluss. Baue eine Straße direkt an das Haus – erst dann ziehen Mieter ein.</div>';
      else if (st === 'running' || st === 'ready') {
        var c = MC.CONTRACT[b.c.k];
        h += '<div class="mission"><h3>' + esc(c.name) + ' · ' + b.c.n + ' Bewohner</h3>' +
          '<p>Miete <b>' + MC.money(b.c.pay) + '</b> fällig in <b data-left="' + b.c.end + '"></b>.<br>Danach bleibt dir ' + MC.durShort(G.grace(b.c)) + ' zum Kassieren.</p>' +
          '<div class="prog"><i data-prog="' + b.c.s + ',' + b.c.end + '"></i></div></div>' +
          '<div class="row"><button class="btn ghost" data-do="cancel">Vertrag kündigen (+' + MC.money(Math.round(b.c.cost * MC.CANCEL_REFUND)) + ')</button></div>';
      } else {
        if (st === 'expired') h += '<div class="note red"><b>Zu spät!</b> Die Mieter sind ausgezogen, ' + MC.money(b.c.pay) + ' Miete sind verfallen.' +
          '<div class="row" style="margin-top:8px"><button class="btn goldbtn" data-do="rescue">Miete doch noch retten · ' + G.rescueCost(b) + ' ' + GOLD + '</button></div></div>';
        h += contractList(b);
      }
      h += (footer(b, d) ? '<h4>Sonstiges</h4>' + footer(b, d) : '');
    } else if (d.kind === 'shop') {
      var cu = G.customers(b), inc = G.shopIncome(b);
      chips.push(chip('Radius ' + d.reach)); chips.push(chip(d.per + ' $ je Kunde'));
      h = hero(d, chips);
      if (st === 'noroad') h += '<div class="note">Kein Straßenanschluss. Ohne Straße kommt keine Kundschaft.</div>';
      else {
        if (cu === 0) h += '<div class="note">Keine Kunden. Im blauen Einzugsgebiet muss mindestens ein Haus mit laufendem Mietvertrag stehen.</div>';
        h += '<div class="stats"><div class="stat"><b>' + cu + '</b><span>Kunden im Gebiet</span></div>' +
          '<div class="stat"><b>' + MC.money(inc) + '</b><span>je ' + MC.durShort(d.cycle) + '</span></div>' +
          '<div class="stat"><b data-left="' + (b.s + d.cycle) + '" data-zero="Jetzt"></b><span>nächste Kasse</span></div></div>';
      }
      h += footer(b, d);
    } else if (d.kind === 'deco') {
      chips.push(chip('+' + d.bonus + ' % Miete', 'g')); chips.push(chip('Radius ' + d.reach));
      h = hero(d, chips, 'Erhöht die Miete aller Häuser im gelben Bereich.') + footer(b, d);
    } else if (d.kind === 'wonder' && d.friend) {
      chips.push(chip((G.S.friends || 0) + ' Freunde', 'y')); chips.push(chip('+' + G.friendBonus() + ' % auf alles', 'g'));
      h = hero(d, chips) + '<div class="row" style="margin-top:10px"><button class="btn goldbtn" style="flex:1" data-do="invite">Weitere Freunde einladen</button></div>' + footer(b, d);
    } else if (d.kind === 'wonder') {
      chips.push(chip('Wirkt stadtweit', 'y'));
      h = hero(d, chips) + footer(b, d);
    } else {
      h = hqHtml();
    }
    openSheet(d.kind === 'hq' ? (G.S.name || 'Meine Stadt') : d.name, h, { type: 'b', id: b.id, sig: buildingSig(b) });
    timers();
  }
  UI.openBuilding = openBuilding;

  function hqHtml() {
    var S = G.S, w = G.worth(), houses = 0, shops = 0, rate = G.goldRate(), ready = G.setsReady();
    S.b.forEach(function (x) { var k = MC.DEF[x.t].kind; if (k === 'house') houses++; if (k === 'shop') shops++; });
    return '<div class="hero"><img src="' + A.url('hq') + '" alt=""><div><div class="sub">Firmenwert</div><div class="big">' + MC.money(w.total) + '</div>' +
      '<div class="chips">' + chip(G.title(), 'y') + chip('Level ' + S.lvl) + '</div></div></div>' + nextBox() +
      '<div class="stats"><div class="stat"><b>' + MC.money(w.cash) + '</b><span>Bargeld</span></div>' +
      '<div class="stat"><b>' + MC.money(w.buildings) + '</b><span>Gebäude</span></div>' +
      '<div class="stat"><b>' + MC.money(w.land) + '</b><span>Grundstücke</span></div>' +
      '<div class="stat"><b>' + MC.money(w.gold) + '</b><span>Gold (' + S.gold + ' Barren)</span></div></div>' +
      (G.unlocked('goldex') && !G.visiting ? '<h4>Gold eintauschen</h4><div class="note">1 Gold = ' + MC.money(rate) + ' (Kurs steigt mit deinem Level)</div>' +
      '<div class="row"><button class="btn goldbtn' + (S.gold ? '' : ' off') + '" data-do="ex1">1 Gold tauschen</button>' +
      '<button class="btn ghost' + (S.gold >= 10 ? '' : ' off') + '" data-do="ex10">10 Gold tauschen</button></div>' : '') +
      '<h4>Imperium</h4><div class="stats">' +
      '<div class="stat"><b>' + num(S.xp) + ' / ' + num(MC.xpNeed(S.lvl)) + '</b><span>XP bis Level ' + (S.lvl + 1) + '</span></div>' +
      '<div class="stat"><b>' + houses + ' / ' + shops + '</b><span>Häuser / Gewerbe</span></div>' +
      '<div class="stat"><b>' + num(G.totalTenants()) + '</b><span>Bewohner</span></div>' +
      '<div class="stat"><b>' + MC.money(S.st.earned) + '</b><span>insgesamt kassiert</span></div>' +
      '<div class="stat"><b>' + S.land.length + ' / 25</b><span>Grundstücke</span></div>' +
      '<div class="stat"><b>' + S.st.expired + '</b><span>verpasste Mieten</span></div></div>' +
      (G.visiting ? '' : '<div class="row">' + (G.unlocked('sets') ? '<button class="btn primary" data-do="sets">Sammlungen' + (ready ? ' (' + ready + ' fertig)' : '') + '</button>' : '') +
      '<button class="btn ghost" data-do="ranking">Bestenliste</button><button class="btn ghost" data-do="rename">Stadt umbenennen</button>' + (G.unlocked('move') ? '<button class="btn ghost" data-do="move">Zentrale umsetzen</button>' : '') + '</div>');
  }

  function openSets() {
    var S = G.S, h = '<div class="note">Sammelstücke findest du zufällig beim Kassieren. Eine volle Sammlung tauschst du gegen eine Belohnung ein – danach kannst du sie erneut sammeln.</div>';
    MC.COLLECTIONS.forEach(function (c) {
      var lock = c.lvl > S.lvl, have = S.coll[c.id] || [0, 0, 0, 0, 0], done = G.setComplete(c.id);
      h += '<div class="mission set' + (lock ? ' lock' : '') + '"><h3>' + esc(c.name) + (lock ? ' <small>ab Level ' + c.lvl + '</small>' : '') + '</h3><div class="setrow">';
      c.items.forEach(function (nm, i) {
        var u = AS.url('samm_' + c.id + '_' + (i + 1));
        h += '<div class="sitem' + (have[i] ? ' got' : '') + '">' + (u ? '<img src="' + u + '" alt="">' : '<span class="ph">' + esc(nm.charAt(0)) + '</span>') +
          '<span>' + esc(nm) + '</span>' + (have[i] > 1 ? '<i>' + have[i] + '</i>' : '') + '</div>';
      });
      h += '</div><div class="reward">Belohnung: ' + rewardHtml(c.r) + '</div>' +
        (done ? '<button class="btn goldbtn" style="width:100%;margin-top:8px" data-set="' + c.id + '">Eintauschen</button>' : '') + '</div>';
    });
    openSheet('Sammlungen', h, { type: 'sets' });
  }

  function timers() {
    var t = G.now(), i, els = document.querySelectorAll('#sheetBody [data-left]');
    for (i = 0; i < els.length; i++) {
      var left = +els[i].getAttribute('data-left') - t;
      els[i].textContent = left <= 0 ? (els[i].getAttribute('data-zero') || '0 Sek.') : MC.dur(left);
    }
    els = document.querySelectorAll('#sheetBody [data-prog]');
    for (i = 0; i < els.length; i++) {
      var p = els[i].getAttribute('data-prog').split(',');
      els[i].style.width = Math.max(0, Math.min(100, 100 * (t - p[0]) / Math.max(1, p[1] - p[0]))) + '%';
    }
    if (cur && cur.type === 'b') {
      var b = G.get(cur.id);
      if (b && b.cu) {
        var fp = G.finishPrice(b), e1 = document.querySelector('[data-fin=cash]'), e2 = document.querySelector('[data-fin=gold]');
        if (e1) e1.textContent = MC.money(fp.cash);
        if (e2) e2.textContent = fp.gold;
      }
    }
  }

  function rewardHtml(r) {
    var p = [];
    if (r.cash) p.push(COIN + ' ' + MC.money(r.cash));
    if (r.gold) p.push(GOLD + ' ' + r.gold + ' Gold');
    if (r.xp) p.push('+' + r.xp + ' XP');
    return p.join(' &nbsp; ');
  }
  function openMissions() {
    var m = G.mission(), a = G.advisor(), h = '';
    if (!m) h = '<div class="speech">' + advisorPic(a) + '<div><b>' + esc(a.name) + '</b>' + esc(MC.VOICE.alles) + '</div></div>';
    else {
      h = '<div class="speech">' + advisorPic(a) + '<div><b>' + esc(a.name) + '</b>' + esc(m.m.d) + '</div>' +
        '<button class="replay" data-do="replay" aria-label="Vorlesen"><svg viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg></button></div>' +
        '<div class="mission"><h3>' + esc(m.m.t) + '</h3>' +
        '<div class="prog"><i style="width:' + (100 * m.have / m.need) + '%"></i></div>' +
        '<div class="sub">' + (m.need > 9999 ? MC.short(m.have) + ' / ' + MC.short(m.need) : m.have + ' / ' + m.need) + '</div>' +
        '<div class="reward">Belohnung: ' + rewardHtml(m.m.r) + '</div></div>' +
        '<button class="btn ' + (m.done ? 'goldbtn' : 'ghost off') + '" style="width:100%" data-do="claim">' + (m.done ? 'Belohnung abholen' : 'Noch nicht erreicht') + '</button>';
      var nx = MC.MISSIONS.slice(m.idx + 1, m.idx + 4);
      if (nx.length) { h += '<h4>Danach</h4>'; nx.forEach(function (x) { h += '<div class="next">' + esc(x.t) + '</div>'; }); }
      h += '<h4>Fortschritt</h4><div class="next">' + m.idx + ' von ' + MC.MISSIONS.length + ' Zielen erreicht</div>';
    }
    openSheet('Ziele', h, { type: 'missions' });
  }
  UI.openMissions = openMissions;
  function sayMission() { var m = G.mission(); if (m) UI.say('mission_' + (m.idx + 1), m.m.d); }

  function toggle(key, label) { return '<button class="check' + (G.S[key] ? ' on' : '') + '" data-tog="' + key + '"><i></i>' + label + '</button>'; }
  function openMenu() {
    var h = (MC.Cloud.enabled && !G.inTut() ? '<div class="row" style="margin-bottom:12px"><button class="btn goldbtn" style="flex:1" data-do="invite">Freunde einladen' + (G.S.friends ? ' (' + G.S.friends + ')' : ' – +' + MC.FRIEND_FIRST + ' %') + '</button></div>' : '') +
      toggle('sound', 'Soundeffekte') + toggle('music', 'Musik') + toggle('voice', 'Berater-Stimme') +
      toggle('ignoreMute', 'Ton auch bei Stummschaltung') +
      (MC.Cloud.enabled ? '<h4>Dein Stadt-Code</h4><div class="codebox">' + esc(MC.Cloud.code) + '</div>' +
        '<div class="row"><button class="btn primary" data-do="copylink">' + (navigator.share ? 'Link teilen' : 'Link kopieren') + '</button><button class="btn ghost" data-do="usecode">Anderen Code eingeben</button></div>' : '') +
      '<h4>Spielstand</h4><div class="row"><button class="btn ghost" data-do="export">Sichern</button><button class="btn ghost" data-do="import">Wiederherstellen</button></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn primary" data-do="ranking">Bestenliste</button><button class="btn ghost" data-do="advisor">Berater wechseln</button><button class="btn danger" data-do="reset">Neu anfangen</button></div>' +
      '<h4>Updates</h4><div class="row"><button class="btn ghost" data-do="update">Nach Update suchen</button></div>' +
      '<div class="next" style="margin-top:10px">Mogul City · Version 0.5 · <span data-cloud>' + esc(MC.Cloud.status) + '</span>' + (G.S.test ? ' · Teststadt' : '') + ' · Testphase: Spielfortschritt wird ausgewertet' + (AS.manifest.version ? ' · Assets ' + esc(AS.manifest.version) : '') + '</div>';
    openSheet('Menü', h, { type: 'menu' });
  }

  // ---------- Dialoge ----------
  function modal(html, handlers) { modalQueue.push({ html: html, handlers: handlers || {} }); if (!modalOpen) nextModal(); }
  var modalHandlers = {};
  function nextModal() {
    var m = modalQueue.shift();
    if (!m) { modalOpen = false; $('modal').hidden = true; return; }
    modalOpen = true; modalHandlers = m.handlers;
    $('modalCard').innerHTML = m.html; $('modal').hidden = false;
  }
  $('modal').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b) return;
    var f = modalHandlers[b.getAttribute('data-m')];
    if (f && f(b) === false) return;
    nextModal();
  });
  function art(id, fallback) {
    var u = AS.url(id) || (fallback ? A.url(fallback) : null);
    return u ? '<img class="art" src="' + u + '" alt="">' : '';
  }

  UI.askDemolish = function (b) {
    var d = MC.DEF[b.t];
    if (d.kind === 'hq') return UI.toast('Die Firmenzentrale bleibt stehen.', true);
    var r = G.refund(d);
    modal('<img class="art" src="' + A.url(d.id) + '" alt=""><h2>' + esc(d.name) + ' abreißen?</h2><p>Du bekommst ' + MC.money(r.cash) +
      (r.gold ? ' und ' + r.gold + ' Gold' : '') + ' zurück (35 % des Kaufpreises).' + (b.c ? ' Der laufende Mietvertrag geht verloren.' : '') + '</p>' +
      '<div class="row"><button class="btn ghost" data-m="no">Behalten</button><button class="btn danger" data-m="yes">Abreißen</button></div>', {
      yes: function () {
        var cx = b.x + d.size / 2, cy = b.y + d.size / 2;
        G.demolish(b); UI.sound('demolish'); closeSheet(true);
        V.float(cx, cy, '+' + MC.money(r.cash), '#b8f5c8');
      }
    });
  };
  UI.openLand = function (sx, sy) {
    var p = G.landPrice(), S = G.S; if (!p) return;
    var ok = S.cash >= p[0] && S.gold >= p[1];
    modal(art('bild_land') + '<h2>Grundstück kaufen</h2><p>12 × 12 Felder neues Bauland für deine Stadt. Jedes weitere Grundstück wird teurer.</p>' +
      '<div class="big">' + MC.money(p[0]) + (p[1] ? ' <span style="font-size:18px">+ ' + p[1] + ' ' + GOLD + '</span>' : '') + '</div>' +
      '<div class="row"><button class="btn ghost" data-m="no">Später</button><button class="btn primary' + (ok ? '' : ' off') + '" data-m="yes">Kaufen</button></div>', {
      yes: function () {
        var err = G.buyLand(sx, sy);
        if (err) { UI.toast(err, true); return; }
        UI.sound('land'); UI.toast('Neues Grundstück gekauft!'); UI.say('land');
      }
    });
  };
  function chooseAdvisor(first) {
    var h = '<h2>Wähle deinen Berater</h2><p>Er oder sie begleitet dich mit Aufträgen und Tipps.</p><div class="advisors">';
    MC.ADVISORS.forEach(function (a) {
      h += '<button class="adv' + (G.S.advisor === a.id ? ' on' : '') + '" data-m="pick" data-id="' + a.id + '">' + advisorPic(a, 'big') + '<b>' + esc(a.name) + '</b><span>' + esc(a.role) + '</span></button>';
    });
    modal(h + '</div>', {
      pick: function (el) {
        G.setAdvisor(el.getAttribute('data-id'));
        if (first && G.S.name) { UI.say('begruessung'); setTimeout(function () { if (G.inTut()) MC.Tut.start(); else sayMission(); }, 400); }
        else if (first) { UI.say('begruessung'); askName(true); }
        else UI.say('begruessung');
      }
    });
  }
  function askName(first) {
    modal((first ? art('bild_willkommen', 'hq') + '<h2>Willkommen, Chef!</h2><p>Aus einem leeren Stück Land machst du ein Immobilien-Imperium: Häuser bauen, vermieten, rechtzeitig kassieren – und immer größer werden.</p>' : '<h2>Stadt umbenennen</h2>') +
      '<input type="text" id="nameIn" maxlength="24" placeholder="Name deiner Stadt" value="' + esc(G.S.name || '') + '">' +
      '<div class="row"><button class="btn primary" data-m="ok">' + (first ? 'Los geht\'s' : 'Speichern') + '</button></div>', {
      ok: function () {
        G.setName($('nameIn').value || 'Mogul City'); hud();
        if (cur && cur.type === 'b') openBuilding(G.get(cur.id));
        if (first) setTimeout(function () { if (G.inTut()) MC.Tut.start(); else sayMission(); }, 400);
      }
    });
  }
  function daily() {
    if (G.visiting || !G.dailyDue()) return;
    var p = G.dailyPreview(), d = '';
    for (var i = 1; i <= 5; i++) d += '<span' + (i <= p.streak ? ' class="on"' : '') + '>Tag ' + i + '</span>';
    modal(art('bild_tagesbonus') + '<h2>Tagesbonus</h2><p>Schau jeden Tag vorbei – am fünften Tag in Folge gibt es Gold.</p><div class="days">' + d + '</div>' +
      '<div class="big">+' + MC.money(p.cash) + (p.gold ? ' <span style="font-size:18px">+ ' + p.gold + ' ' + GOLD + '</span>' : '') + '</div>' +
      '<div class="row"><button class="btn goldbtn" data-m="ok">Einsammeln</button></div>', {
      ok: function () { G.claimDaily(); UI.sound('daily'); UI.say('tagesbonus'); }
    });
  }
  function levelUp(e) {
    var un = '';
    MC.BUILDINGS.forEach(function (d) { if (d.lvl === e.lvl) un += '<div><img src="' + A.url(d.id) + '" alt="">' + esc(d.name) + '</div>'; });
    var cs = MC.CONTRACTS.filter(function (c) { return c.lvl === e.lvl; }).map(function (c) { return c.name + ' (' + MC.durShort(c.dur) + ')'; });
    var sets = MC.COLLECTIONS.filter(function (c) { return c.lvl === e.lvl && c.lvl > MC.FEATURES.sets; }).map(function (c) { return c.name; });
    var feats = G.S.legacy ? [] : Object.keys(MC.FEATURES).filter(function (f) { return MC.FEATURES[f] === e.lvl; }).map(function (f) { return FEAT_NAME[f]; });
    modal(art('bild_levelup') + '<h2>Level ' + e.lvl + '!</h2><p>+' + MC.money(e.cash) + ' und 1 Gold als Aufstiegsprämie.</p>' +
      (un ? '<h4>Neu im Baumenü</h4><div class="unlock">' + un + '</div>' : '') +
      (cs.length ? '<h4>Neuer Mietvertrag</h4><p>' + esc(cs.join(', ')) + '</p>' : '') +
      (sets.length ? '<h4>Neue Sammlung</h4><p>' + esc(sets.join(', ')) + '</p>' : '') +
      (feats.length ? '<h4>Neu freigeschaltet</h4><p>' + esc(feats.join(', ')) + '</p>' : '') +
      '<div class="row"><button class="btn primary" data-m="ok">Weiter</button></div>', {
      ok: function () {
        if (MC.FEATURE_INTRO[e.lvl]) introFeature(e.lvl); else UI.say('level', null, 60000);
        promoteFriends(e.lvl, MC.FEATURE_INTRO[e.lvl] ? 8000 : 2500);
      }
    });
    UI.sound('level');
  }

  // ---------- Freunde einladen ----------
  // Berater werben nach Erfolgsmomenten (Level 5 = etwa 10 Min., dann Level 8 und 12), nur solange noch kein Freund mitspielt
  function promoteFriends(lvl, delay) {
    var S = G.S;
    if (!MC.Cloud.enabled || S.legacy || G.visiting || (S.friends || 0) > 0 || MC.FRIEND_PROMPTS.indexOf(lvl) < 0 || S.seen['inv_' + lvl]) return;
    G.markSeen('inv_' + lvl);
    var first = lvl === MC.FRIEND_PROMPTS[0];
    setTimeout(function () {
      if (G.visiting) return;
      modal('<img class="art" src="' + A.url('w_freunde') + '" alt=""><h2>' + (first ? 'Spiel mit Freunden!' : 'Deine Freunde fehlen noch') + '</h2>' +
        '<p>' + esc(first ? MC.VOICE.freunde : MC.VOICE.freunde_erinnerung) + '</p>' + friendPerks() +
        '<div class="row"><button class="btn ghost" data-m="no">Später</button><button class="btn goldbtn" data-m="inv">Freunde einladen</button></div>', {
        inv: function () { setTimeout(openInvite, 50); }
      });
      UI.say(first ? 'freunde' : 'freunde_erinnerung');
      MC.Cloud.track('einladen_hinweis', lvl, 'inv_' + lvl);
    }, delay);
  }
  function friendPerks() {
    return '<div class="perks"><div><b>1. Freund</b><span>Platz der Freundschaft + ' + MC.FRIEND_FIRST + ' % auf alle Mieten und Läden</span></div>' +
      '<div><b>Jeder weitere</b><span>+1 % obendrauf (bis ' + MC.FRIEND_MAX + ' %)</span></div>' +
      '<div><b>Zählt ab</b><span>Level ' + MC.FRIEND_LVL + ' deines Freundes</span></div></div>';
  }
  function openInvite() {
    var S = G.S, n = S.friends || 0, list = S.friendNames || [];
    var h = '<div class="hero"><img src="' + A.url('w_freunde') + '" alt=""><div><div class="sub">Platz der Freundschaft</div><div class="big">' + (n ? '+' + G.friendBonus() + ' %' : 'Noch kein Freund') + '</div>' +
      '<div class="chips">' + chip(n + (n === 1 ? ' Freund' : ' Freunde'), 'y') + (n ? chip('Nächster: +1 %', 'g') : chip('Erster: +' + MC.FRIEND_FIRST + ' %', 'g')) + '</div></div></div>' +
      '<div class="note">Schick deinen Freunden deinen Einladungslink. Sobald jemand darüber eine Stadt gründet und Level ' + MC.FRIEND_LVL + ' erreicht, zählt er als dein Freund. Für jeden Freund weht eine Fahne auf deinem Platz der Freundschaft.</div>' +
      friendPerks();
    if (list.length) h += '<h4>Deine Freunde</h4>' + list.map(function (f) { return '<div class="next"><b>' + esc(f.name || 'Unbekannt') + '</b> · Level ' + (f.lvl || 1) + '</div>'; }).join('');
    h += MC.Cloud.enabled ? '<div class="row" style="margin-top:12px"><button class="btn goldbtn" style="flex:1" data-do="sendinvite">Einladung teilen</button></div>'
      : '<div class="note">Einladen braucht den Cloud-Spielstand.</div>';
    if (n && !G.count('w_freunde')) h += '<div class="row" style="margin-top:8px"><button class="btn primary" style="flex:1" data-do="buildfriend">Platz der Freundschaft bauen</button></div>';
    openSheet('Freunde einladen', h, { type: 'invite' });
    MC.Cloud.track('einladen_offen');
    checkFriends(true);
  }
  UI.openInvite = openInvite;
  function sendInvite() {
    MC.Cloud.inviteLink().then(function (link) {
      var txt = 'Bau mit mir in Mogul City! Gründe deine eigene Stadt über meinen Link:';
      MC.Cloud.track('einladen_teilen');
      if (navigator.share) return navigator.share({ title: 'Mogul City', text: txt, url: link }).catch(function () { });
      (navigator.clipboard ? navigator.clipboard.writeText(txt + ' ' + link) : Promise.reject()).then(function () { UI.toast('Einladungslink kopiert.'); }, function () { prompt('Einladungslink:', link); });
    }, function () { UI.toast('Einladung geht erst, wenn deine Stadt in der Cloud gespeichert ist.', true); });
  }
  // Freunde vom Server holen; neue Freunde feiern
  var friendsChecked = 0;
  function checkFriends(force) {
    if (!MC.Cloud.enabled || G.visiting || G.inTut() || document.body.classList.contains('gated')) return;
    if (!force && Date.now() - friendsChecked < 5 * MC.MIN) return;
    friendsChecked = Date.now();
    MC.Cloud.friends().then(function (list) {
      var S = G.S, old = S.friends || 0, n = list.length;
      S.friendNames = list.slice(0, 40).map(function (f) { return { name: f.name, lvl: f.lvl }; });
      if (n === old) return;
      S.friends = n; G.save(); hud(); V.kick();
      if (cur && cur.type === 'invite') openInvite();
      if (n > old) celebrateFriend(old, n, list[list.length - 1]);
    }).catch(function () { });
  }
  UI.checkFriends = checkFriends;
  function celebrateFriend(old, n, f) {
    var name = esc((f && f.name) || 'Ein Freund');
    if (old === 0) {
      modal('<img class="art" src="' + A.url('w_freunde') + '" alt=""><h2>' + name + ' spielt mit!</h2><p>Dein erster Freund ist dabei. Du darfst jetzt den <b>Platz der Freundschaft</b> bauen: <b>+' + MC.FRIEND_FIRST + ' %</b> auf alle Mieten und Gewerbe-Einnahmen.</p>' +
        '<div class="row"><button class="btn ghost" data-m="no">Später</button><button class="btn goldbtn" data-m="go">Jetzt platzieren</button></div>', {
        go: function () { if (!G.count('w_freunde')) V.setMode('place', { def: MC.DEF.w_freunde }); }
      });
      UI.say('freund_neu');
    } else {
      modal('<img class="art" src="' + A.url('w_freunde') + '" alt=""><h2>' + name + ' ist dabei!</h2><p>Jetzt ' + n + ' Freunde: <b>+' + G.friendBonus() + ' %</b> auf alle Mieten und Gewerbe-Einnahmen. Auf deinem Platz der Freundschaft weht eine neue Fahne.</p>' +
        '<div class="row"><button class="btn primary" data-m="ok">Super</button></div>');
      UI.say('freund_mehr');
    }
    UI.sound('set');
  }

  function exportSave() {
    var code = G.exportCode();
    modal('<h2>Spielstand sichern</h2><p>Kopiere diesen Code und bewahre ihn auf (z. B. in Notizen). Damit holst du deine Stadt auf jedes Gerät zurück.</p>' +
      '<textarea id="saveCode" readonly>' + esc(code) + '</textarea>' +
      '<div class="row"><button class="btn ghost" data-m="no">Schließen</button><button class="btn primary" data-m="copy">Kopieren</button></div>', {
      copy: function () {
        var t = $('saveCode'); t.select();
        var ok = false;
        try { if (navigator.clipboard) { navigator.clipboard.writeText(code); ok = true; } else ok = document.execCommand('copy'); } catch (e) { }
        UI.toast(ok ? 'Code kopiert.' : 'Bitte den Code markieren und kopieren.', !ok);
        return false;
      }
    });
  }
  function importSave() {
    modal('<h2>Spielstand wiederherstellen</h2><p>Füge einen gesicherten Code ein. Deine aktuelle Stadt wird dabei ersetzt.</p>' +
      '<textarea id="saveCode" placeholder="MOGUL1:..."></textarea>' +
      '<div class="row"><button class="btn ghost" data-m="no">Abbrechen</button><button class="btn danger" data-m="go">Laden</button></div>', {
      go: function () {
        var err = G.importCode($('saveCode').value);
        if (err) { UI.toast(err, true); return false; }
        closeSheet(true); hud(); UI.toast('Spielstand geladen.');
      }
    });
  }

  // ---------- Aktionen ----------
  UI.tapBuilding = function (b) {
    if (G.visiting) {   // beim Besuch nur ansehen
      var vd = MC.DEF[b.t], vt = vd.kind === 'house' ? vd.name + ' · ' + MC.offerOf(vd, MC.CONTRACT.c1h).n + ' Bewohner' : vd.name;
      UI.toast(vt + (vd.kind === 'house' && G.bonus(b) ? ' · Deko +' + G.bonus(b) + ' %' : ''));
      return;
    }
    var st = G.state(b);
    if (st === 'ready') {
      var r = G.collect(b);
      if (r && !r.none) {
        UI.sound(MC.DEF[b.t].kind === 'shop' ? 'shop_collect' : 'collect'); hud();
        if (cur && cur.type === 'b' && cur.id === b.id) openBuilding(b);
        return;
      }
    }
    if (st === 'expired') { UI.sound('expired'); UI.say('verfallen', null, 300000); }
    openBuilding(b);
  };
  function signContract(b, cid) {
    var c = MC.CONTRACT[cid];
    var err = G.sign(b, cid);
    if (err) return UI.toast(err, true);
    var n = 1, broke = 0;
    if (applyAll) {
      emptyHouses(b).forEach(function (x) {
        if (x === b) return;
        var e = G.sign(x, cid);
        if (!e) n++; else if (e === 'Nicht genug Geld.') broke++;
      });
    }
    UI.sound('sign');
    UI.toast(n > 1 ? n + ' Verträge abgeschlossen: ' + c.name : c.name + ' ziehen ein – Miete in ' + MC.durShort(c.dur));
    if (broke) UI.toast(broke + (broke === 1 ? ' Haus bleibt' : ' Häuser bleiben') + ' leer – das Geld reichte nicht für alle Gebühren.', true);
    closeSheet(true); hud();
  }
  function noMoney(d) {
    UI.toast('Dafür fehlen dir ' + (G.S.gold < (d.gold || 0) ? (d.gold - G.S.gold) + ' Gold' : MC.money(d.cost - G.S.cash)) + '.', true);
    UI.say('kein_geld', null, 120000);
  }

  $('sheetBody').addEventListener('click', function (e) {
    var rk = e.target.closest('[data-rank]');
    if (rk && cur && cur.list) { var rc = cur.list[+rk.getAttribute('data-rank')]; if (!rc.me) { UI.sound('tap'); visit(rc); } return; }
    var el = e.target.closest('[data-tab],[data-build],[data-sign],[data-do],[data-tog],[data-set]'); if (!el) return;
    var S = G.S, b = cur && cur.type === 'b' ? G.get(cur.id) : null, v;
    UI.sound('tap');
    if ((v = el.getAttribute('data-tab'))) return openShop(v);
    if ((v = el.getAttribute('data-build'))) {
      var d = MC.DEF[v];
      if (d.lvl > S.lvl) return UI.toast(d.name + ' gibt es ab Level ' + d.lvl + '.', true);
      if (d.kind === 'wonder' && G.count(v) > 0) return UI.toast('Jedes Weltwunder gibt es nur einmal.', true);
      var miss = G.shopBlocked(d);
      if (miss) return UI.toast('Erst ' + miss + ' ' + (miss === 1 ? 'Haus' : 'Häuser') + ' mehr bauen: Gewerbe verdient an Bewohnern – ab ' + G.SHOP_HOUSES + ' Häusern lohnt es sich.', true);
      if (S.cash < d.cost || S.gold < (d.gold || 0)) return noMoney(d);
      return V.setMode('place', { def: d });
    }
    if ((v = el.getAttribute('data-sign'))) return b && signContract(b, v);
    if ((v = el.getAttribute('data-tog'))) {
      S[v] = !S[v]; el.classList.toggle('on', S[v]); G.save();
      if (v === 'music') AS.music(S.music);
      if (v === 'ignoreMute') AS.setIgnoreMute(S.ignoreMute);
      if (v === 'sound' && S.sound) UI.sound('collect');
      return;
    }
    if ((v = el.getAttribute('data-set'))) {
      var r = G.claimSet(v);
      if (r) { UI.sound('set'); UI.say('sammlung'); hud(); openSets(); }
      return;
    }
    v = el.getAttribute('data-do');
    if (v === 'all') { applyAll = !applyAll; if (b) openBuilding(b); return; }
    if (v === 'replay') return sayMission();
    if (v === 'claim') {
      var cm = G.mission(), rr = G.claimMission();
      if (rr) {
        UI.sound('level'); missionWasDone = false; hud(); openMissions();
        if (cm.m.t === 'Die erste Million') UI.say('million');
        else if (!G.mission()) UI.say('alles');
        else setTimeout(sayMission, 500);
      }
      return;
    }
    if (v === 'reset') {
      return modal('<h2>Wirklich neu anfangen?</h2><p>Deine ganze Stadt wird gelöscht. Das lässt sich nicht rückgängig machen.</p>' +
        '<div class="row"><button class="btn ghost" data-m="no">Abbrechen</button><button class="btn danger" data-m="yes">Alles löschen</button></div>',
        { yes: function () { G.reset(); closeSheet(true); hud(); chooseAdvisor(true); } });
    }
    if (v === 'rename') return askName(false);
    if (v === 'update') {   // neue Version vom Server holen (der Service Worker meldet sich dann mit „Neue Version“)
      MC.Cloud.track('update');
      G.saveNow();
      if (!('serviceWorker' in navigator)) { location.reload(); return; }
      UI.toast('Suche nach Updates …');
      navigator.serviceWorker.getRegistration().then(function (r) {
        if (!r) { location.reload(); return; }
        return r.update().then(function () {
          UI.toast(r.installing || r.waiting ? 'Update gefunden – wird geladen …' : 'Du hast schon die neueste Version.');
        });
      }).catch(function () { UI.toast('Gerade keine Verbindung – später nochmal probieren.'); });
      return;
    }
    if (v === 'copylink' && navigator.share) {   // iPhone/iPad: Teilen-Menü
      navigator.share({ title: 'Mogul City', text: 'Meine Stadt ' + (G.S.name || '') + ' in Mogul City', url: MC.Cloud.link() }).catch(function () { });
      return;
    }
    if (v === 'copylink') {
      var link = MC.Cloud.link();
      try { navigator.clipboard.writeText(link); UI.toast('Link kopiert.'); } catch (x) { UI.toast(link); }
      return;
    }
    if (v === 'usecode') {
      return modal('<h2>Code eingeben</h2><p>Hol dir eine Stadt von einem anderen Gerät. Die Stadt auf diesem Gerät bleibt unter ihrem eigenen Code gespeichert.</p>' +
        '<input type="text" id="codeIn" maxlength="12" placeholder="z. B. K7QM2XPA" style="text-transform:uppercase">' +
        '<div class="row"><button class="btn ghost" data-m="no">Abbrechen</button><button class="btn primary" data-m="go">Laden</button></div>', {
        go: function () {
          MC.Cloud.useCode($('codeIn').value).then(function (err) {
            if (err) UI.toast(err, true); else { UI.toast('Stadt geladen.'); hud(); }
          });
        }
      });
    }
    if (v === 'ranking') { MC.Cloud.track('bestenliste'); return openRanking(); }
    if (v === 'invite') return openInvite();
    if (v === 'sendinvite') return sendInvite();
    if (v === 'buildfriend') { closeSheet(true); return V.setMode('place', { def: MC.DEF.w_freunde }); }
    if (v === 'export') return exportSave();
    if (v === 'import') return importSave();
    if (v === 'advisor') return chooseAdvisor(false);
    if (v === 'sets') return openSets();
    if (v === 'ex1' || v === 'ex10') {
      var n = v === 'ex1' ? 1 : 10;
      if (S.gold < n) return UI.toast('Nicht genug Gold.', true);
      G.exchange(n); UI.sound('gold'); UI.toast(n + ' Gold getauscht: +' + MC.money(n * G.goldRate()));
      hud(); return openBuilding(S.b[0]);
    }
    if (!b) return;
    var err = null;
    if (v === 'move') return V.setMode('place', { def: MC.DEF[b.t], moving: b });
    if (v === 'demolish') return UI.askDemolish(b);
    if (v === 'finish') { err = G.finish(b, false); if (!err) UI.sound('gold'); }
    else if (v === 'finishfree') { err = G.finish(b, false, true); if (!err) { MC.Cloud.track('gratis_fertig', null, 'gratis_fertig'); UI.sound('gold'); UI.toast('Geschenkt! Später kostet das Geld oder Gold.'); } }
    else if (v === 'finishgold') { err = G.finish(b, true); if (!err) UI.sound('gold'); }
    else if (v === 'cancel') { G.cancel(b); UI.toast('Vertrag gekündigt.'); }
    else if (v === 'rescue') { err = G.rescue(b); if (!err) UI.sound('collect'); }
    if (err) return UI.toast(err, true);
    hud(); openBuilding(b);
  });
  $('sheetClose').addEventListener('click', function () { closeSheet(); });

  $('bar').addEventListener('click', function (e) {
    var el = e.target.closest('button'); if (!el) return;
    var a = el.getAttribute('data-act');
    if (a !== 'collect') UI.sound('tap');
    if (TOOL_FEATURE[a]) G.markSeen('tool_' + a);
    if (a === 'shop') { if (V.mode !== 'idle') V.setMode('idle'); openShop(); }
    else if (a === 'missions') { if (V.mode !== 'idle') V.setMode('idle'); openMissions(); }
    else if (a === 'collect') {
      var r = G.collectAll();
      if (r.n) { UI.toast(r.n + ' × kassiert: +' + MC.money(r.cash)); UI.sound(r.n > 1 ? 'collect_all' : 'collect'); }
      else UI.toast('Gerade ist nichts fällig.');
      hud();
    } else V.setMode(V.mode === a ? 'idle' : a);
  });
  $('banner').addEventListener('click', function (e) {
    if (e.target.closest('[data-pass]')) {
      var err = G.buyPass();
      if (err) return UI.toast(err, true);
      UI.sound('gold'); UI.toast('Umzugspass aktiv: 24 Stunden kostenlos umsetzen.'); hud();
    }
  });
  $('bannerDone').addEventListener('click', function () { UI.sound('tap'); V.setMode('idle'); });
  $('placeCancel').addEventListener('click', function () { UI.sound('tap'); V.setMode(V.ghost && V.ghost.moving ? 'move' : 'idle'); });
  $('placeOk').addEventListener('click', function () {
    var q = V.ghost; if (!q) return;
    if (!V.ghostOk()) return UI.toast(G.canPlace(q.def, q.x, q.y, q.moving ? q.moving.id : 0) ? 'Hier ist kein Platz.' : 'Hier geht es nicht: Platz belegt oder noch nicht dein Land.', true);
    var wonder = q.def.kind === 'wonder';
    V.confirmGhost(); hud();
    if (wonder && !q.moving) UI.say('wunder', null, 3600000);
    var ng = V.ghost;
    if (ng && !ng.moving && (G.S.cash < ng.def.cost || G.S.gold < (ng.def.gold || 0))) { V.setMode('idle'); UI.toast('Das Geld reicht nicht für ein weiteres Stück.'); }
  });
  $('menuBtn').addEventListener('click', function () { UI.sound('tap'); openMenu(); });
  $('flatBtn').addEventListener('click', function () {
    UI.sound('tap'); V.setFlat(!V.flat);
    if (V.flat && !G.S.seen.flat) { G.markSeen('flat'); UI.toast('Flache Ansicht: Gebäude liegen als Grundfläche, nichts verdeckt Straßen. Ideal zum Umbauen.'); }
  });
  $('goal').addEventListener('click', function () { UI.sound('tap'); if (V.mode !== 'idle') V.setMode('idle'); openMissions(); });
  $('lvlBox').addEventListener('click', function () { UI.sound('tap'); openBuilding(G.S.b[0]); });

  // UI-Symbole aus Assets (ui_*, hud_*), sonst bleiben die eingebauten
  var UI_ICONS = { shop: 'ui_bauen', road: 'ui_strasse', move: 'ui_umsetzen', bulldoze: 'ui_abriss', missions: 'ui_ziele', collect: 'ui_kassieren' };
  function applyUiAssets() {
    Object.keys(UI_ICONS).forEach(function (k) {
      var u = AS.url(UI_ICONS[k]), b = document.querySelector('[data-act=' + k + '] svg');
      if (u && b) b.outerHTML = '<img class="uiic" src="' + u + '" alt="">';
    });
    [['menuBtn', 'ui_menue'], ['sheetClose', 'ui_schliessen']].forEach(function (p) {
      var u = AS.url(p[1]), s = $(p[0]).querySelector('svg');
      if (u && s) s.outerHTML = '<img class="uiic" src="' + u + '" alt="">';
    });
    [['coin', 'hud_geld'], ['gold', 'hud_gold'], ['worthic', 'hud_firmenwert']].forEach(function (p) {
      var u = AS.url(p[1]);
      if (u) { var st = document.createElement('style'); st.textContent = '.ic.' + p[0] + '{background:url("' + u + '") center/contain no-repeat!important;box-shadow:none!important;transform:none!important;border-radius:0!important}.ic.' + p[0] + '::after{display:none}'; document.head.appendChild(st); }
    });
  }

  UI.modal = modal;
  UI.modalOpen = function () { return modalOpen; };
  UI.advisorPic = advisorPic;
  UI.hud = function () { featSig = ''; hud(); };

  // ---------- Bestenliste und Besuche ----------
  var npcCache = null;
  function npcCities() {
    if (npcCache) return Promise.resolve(npcCache);
    return Promise.all(MC.ADVISORS.map(function (a) {
      return fetch('assets/staedte/' + a.id + '.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (l) { npcCache = l.filter(Boolean); return npcCache; });
  }
  function openRanking() {
    openSheet('Bestenliste', '<div class="note">Lade Städte ...</div>', { type: 'ranking' });
    Promise.all([npcCities(), MC.Cloud.listCities()]).then(function (r) {
      if (!cur || cur.type !== 'ranking') return;
      var own = G.visiting ? G.visiting.own : G.S;
      var list = [{ me: true, name: own.name || 'Meine Stadt', lvl: own.lvl, worth: G.visiting ? own.worthCache || 0 : G.netWorth(), advisor: own.advisor }];
      r[0].forEach(function (c, i) { list.push({ npc: i, name: c.name, lvl: c.lvl, worth: c.worthCache, advisor: c.advisor, label: 'Stadt von ' + G.advisorById(c.advisor).name }); });
      (r[1] || []).forEach(function (c) { list.push({ pub: c.pub_id, name: c.name || 'Unbenannt', lvl: c.lvl, worth: +c.worth || 0, advisor: c.advisor }); });
      list.sort(function (a, b) { return b.worth - a.worth; });
      var h = '<div class="ranks">';
      list.forEach(function (c, i) {
        var a = G.advisorById(c.advisor);
        h += '<button class="rank' + (c.me ? ' me' : '') + '" data-rank="' + i + '"><span class="pos">' + (i + 1) + '</span>' + advisorPic(a) +
          '<span><b>' + esc(c.name) + (c.me ? ' (du)' : '') + '</b><span>Level ' + c.lvl + (c.label ? ' · ' + esc(c.label) : '') + '</span></span>' +
          '<span class="w">' + MC.money(c.worth) + (c.me ? '' : '<small>Besuchen</small>') + '</span></button>';
      });
      h += '</div>' + (MC.Cloud.enabled ? '' : '<div class="next" style="margin-top:8px">Andere Spieler erscheinen hier, sobald der Cloud-Spielstand aktiv ist.</div>');
      openSheet('Bestenliste', h, { type: 'ranking' });
      cur.list = list;
    });
  }
  UI.openRanking = openRanking;
  function visit(c) {
    var go = function (data) {
      if (!data) return UI.toast('Diese Stadt konnte nicht geladen werden.', true);
      closeSheet(true);
      G.visit(data, { name: c.name, lvl: c.lvl, worth: c.worth });
    };
    if (c.npc !== undefined) return go(npcCache[c.npc]);
    MC.Cloud.getCity(c.pub).then(go).catch(function () { go(null); });
  }
  $('worthBox').addEventListener('click', function () { UI.sound('tap'); openRanking(); });
  $('visitBack').addEventListener('click', function () { UI.sound('tap'); G.endVisit(); });

  // „Willkommen zurück“: was ist passiert, während man weg war?
  function welcomeBack(builtWhileAway) {
    var t = G.now(), ready = 0, expired = 0, lost = 0;
    G.S.b.forEach(function (b) {
      var k = MC.DEF[b.t].kind, st = G.state(b, t);
      if ((k === 'house' || k === 'shop') && st === 'ready' && !(k === 'shop' && G.customers(b) === 0)) ready++;
      if (k === 'house' && st === 'expired') { expired++; lost += b.c.pay; }
    });
    if (!ready && !expired && !builtWhileAway) return;
    var rows = '';
    if (ready) rows += '<div><span>Fällige Einnahmen</span><b>' + ready + '</b></div>';
    if (builtWhileAway) rows += '<div><span>Fertig gebaut</span><b>' + builtWhileAway + '</b></div>';
    if (expired) rows += '<div><span>Mieter ausgezogen</span><b style="color:var(--red)">' + expired + ' (−' + MC.money(lost) + ')</b></div>';
    var canAll = G.unlocked('collectall') && ready;
    modal(art('bild_zurueck') + '<h2>Willkommen zurück!</h2><p>Du warst ' + MC.dur(G.away) + ' weg. Das ist passiert:</p><div class="wb">' + rows + '</div>' +
      '<div class="row"><button class="btn ' + (canAll ? 'goldbtn' : 'primary') + '" data-m="ok">' + (canAll ? 'Alles kassieren' : 'Los geht\'s') + '</button></div>', {
      ok: function () {
        if (canAll) { var r = G.collectAll(); if (r.n) { UI.toast(r.n + ' × kassiert: +' + MC.money(r.cash)); UI.sound('collect_all'); } }
        hud();
      }
    });
    setTimeout(function () { if (!(expired && tip('tipp_verfallen'))) UI.say('zurueck'); }, 300);
  }

  // ---------- Start ----------
  var isNew = G.load();
  var builtAway = 0, tStart = G.now();
  G.S.b.forEach(function (b) { if (b.cu && b.cu <= tStart) builtAway++; });
  G.tick();               // was während der Abwesenheit fertig wurde, ohne Meldungsflut übernehmen
  MC.Cloud.start();
  MC.Cloud.track('sitzung', G.S.lvl);
  MC.Cloud.on(function (st) {
    var e = document.querySelector('[data-cloud]'); if (e) e.textContent = st;
    if (st === 'geladen') UI.toast('Spielstand aus der Cloud geladen.');
  });
  G.on(function (type, d) {
    if (type === 'levelup') MC.Cloud.track('level', d.lvl, 'level_' + d.lvl);
    if (type === 'built' && MC.DEF[d.b.t].kind === 'shop') setTimeout(function () { tip('tipp_gewerbe'); }, 1500);
    if (type === 'build') { var bd = MC.DEF[d.b.t]; if ((bd.kind === 'house' || bd.kind === 'shop') && !G.touchesRoad(bd, d.b.x, d.b.y)) setTimeout(function () { tip('tipp_strasse'); }, 600); }
    if (type === 'found') setTimeout(function () { tip('tipp_sammeln'); }, 1200);
    if (type === 'mission' && !G.visiting) MC.Cloud.track('ziel', G.S.mission, 'ziel_' + G.S.mission);
    if (type === 'land' && !G.visiting) MC.Cloud.track('land', G.S.land.length, 'land_' + G.S.land.length);
    if (type === 'visit') {
      if (V.mode !== 'idle') V.setMode('idle');
      document.body.classList.add('visiting'); $('visitBar').hidden = false;
      $('visitText').textContent = 'Zu Besuch: ' + d.name + ' · Level ' + d.lvl + ' · ' + MC.money(d.worth);
      V.centerHome(); featSig = ''; missionWasDone = null; hud(); return;
    }
    if (type === 'reset') {
      document.body.classList.remove('visiting'); $('visitBar').hidden = true;
      missionWasDone = null;   // nach Rückkehr/Neuladen keine alten Ziel-Meldungen
      closeSheet(true); hud();
      // geladene Stadt ist schon eingerichtet: Willkommens-/Berater-Dialoge schließen
      if (modalOpen && G.S.advisor && G.S.name) { modalQueue = []; nextModal(); }
    }
    if (type === 'tutorial') { UI.hud(); setTimeout(UI.runPendingIntros, 2500); }
    if (type === 'levelup') levelUp(d);
    else if (type === 'built') { UI.toast(MC.DEF[d.b.t].name + ' ist fertig!'); UI.sound('built'); }
    else if (type === 'found') {
      var u = AS.url('samm_' + d.f.set + '_' + (d.f.i + 1));
      UI.toast('Sammelstück gefunden: ' + d.f.name + ' (' + d.f.setName + ')', false, u);
      UI.sound('found');
      if (G.setComplete(d.f.set)) setTimeout(function () { UI.toast('Sammlung „' + d.f.setName + '“ komplett! Eintauschen in der Firmenzentrale.'); }, 900);
    }
  });
  V.init($('map'));
  UI.modeChanged();
  hud();
  // Startdialoge erst, wenn die Grafiken da sind (Berater-Porträts, Bilder) – lokal nur wenige Millisekunden
  function startFlow() {
    // Im Browser auf dem Handy: nur Stadt benennen, dann Anleitung für den Home-Bildschirm
    if (MC.Install.needed()) {
      MC.Install.onBypass = function () { MC.Cloud.track('browser', null, 'browser'); startFlow(); };
      if (!G.S.name) gateName(); else gate();
      return;
    }
    // Neu installierte App: erst den Cloud-Stand holen (Name aus dem Browser kommt über den Code mit)
    if (isNew && MC.Cloud.enabled && !waited) {
      waited = true;
      var go = false, next = function () { if (!go) { go = true; startFlow(); } };
      MC.Cloud.first.then(next, next); setTimeout(next, 5000);
      return;
    }
    if (MC.Install.standalone()) MC.Cloud.track('app', null, 'app');
    setTimeout(function () { checkFriends(true); }, 4000);   // neue Freunde seit dem letzten Mal?
    if (MC.Install.vp) MC.Cloud.track('anzeige', MC.Install.vp, 'anzeige_' + MC.Install.vp);   // Fenstermaße der iPhone-App (Fehlersuche)
    if (!G.S.advisor) chooseAdvisor(true);
    else if (!G.S.name) askName(true);
    else if (G.inTut()) setTimeout(function () { MC.Tut.start(); }, 300);   // abgebrochenes Tutorial fortsetzen
    else {
      if (G.away > 10 * MC.MIN) welcomeBack(builtAway);
      daily();
    }
  }
  var started = false, waited = false;
  // Starthilfe (G.startAid): einmal, sobald jemand vor Level 6 festhängt
  setInterval(function () {
    if (!started || modalOpen || V.mode !== 'idle' || document.body.classList.contains('gated') || !G.startAidDue()) return;
    var a = G.startAidDue();
    modal(advisorPic(G.advisor(), 'big') + '<h2>Starthilfe</h2><p>Für dein nächstes Haus fehlt dir noch etwas Geld. Ich lege dir ' + MC.money(a) + ' dazu – bau damit einen Bungalow, dann läuft es von selbst.</p>' +
      '<div class="row"><button class="btn goldbtn" data-m="ok">Danke!</button></div>', {
      ok: function () { if (G.startAid()) { UI.sound('daily'); hud(); MC.Cloud.track('starthilfe', a, 'starthilfe'); } }
    });
  }, 3000);
  function gate() {
    MC.Cloud.first.then(function () { return MC.Cloud.push(); }).catch(function () { }).then(function () {
      MC.Install.pinCode(MC.Cloud.code);
    });
    MC.Install.show(G.S.name, MC.Cloud.enabled ? MC.Cloud.code : '');
    MC.Cloud.track('anleitung', null, 'anleitung');
  }
  function gateName() {
    document.body.classList.add('gated');
    MC.Cloud.track('name_frage', null, 'name_frage');
    modal(art('bild_willkommen', 'hq') + '<h2>Willkommen, Chef!</h2><p>Aus einem leeren Stück Land machst du ein Immobilien-Imperium. Zuerst: Wie soll deine Stadt heißen?</p>' +
      '<input type="text" id="nameIn" maxlength="24" placeholder="Name deiner Stadt">' +
      '<div class="row"><button class="btn primary" data-m="ok">Weiter</button></div>', {
      ok: function () { G.setName($('nameIn').value || 'Mogul City'); MC.Cloud.track('name', null, 'name'); G.saveNow(); hud(); gate(); }
    });
  }
  // Startbildschirm: Ladebalken bis alle Grafiken da sind, dann ausblenden
  AS.onProgress = function (f) { var e = $('lfill'); if (e) e.style.width = Math.max(4, Math.round(f * 100)) + '%'; };
  function hideSplash() { var sp = $('splash'); if (!sp || sp.classList.contains('weg')) return; sp.classList.add('weg'); setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600); }
  AS.onReady(hideSplash);
  setTimeout(hideSplash, 8000);   // Rückfall: nie länger als 8 Sekunden
  AS.onReady(function () { if (!started) { started = true; startFlow(); } });
  setTimeout(function () { if (!started) { started = true; startFlow(); } }, 8000);   // Rückfall, falls Assets hängen
  // kam der Dialog vor den Grafiken: Porträts nachträglich einsetzen
  AS.onReady(function () {
    var cards = document.querySelectorAll('.adv[data-id]');
    for (var i = 0; i < cards.length; i++) {
      var ph = cards[i].querySelector('.initials'), u = AS.url('berater_' + cards[i].getAttribute('data-id'));
      if (ph && u) ph.outerHTML = '<img class="big" src="' + u + '" alt="">';
    }
  });
  // Tipp vor dem Gehen: nach 10 Minuten Spielzeit einmal pro Sitzung
  // Gegen Ende einer Sitzung an lange Verträge erinnern: erste Sitzung nach 12 Min. Spielzeit (ausführlich), später nach 20 Min. (kurz),
  // nur wenn gerade kurze Verträge laufen – genau dann würde die Miete in einer Pause verfallen
  var playMs = 0, longSaid = false;
  setInterval(function () {
    if (document.hidden || longSaid || G.inTut() || G.visiting || G.S.lvl < 2) return;
    playMs += 5000;
    var first = (G.S.sessions || 1) <= 1, need = (first ? 12 : 20) * MC.MIN;
    if (playMs < need || modalOpen || V.mode !== 'idle') return;
    var shortRunning = G.S.b.some(function (b) { return b.c && MC.DEF[b.t].kind === 'house' && (b.c.end - b.c.s) <= 30 * MC.MIN && G.state(b) === 'running'; });
    if (!shortRunning) return;
    longSaid = true;
    if (!tip('tipp_lang')) UI.say('langer_vertrag');
  }, 5000);

  AS.load().then(function () {
    applyUiAssets();
    if (cur && cur.type === 'shop') openShop();
  });
  // Audio darf auf iOS erst nach der ersten Berührung starten
  function unlock() {
    document.removeEventListener('pointerdown', unlock, true);
    if (!AS.ctx()) return;
    AS.setIgnoreMute(G.S.ignoreMute !== false);
    AS.onReady(function () { AS.preloadSounds(); if (G.S.music) AS.music(true); });
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('pointerdown', function () { if (!document.hidden && (G.S.sound || G.S.music)) AS.ctx(); }, { passive: true });

  setInterval(function () {
    G.tick(); hud();
    if (!modalOpen && G.S.name && G.S.advisor) daily();
    if (cur && cur.type === 'b') {
      var b = G.get(cur.id);
      if (!b) closeSheet(true);
      else if (buildingSig(b) !== cur.sig) openBuilding(b);
      else timers();
    }
  }, 500);
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); G.saveNow(); AS.music(false); }
    else {
      if (hiddenAt && Date.now() - hiddenAt > 30 * MC.MIN) MC.Cloud.track('sitzung', G.S.lvl);   // App kam nach Pause zurück
      G.tick(); hud(); if (G.S.music) AS.music(true);
      checkFriends();
    }
  });
  window.addEventListener('pagehide', G.saveNow);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(function () { });
    // neue Version aktiv: anbieten, neu zu laden (Spielstand ist gespeichert)
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      G.saveNow();
      modal('<h2>Neue Version</h2><p>Mogul City wurde aktualisiert. Dein Spielstand ist gesichert.</p>' +
        '<div class="row"><button class="btn ghost" data-m="no">Später</button><button class="btn primary" data-m="go">Jetzt neu laden</button></div>',
        { go: function () { location.reload(); } });
    });
  }
})();
