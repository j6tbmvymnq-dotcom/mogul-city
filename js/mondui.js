/* Mogul City – Mondkolonie (Oberfläche). Eigener Vollbild-Bereich #moon: Rohstoffe, Panorama mit den Betrieben,
   Frachtrakete, Liste zum Antippen/Kaufen/Manager einstellen. Grafiken: assets mond_* (Fable), sonst Platzhalter. */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G, UI = MC.UI, A = MC.Art, M = MC.MOON;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(n) { n = Math.floor(n); return n >= 1e6 ? MC.short(n) : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function asset(id) { return MC.Assets && MC.Assets.url(id); }

  // ---------- Platzhalter-Grafiken (bis Fable liefert) ----------
  var PH = {
    bagger: '<rect x="14" y="40" width="40" height="16" rx="3" fill="#f2b632"/><circle cx="22" cy="58" r="6" fill="#3a3f4a"/><circle cx="46" cy="58" r="6" fill="#3a3f4a"/><path d="M50 42 L66 24 L74 30 L60 46Z" fill="#e0a020"/><path d="M68 26 l10 6 -4 10 -10 -4z" fill="#8a8f99"/>',
    eis: '<rect x="30" y="20" width="8" height="40" fill="#8a8f99"/><path d="M22 60 h24 l-6 -10 h-12z" fill="#5a626e"/><circle cx="34" cy="16" r="8" fill="#9ad8f2"/><path d="M34 60 v6" stroke="#9ad8f2" stroke-width="3"/>',
    kuppel: '<path d="M10 60 a30 30 0 0 1 60 0z" fill="#bfe6f7" stroke="#7fb4cc" stroke-width="2"/><path d="M40 30 v30 M22 38 q18 10 36 0" stroke="#7fb4cc" fill="none"/><rect x="34" y="50" width="12" height="10" fill="#ffd96a"/>',
    mine: '<path d="M8 62 l20 -30 h24 l20 30z" fill="#7d8590"/><rect x="32" y="16" width="16" height="22" fill="#c9ced6"/><circle cx="40" cy="14" r="6" fill="#b48cff"/><rect x="36" y="44" width="8" height="18" fill="#2d3442"/>',
    werk: '<rect x="10" y="30" width="56" height="30" fill="#9aa3ad"/><path d="M10 30 l14 -10 v10 l14 -10 v10 l14 -10 v10" fill="#7d8590"/><rect x="54" y="10" width="8" height="22" fill="#5a626e"/><rect x="18" y="42" width="10" height="8" fill="#ffd96a"/><rect x="36" y="42" width="10" height="8" fill="#ffd96a"/>',
    raff: '<rect x="12" y="26" width="14" height="34" rx="7" fill="#c9ced6"/><rect x="30" y="18" width="14" height="42" rx="7" fill="#b9c0c9"/><rect x="48" y="30" width="14" height="30" rx="7" fill="#c9ced6"/><path d="M26 40 h4 M44 44 h4" stroke="#b48cff" stroke-width="4"/>',
    hafen: '<rect x="8" y="54" width="64" height="8" fill="#5a626e"/><path d="M40 10 c8 10 8 30 6 40 h-12 c-2 -10 -2 -30 6 -40z" fill="#f4f4f4" stroke="#c9ced6"/><circle cx="40" cy="28" r="4" fill="#2b7de9"/><path d="M34 50 l-6 6 h8z M46 50 l6 6 h-8z" fill="#e0533d"/>',
    rakete: '<path d="M40 4 c10 10 12 34 8 50 h-16 c-4 -16 -2 -40 8 -50z" fill="#f4f4f4" stroke="#c9ced6"/><circle cx="40" cy="26" r="5" fill="#2b7de9"/><path d="M32 46 l-8 12 h10z M48 46 l8 12 h-10z" fill="#e0533d"/><path d="M36 56 q4 12 8 0z" fill="#ffb347"/>',
    mega: '<path d="M4 62 a36 34 0 0 1 72 0z" fill="#d6f0fa" stroke="#7fb4cc" stroke-width="2"/><rect x="18" y="40" width="8" height="22" fill="#9aa3ad"/><rect x="30" y="32" width="10" height="30" fill="#b9c0c9"/><rect x="44" y="38" width="8" height="24" fill="#9aa3ad"/><rect x="56" y="46" width="6" height="16" fill="#b9c0c9"/>'
  };
  function pic(id, cls) {
    var u = asset('mond_' + id);
    return u ? '<img class="' + cls + '" src="' + u + '" alt="">' : '<svg class="' + cls + '" viewBox="0 0 80 70">' + (PH[id] || '') + '</svg>';
  }
  var RICON = {
    bau: '<svg viewBox="0 0 24 24"><path d="M4 18l4-10h8l4 10z" fill="#b9a68a" stroke="#8a7a62"/><path d="M8 13h8" stroke="#8a7a62"/></svg>',
    fuel: '<svg viewBox="0 0 24 24"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#4fc3f7" stroke="#2a8fbd"/></svg>',
    he3: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#b48cff" stroke="#7d5ad1"/><circle cx="12" cy="12" r="2.6" fill="#efe4ff"/></svg>',
    kol: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" fill="#e8edf6"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6z" fill="#e8edf6"/></svg>'
  };
  function ric(r) { var u = asset('mond_' + r); return u ? '<img class="ric" src="' + u + '" alt="">' : '<i class="ric">' + RICON[r] + '</i>'; }
  function rtext(r) { return Object.keys(r).map(function (k) { return '+' + num(r[k]) + ' ' + (k === 'gold' ? 'Gold' : k === 'cash' ? '$' : M.RES[k]); }).join(', '); }
  function costHtml(c) { return Object.keys(c).map(function (r) { return '<span class="mc ' + (G.moon()[r] >= c[r] ? '' : 'no') + '">' + ric(r) + num(c[r]) + '</span>'; }).join(''); }

  // ---------- Bereich ----------
  var open = false, qty = 1, raf = 0, sig = '';
  function shell() {
    var el = $('moon');
    if (!el) { el = document.createElement('div'); el.id = 'moon'; el.hidden = true; document.body.appendChild(el); }
    el.innerHTML = '<div class="mtop"><button class="mback" data-mo="earth"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Erde</button>' +
      '<div class="mres" id="mres"></div></div>' +
      '<div class="mpan" id="mpan"></div>' +
      '<div class="mbody" id="mbody"></div>';
    el.onclick = click;
    el.addEventListener('pointerdown', function () { touching = true; });
    ['pointerup', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { setTimeout(function () { touching = false; }, 150); }); });
    return el;
  }
  function render() {
    var m = G.moon(), h = '';
    // Panorama: jeder Betrieb an seinem Platz, ab dem ersten Stück sichtbar
    $('mpan').innerHTML = (asset('mond_panorama') ? '<img class="mbg" src="' + asset('mond_panorama') + '" alt="">' : '<div class="mbg ph"><i class="earth"></i></div>') +
      M.B.map(function (b, i) { var n = G.moonCount(b.id); return '<div class="mslot s' + i + (n ? '' : ' off') + '">' + pic(b.id, 'mpic') + (n ? '<b>' + n + '</b>' : '') + '</div>'; }).join('');
    // Mond-Ziel
    var gl = G.moonGoal();
    if (gl) h += '<div class="mcard goal' + (gl.done ? ' done' : '') + '"><div class="mtx"><b>Mond-Ziel: ' + esc(gl.g.t) + '</b><span>' + esc(gl.g.d) + '</span><div class="mbar"><i style="width:' + Math.round(100 * gl.have / gl.need) + '%"></i></div></div>' +
      (gl.done ? '<button class="btn goldbtn" data-mo="goal">Abholen</button>' : '<span class="mprog">' + num(gl.have) + ' / ' + num(gl.need) + '</span>') + '</div>';
    // Frachtrakete
    var p = G.moonRocketPlan(), r = m.rocket;
    h += '<div class="mcard rocket">' + pic('rakete', 'mrpic') + '<div class="mtx"><b>Frachtrakete zur Erde</b>' +
      (r ? '<span>Unterwegs mit ' + num(r.cargo) + ' Helium-3 · Ankunft in <em data-arrive="' + r.arrive + '"></em></span><div class="mbar"><i data-rprog="' + r.start + ',' + r.arrive + '"></i></div>'
        : '<span>Ladung ' + num(p.cargo) + ' / ' + num(G.moonRocketCap()) + ' Helium-3 · Treibstoff ' + num(p.fuel) + ' · Flug ' + MC.durShort(p.dur) + '</span>') + '</div>' +
      (r ? '' : '<button class="btn goldbtn two" data-mo="launch"' + (p.cargo < 1 || m.fuel < p.fuel ? ' disabled' : '') + '><small>Starten</small><span>+' + MC.money(p.cash) + '</span></button>') + '</div>';
    var bon = G.moonBonus();
    h += '<div class="mnote">' + ric('kol') + num(G.moonHomes()) + ' Kolonisten · ' + num(Math.max(0, G.moonFreeCrew())) + ' frei für Arbeit · <b>+' + bon + ' % Miete auf der Erde</b>' + (bon < M.BONUS.max ? ' (nächstes Prozent bei ' + num((bon + 1) * M.BONUS.per) + ')' : '') + '</div>';
    // Mond-Sammlungen
    h += '<div class="mcard colls"><div class="mtx"><b>Mond-Sammlungen</b><span>Funde gibt es beim Fertigstellen von Durchgängen.</span>' +
      M.COLL.map(function (c) {
        var a = (m.coll && m.coll[c.id]) || [0, 0, 0, 0, 0], full = G.moonSetComplete(c.id);
        return '<div class="mset"><i>' + esc(c.name) + '</i>' + c.items.map(function (it, k) { var u = asset('mond_samm_' + c.id + '_' + (k + 1)); return '<span class="mit' + (a[k] ? ' have' : '') + '" title="' + esc(it) + '">' + (u ? '<img src="' + u + '" alt="">' : esc(it.charAt(0))) + (a[k] > 1 ? '<em>' + a[k] + '</em>' : '') + '</span>'; }).join('') +
          (full ? '<button class="btn goldbtn" data-ms="' + c.id + '">Eintauschen</button>' : '') + '</div>';
      }).join('') + '</div></div>';
    h += '<div class="mqty">' + [1, 10, 'max'].map(function (q) { return '<button data-mq="' + q + '"' + (qty === q ? ' class="on"' : '') + '>' + (q === 'max' ? 'Max' : '×' + q) + '</button>'; }).join('') + '</div>';
    M.B.forEach(function (b) {
      var n = G.moonCount(b.id), s = m.b[b.id] || {}, k = qty === 'max' ? Math.max(1, G.moonMaxBuy(b.id)) : qty, c = G.moonCost(b.id, k);
      var crewOk = !b.crew || G.moonFreeCrew() >= b.crew * k, ok = crewOk && Object.keys(c).every(function (r) { return m[r] >= c[r]; });
      var mile = G.moonNextMile(b.id);
      var prod = b.out ? '+' + num(G.moonYield(b.id) || b.amt) + ' ' + M.RES[b.out] + ' je ' + MC.durShort(G.moonCycle(b.id)) : b.home ? '+' + b.home + ' Wohnplätze je Stück' : '+' + b.ship + ' Ladung, −1 Min. Flugzeit je Stück';
      h += '<div class="mcard' + (b.out && n ? ' tap' : '') + '" data-mt="' + b.id + '">' + pic(b.id, 'mlpic') +
        '<div class="mtx"><b>' + esc(b.name) + (n ? ' <em>' + n + '</em>' : '') + '</b><span>' + prod + (b.crew ? ' · ' + b.crew + ' Arbeiter' : '') + '</span>' +
        (b.out && n ? '<div class="mbar"><i data-mp="' + b.id + '"></i></div><span class="hint">' + (s.mgr ? 'Manager arbeitet' : 'Antippen zum Starten') + (mile ? ' · ab ' + mile[0] + ': ' + (mile[1] === 'x2' ? 'doppelter Ertrag' : 'doppelt so schnell') : '') + '</span>' : '<span class="hint">' + esc(b.desc) + '</span>') +
        '</div><div class="macts"><button class="btn primary mbuy" data-mb="' + b.id + '"' + (ok ? '' : ' disabled') + '><small>Kaufen ×' + k + '</small>' + costHtml(c) + '</button>' +
        (b.mgr && n && !s.mgr ? '<button class="btn ghost mmgr" data-mm="' + b.id + '"><small>Manager</small>' + MC.money(b.mgr) + '</button>' : '') +
        (!crewOk ? '<span class="mwarn">Zu wenig Arbeiter</span>' : '') + '</div></div>';
    });
    $('mbody').innerHTML = h;
    $('mres').innerHTML = ''; res(); sig = stateSig();
  }
  // Rohstoffleiste einmal aufbauen, danach nur die Zahlen ändern (Bilder nicht ständig neu laden)
  function res() {
    var m = G.moon(), el = $('mres');
    if (!el.firstChild) el.innerHTML = ['bau', 'fuel', 'he3', 'kol'].map(function (r) { return '<span>' + ric(r) + '<b data-r="' + r + '"></b></span>'; }).join('');
    [].forEach.call(el.querySelectorAll('[data-r]'), function (b) { var r = b.getAttribute('data-r'), v = num(r === 'kol' ? G.moonHomes() : m[r]); if (b.textContent !== v) b.textContent = v; });
  }
  // Neu aufbauen nur, wenn sich etwas Sichtbares an Knöpfen/Zuständen ändert – nicht bei jedem Rohstoff-Zuwachs
  function stateSig() {
    var m = G.moon(), gl = G.moonGoal(), p = G.moonRocketPlan();
    var afford = M.B.map(function (b) { var k = qty === 'max' ? Math.max(1, G.moonMaxBuy(b.id)) : qty, c = G.moonCost(b.id, k);
      return k + (Object.keys(c).every(function (r) { return m[r] >= c[r]; }) ? 'y' : 'n') + (!b.crew || G.moonFreeCrew() >= b.crew * k ? 'y' : 'n'); }).join(',');
    return JSON.stringify(m.b) + '|' + !!m.rocket + '|' + (gl ? gl.idx + (gl.done ? 'd' : '') + gl.have : '-') + '|' + JSON.stringify(m.coll || {}) + '|' + qty + '|' + afford + '|' + (p.cargo > 0 && m.fuel >= p.fuel) + '|' + p.cargo;
  }
  var touching = false;
  function loop() {
    if (!open) return;
    var got = G.moonTick();
    if (got && got.cash) { UI.toast('Frachtrakete gelandet: +' + MC.money(got.cash)); UI.sound('daily'); }
    if (got && got.found) { UI.toast('Mond-Fund: ' + got.found.name + ' (' + got.found.setName + ')'); UI.sound('found'); UI.tip('mond_sammeln', 800); }
    var t = G.now();
    [].forEach.call(document.querySelectorAll('#moon [data-mp]'), function (e) { e.style.width = Math.round(G.moonProgress(e.getAttribute('data-mp')) * 100) + '%'; });
    [].forEach.call(document.querySelectorAll('#moon [data-rprog]'), function (e) { var a = e.getAttribute('data-rprog').split(','); e.style.width = Math.min(100, Math.round(100 * (t - a[0]) / (a[1] - a[0]))) + '%'; });
    [].forEach.call(document.querySelectorAll('#moon [data-arrive]'), function (e) { e.textContent = MC.dur(Math.max(0, +e.getAttribute('data-arrive') - t)); });
    var s = stateSig(); if (s !== sig && !touching) render(); else res();
    raf = requestAnimationFrame(loop);
  }
  function click(e) {
    var el = e.target.closest('[data-mo],[data-mq],[data-mb],[data-mm],[data-mt],[data-ms]'); if (!el) return;
    var sv = el.getAttribute('data-ms');
    if (sv) { var sr = G.moonClaimSet(sv); if (sr) { UI.sound('set'); UI.toast('Sammlung eingetauscht: ' + rtext(sr)); } return render(); }
    var v;
    if ((v = el.getAttribute('data-mo'))) {
      if (v === 'earth') return MC.Moon.close();
      if (v === 'goal') { var gr = G.moonClaimGoal(); if (gr) { UI.sound('mission'); UI.toast('Mond-Ziel geschafft: ' + rtext(gr)); } return render(); }
      if (v === 'launch') { var err = G.moonLaunch(); if (err) UI.toast(err, true); else { UI.sound('mond_start'); UI.toast('Frachtrakete gestartet!'); } return render(); }
    }
    if ((v = el.getAttribute('data-mq'))) { qty = v === 'max' ? 'max' : +v; return render(); }
    if ((v = el.getAttribute('data-mb'))) {
      e.stopPropagation();
      var k = qty === 'max' ? Math.max(1, G.moonMaxBuy(v)) : qty, er = G.moonBuy(v, k);
      if (er) { UI.toast(er, true); if (/Arbeiter/.test(er)) UI.tip('mond_kuppel'); } else { UI.sound('mond_bau'); if (v === 'kuppel' || v === 'mega') UI.tip('mond_bonus', 1200); }
      return render();
    }
    if ((v = el.getAttribute('data-mm'))) {
      e.stopPropagation();
      var em = G.moonHire(v); if (em) UI.toast(em, true); else { UI.sound('gold'); UI.toast('Manager eingestellt – ' + M.byId[v].name + ' läuft jetzt von selbst.'); MC.UI.hud && 0; }
      return render();
    }
    if ((v = el.getAttribute('data-mt'))) { if (G.moonTap(v)) { UI.sound('mond_tap'); render(); } }
  }

  MC.Moon = {
    open: function () {
      if (!G.moonUnlocked() || G.visiting) return;
      var first = !G.S.moon;
      G.moon(); G.moonTick(); shell(); render();
      $('moon').hidden = false; document.body.classList.add('onmoon'); open = true;
      if (MC.Assets.setMusicMode) MC.Assets.setMusicMode('mond');
      loop();
      if (first) UI.tip('mond_start', 600);
      MC.Cloud.track('mond', null, 'mond');
    },
    close: function () {
      open = false; cancelAnimationFrame(raf);
      var el = $('moon'); if (el) el.hidden = true; document.body.classList.remove('onmoon');
      if (MC.Assets.setMusicMode) MC.Assets.setMusicMode('erde');
      UI.hud && UI.hud();
    },
    isOpen: function () { return open; }
  };

  // Hintergrund: Rakete landet auch, wenn man auf der Erde ist; Tipps zur richtigen Zeit
  setInterval(function () {
    if (!G.S.moon || G.visiting || open) return;
    var got = G.moonTick();
    if (got && got.cash) { UI.toast('Frachtrakete vom Mond gelandet: +' + MC.money(got.cash)); UI.sound('daily'); }
  }, 5000);
  setInterval(function () {
    if (!open || !G.S.moon) return;
    var m = G.S.moon;
    if (m.he3 >= 10 && !m.rocket) UI.tip('mond_rakete');
    if (m.bau >= 150 && G.moonCount('bagger') >= 5) UI.tip('mond_manager');
  }, 3000);
})();
