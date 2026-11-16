/* Mogul City – geführter Einstieg (≈ 3 Minuten). Plan: docs/TUTORIAL-PLAN.md
   Jeder Schritt: Sprecherzeile, Ziel (Element, Kartenfelder oder Gebäudesymbol), Bedingung zum Weitergehen.
   Fortschritt steht in G.S.tut (Zahl = aktueller Schritt, 'done' = fertig). */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G, V = MC.V, UI = MC.UI, AS = MC.Assets;
  var T = MC.Tut = {};
  var step = -1, running = false, raf = 0, lastTarget = null, okClicked = false, box, finger;

  function $(s) { return document.querySelector(s); }
  function hq() { return G.S.b[0]; }
  function P(d) { return [hq().x + d[0], hq().y + d[1]]; }
  function house() { for (var i = 0; i < G.S.b.length; i++) if (G.S.b[i].t === 'bungalow') return G.S.b[i]; return null; }
  function sheetOpen() { return !$('#sheet').hidden; }
  function tabOn(k) { var t = $('[data-tab=' + k + ']'); return t && t.classList.contains('on'); }
  // Platzier-Geist einmalig auf das Zielfeld setzen
  function aimGhost(id, d) {
    var q = V.ghost;
    if (V.mode === 'place' && q && q.def.id === id && !q._tut) { var p = P(d); q.x = p[0]; q.y = p[1]; q._tut = true; UI.ghostMoved(); }
  }
  // Laden öffnen -> Reiter -> Gebäude -> platzieren
  function buildPath(id, kind, d) {
    if (V.mode === 'place' && V.ghost && V.ghost.def.id === id) { aimGhost(id, d); return { el: '#placeOk' }; }
    if (V.mode !== 'idle') return { el: '#bannerDone' };
    if (sheetOpen() && $('#sheetTitle').textContent === 'Bauen') {
      if (!tabOn(kind)) return { el: '[data-tab=' + kind + ']' };
      return { el: '[data-build=' + id + ']' };
    }
    return { el: UI.inBuildMode() ? '[data-act=shop]' : '[data-act=build]' };
  }

  var STEPS = [
    { line: 'tut_1',
      target: function () {
        V.tutTiles = MC.TUT.road.map(P);
        return V.mode === 'road' ? { tiles: V.tutTiles } : (V.mode === 'idle' ? { el: UI.inBuildMode() ? '[data-act=road]' : '[data-act=build]' } : { el: '#bannerDone' });
      },
      done: function () { return MC.TUT.road.every(function (d) { var p = P(d); return G.isRoad(p[0], p[1]); }); },
      leave: function () { V.tutTiles = null; if (V.mode === 'road') V.setMode('idle'); } },
    { line: 'tut_2',
      target: function () { var p = P(MC.TUT.house); V.tutTiles = [[p[0], p[1], 2]]; return buildPath('bungalow', 'house', MC.TUT.house); },
      done: function () { return V.mode === 'place' && V.ghost && V.ghost.def.id === 'bungalow' || G.count('bungalow') > 0; } },
    { line: 'tut_3',
      target: function () { var p = P(MC.TUT.house); V.tutTiles = [[p[0], p[1], 2]]; return buildPath('bungalow', 'house', MC.TUT.house); },
      done: function () { return G.count('bungalow') > 0; },
      leave: function () { V.tutTiles = null; if (V.mode === 'place') V.setMode('idle'); } },
    { line: 'tut_4',
      target: function () {
        var b = house(); if (!b) return null;
        if (G.state(b) === 'build') return { wait: true };
        if (sheetOpen() && $('[data-sign=c3m]')) return { el: '[data-sign=c3m]' };
        return { icon: b };
      },
      done: function () { return G.S.st.signed > 0; } },
    { line: 'tut_5',
      enter: function () {
        var c = MC.DEF.blumenbeet.cost;
        if (!G.S.tutGift) { G.S.cash += c; G.S.tutGift = 1; G.save(); UI.toast('Geschenk: +' + MC.money(c) + ' für ein Blumenbeet'); UI.hud(); }
      },
      target: function () { var p = P(MC.TUT.deco); V.tutTiles = [[p[0], p[1], 1]]; return buildPath('blumenbeet', 'deco', MC.TUT.deco); },
      done: function () { return G.count('blumenbeet') > 0; },
      leave: function () { V.tutTiles = null; if (V.mode === 'place') V.setMode('idle'); UI.closeSheet(true); } },
    { line: 'tut_6',
      target: function () {
        var b = house(); if (!b) return null;
        if (sheetOpen()) return { el: '#sheetClose' };
        return G.state(b) === 'ready' ? { icon: b } : { wait: true, icon: b };
      },
      done: function () { return G.S.st.collected > 0; } },
    { line: 'tut_7', info: true,
      target: function () { return null; },
      done: function () { return okClicked; } },
    { line: 'tut_8',
      target: function () { return sheetOpen() && $('#sheetTitle').textContent !== 'Ziele' ? { el: '#sheetClose' } : { el: UI.inBuildMode() ? '[data-act=done]' : '[data-act=missions]' }; },
      done: function () { return sheetOpen() && $('#sheetTitle').textContent === 'Ziele'; } }
  ];

  function render() {
    var s = STEPS[step], a = G.advisor();
    box.innerHTML = UI.advisorPic(a) + '<div class="tx"><b>' + a.name + '</b>' + MC.VOICE[s.line] +
      '<div class="tb"><span class="stepn">Schritt ' + (step + 1) + ' von ' + STEPS.length + '</span>' +
      '<button class="skip" data-tut="skip">Überspringen</button>' + (s.info ? '<button class="go" data-tut="ok">Verstanden</button>' : '') + '</div></div>';
    box.hidden = false;
    if (G.S.voice) AS.say(AS.voice(a.id, s.line));
  }
  function enter(i) {
    if (step >= 0 && STEPS[step] && STEPS[step].leave) STEPS[step].leave();
    clearTarget();
    step = i; okClicked = false;
    if (step >= STEPS.length) return finish(false);
    if (!G.inTut()) return stop();
    G.S.tut = step; G.save();
    MC.Cloud.track('tut_' + (step + 1), null, 'tut_' + (step + 1));
    if (STEPS[step].enter) STEPS[step].enter();
    render();
  }
  function clearTarget() {
    var o = document.querySelectorAll('.tut-on');
    for (var i = 0; i < o.length; i++) o[i].classList.remove('tut-on');
    lastTarget = null;
  }
  function placeFinger(x, y) { finger.style.left = x + 'px'; finger.style.top = y + 'px'; finger.hidden = false; }

  function loop() {
    if (!running) return;
    // Tutorial wurde anderswo beendet (z. B. fertige Stadt aus der Cloud geladen): still aufräumen
    if (!G.inTut()) { stop(); return; }
    var now = Date.now();
    var s = STEPS[step];
    if (!s) return;
    if (UI.modalOpen()) { finger.hidden = true; box.style.opacity = '.4'; return; }
    box.style.opacity = '';
    if (s.done()) { enter(step + 1); return; }
    var t = s.target();
    var el = t && t.el ? $(t.el) : null;
    if (el && el.offsetParent === null) el = null;
    // Markierung nur bei Zielwechsel umsetzen, sonst startet die Puls-Animation ständig neu
    if (el !== lastTarget) { clearTarget(); if (el) { el.classList.add('tut-on'); lastTarget = el; } }
    finger.hidden = true;
    if (!t || t.wait && !t.icon) return;
    if (t.el) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      placeFinger(r.left + r.width / 2, r.top + r.height / 2);
    } else if (t.icon) {
      var p = V.iconPos(t.icon);
      if (p && !t.wait) placeFinger(p.x, p.y);
    } else if (t.tiles) {
      // Finger fährt die Strecke entlang (offene Felder)
      var open = t.tiles.filter(function (q) { return !G.isRoad(q[0], q[1]); });
      if (!open.length) return;
      var k = Math.floor(now / 450) % (open.length + 1), q = open[Math.min(k, open.length - 1)];
      var sp = V.toScreen(q[0] + 0.5, q[1] + 0.5);
      placeFinger(sp.x, sp.y);
    }
  }

  function stop() {
    running = false; clearInterval(raf);
    if (step >= 0 && STEPS[step] && STEPS[step].leave) STEPS[step].leave();
    clearTarget(); V.tutTiles = null;
    box.hidden = true; finger.hidden = true;
    document.body.classList.remove('tut');
  }
  function finish(skipped) {
    stop();
    document.body.classList.remove('buildmode'); if (V.flat) V.setFlat(false);   // nach dem Tutorial wieder die normale Leiste
    MC.Cloud.track(skipped ? 'tut_abbruch' : 'tut_fertig', null, 'tut_ende');
    G.finishTutorial(skipped);
    UI.hud();
    // offenes Ziele-Fenster zeigt sonst noch die vom Tutorial erledigten Ziele
    if (!$('#sheet').hidden && $('#sheetTitle').textContent === 'Ziele') UI.openMissions();
    if (!skipped) { UI.sound('mission'); UI.toast('Tutorial geschafft: +' + MC.money(MC.TUT.reward) + ' und 1 Gold'); }
  }

  T.start = function () {
    if (!G.inTut() || running) return;
    box = $('#tutBox'); finger = $('#finger');
    var fi = AS.url('ui_finger');
    finger.innerHTML = fi ? '<img src="' + fi + '" alt="">' :
      '<svg viewBox="0 0 64 64"><path d="M22 6c3 0 5 2 5 5v18l2-1c3-1 6 0 7 3l1 1c3-1 6 0 7 3 3-1 6 1 6 4v12c0 7-5 12-12 12H33c-4 0-7-2-9-5L12 41c-2-3-1-6 2-7 2-1 4 0 6 1l-3-3V11c0-3 2-5 5-5z" fill="#fff" stroke="#16233b" stroke-width="3" stroke-linejoin="round"/></svg>';
    running = true;
    document.body.classList.add('tut');
    var adv = $('#advisor'); if (adv) adv.hidden = true;   // Begrüßungsblase weg, jetzt führt das Tutorial
    V.centerHome();
    enter(typeof G.S.tut === 'number' ? G.S.tut : 0);
    raf = setInterval(loop, 120);   // fester Takt (läuft auch, wenn das Fenster kurz im Hintergrund ist)
  };
  T.active = function () { return running; };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tut]'); if (!b) return;
    if (b.getAttribute('data-tut') === 'ok') { okClicked = true; UI.sound('tap'); }
    if (b.getAttribute('data-tut') === 'skip') {
      UI.modal('<h2>Tutorial überspringen?</h2><p>Du kannst sofort frei spielen. Die ersten Ziele erklären dir den Rest.</p>' +
        '<div class="row"><button class="btn ghost" data-m="no">Weiter lernen</button><button class="btn primary" data-m="yes">Überspringen</button></div>',
        { yes: function () { finish(true); } });
    }
  });
})();
