/* Mogul City – Kartenansicht: Kamera, Zeichnen, Touch-Eingabe, Bau-Modi */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G, A = MC.Art;
  var HW = 32, HH = 16, N = MC.MAP, SEC = MC.SECTOR;

  var V = MC.V = {};
  var cv, g, W = 0, H = 0, dpr = 1;
  var cam = { x: 0, y: 0, z: 1 };
  var items = [], itemsDirty = true, statT = 0;
  var floats = [];
  var treeSp = null;

  // Modus: idle | place | road | bulldoze | move
  V.mode = 'idle';
  V.ghost = null;       // {def, x, y, moving: Gebäude|null}
  V.highlight = null;   // Gebäude, dessen Reichweite gezeigt wird
  // Flache Ansicht (Bearbeiten): Gebäude liegen als Grundfläche auf dem Boden, nichts verdeckt Straßen und Felder
  V.flat = false;
  V.setFlat = function (on) { V.flat = !!on; itemsDirty = true; V.kick(); if (MC.UI.flatChanged) MC.UI.flatChanged(); };
  var FLAT_COL = { house: ['#f3d27a', '#b8892a'], shop: ['#8cc2f2', '#2f74b8'], deco: ['#8fd68a', '#3d8c3a'], wonder: ['#d9b0f2', '#8a4fb0'], hq: ['#6f9df0', '#2b5fc0'] };

  function wx(x, y) { return (x - y) * HW; }
  function wy(x, y) { return (x + y) * HH; }
  function toTile(sx, sy) {
    var px = (sx - W / 2) / cam.z + cam.x, py = (sy - H / 2) / cam.z + cam.y;
    return { fx: (px / HW + py / HH) / 2, fy: (py / HH - px / HW) / 2, px: px, py: py };
  }

  V.init = function (canvas) {
    cv = canvas; g = cv.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    resize();
    bindInput();
    G.on(function (type, d) {
      V.kick();
      if (type === 'build' || type === 'move' || type === 'demolish' || type === 'land' || type === 'reset' || type === 'built' || type === 'visit' || type === 'upgrade') itemsDirty = true;
      statT = 0;
      if (type === 'reset') V.centerHome();
      if (type === 'collect' && d.cash > 0) {
        var s = MC.DEF[d.b.t].size, cx = d.b.x + s / 2, cy = d.b.y + s / 2;
        V.float(cx, cy, '+' + MC.money(d.cash), '#ffe680');
        burst(cx, cy, Math.min(10, 3 + Math.round(Math.log(d.cash) / 2)));
      }
      if (type === 'found') {
        var z = MC.DEF[d.b.t].size;
        setTimeout(function () { V.float(d.b.x + z / 2, d.b.y + z / 2, d.f.name + '!', '#e6c3ff'); }, 450);
      }
      if (type === 'move' && d.fee) { var m = MC.DEF[d.b.t].size; V.float(d.b.x + m / 2, d.b.y + m / 2, '−' + MC.money(d.fee), '#ffd0c8'); }
    });
    MC.Assets.onReady(function () { A.reset(); treeSp = null; pats = {}; itemsDirty = true; });
    V.centerHome();
    requestAnimationFrame(frame);
  };
  V.centerHome = function () {
    var hq = G.S.b[0];
    cam.x = wx(hq.x + 1, hq.y + 1); cam.y = wy(hq.x + 1, hq.y + 1);
    cam.z = Math.min(W, H) < 500 ? 0.62 : 1.0;   // Telefon: Startgrundstück passt fast ganz auf den Schirm
  };
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);   // 2× reicht für scharfe Grafik, spart auf 3×-iPhones viel Rechenzeit
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function clampCam() {
    var M = 7, bx = (N + 2 * M) * HW, by0 = -2 * M * HH, by1 = (2 * N + 2 * M) * HH;   // Karte + Rand als Rechteck
    var zMin = Math.max(0.3, Math.min(W / (2 * bx), H / (by1 - by0)) * 1.15);
    cam.z = Math.max(zMin, Math.min(2.6, cam.z));
    var hw = W / 2 / cam.z, hh = H / 2 / cam.z;
    cam.x = hw >= bx ? 0 : Math.max(-bx + hw, Math.min(bx - hw, cam.x));
    cam.y = 2 * hh >= by1 - by0 ? (by0 + by1) / 2 : Math.max(by0 + hh, Math.min(by1 - hh, cam.y));
  }

  // ---------- Modi ----------
  V.setMode = function (mode, arg) {
    V.kick();
    V.mode = mode; V.ghost = null; V.highlight = null;
    if (mode === 'place') {
      var c = toTile(W / 2, H * 0.45), def = arg.def;
      V.ghost = { def: def, x: 0, y: 0, moving: arg.moving || null };
      if (arg.moving) { V.ghost.x = arg.moving.x; V.ghost.y = arg.moving.y; }
      else setGhost(c.fx, c.fy);
    }
    MC.UI.modeChanged();
  };
  // fx/fy = Kartenpunkt unter dem Finger (mit Nachkommastellen): Gebäude zentriert darunter setzen
  function setGhost(fx, fy) {
    var s = V.ghost.def.size;
    V.ghost.x = Math.max(0, Math.min(N - s, Math.round(fx - s / 2)));
    V.ghost.y = Math.max(0, Math.min(N - s, Math.round(fy - s / 2)));
    MC.UI.ghostMoved && MC.UI.ghostMoved();
  }
  V.ghostOk = function () {
    var q = V.ghost;
    return q && G.canPlace(q.def, q.x, q.y, q.moving ? q.moving.id : 0);
  };
  V.confirmGhost = function () {
    var q = V.ghost, err;
    if (!q) return;
    if (q.moving) {
      err = G.move(q.moving, q.x, q.y);
      if (err) return MC.UI.toast(err, true);
      MC.UI.sound('build');
      V.setMode('idle');
      return;
    }
    err = G.build(q.def.id, q.x, q.y);
    if (err) return MC.UI.toast(err, true);
    MC.UI.sound('build');
    V.float(q.x + q.def.size / 2, q.y + q.def.size / 2, '−' + (q.def.gold ? q.def.gold + ' Gold' : MC.money(q.def.cost)), '#ffd0c8');
    if (q.def.kind === 'wonder') { V.setMode('idle'); return; }
    // Geist für das nächste Stück ein Feld weiterschieben
    var s = q.def.size, tries = [[s, 0], [0, s], [-s, 0], [0, -s]];
    for (var i = 0; i < tries.length; i++) {
      if (G.canPlace(q.def, q.x + tries[i][0], q.y + tries[i][1])) { q.x += tries[i][0]; q.y += tries[i][1]; break; }
    }
    MC.UI.ghostMoved && MC.UI.ghostMoved();
  };

  V.float = function (tx, ty, text, color) {
    floats.push({ x: wx(tx, ty), y: wy(tx, ty), text: text, color: color || '#fff', t: performance.now() });
  };
  // Münzregen
  var parts = [];
  function burst(tx, ty, n) {
    var x = wx(tx, ty), y = wy(tx, ty) - 30, t = performance.now();
    for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 120, t: t + i * 25, r: Math.random() * 6 });
  }
  // Wiederholbare Boden-Texturen (assets/sprites/boden_*.svg, Kachelmaß 128 × 64)
  var pats = {};
  function pat(id) {
    if (id in pats) return pats[id];
    var c = A.img(id), p = null;
    if (c) {
      try { p = g.createPattern(c, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix([c.lw / c.width, 0, 0, c.lh / c.height, 0, 0])); }
      catch (e) { p = null; }
    }
    return (pats[id] = p);
  }
  // Kartenpunkt (Felder) -> Bildschirm (CSS-Pixel)
  V.toScreen = function (tx, ty, z) {
    return { x: (wx(tx, ty) - cam.x) * cam.z + W / 2, y: (wy(tx, ty) - (z || 0) - cam.y) * cam.z + H / 2 };
  };
  // Bildschirmposition des Symbols über einem Gebäude
  V.iconPos = function (b) {
    for (var i = 0; i < items.length; i++) if (items[i].b === b) return { x: (items[i].ix - cam.x) * cam.z + W / 2, y: (items[i].iy - cam.y) * cam.z + H / 2 };
    return null;
  };
  V.tutTiles = null;   // [[x,y],...] leuchtende Felder fürs Tutorial
  // weich herauszoomen (z. B. damit Verkaufsschilder am Stadtrand sichtbar werden)
  V.zoomOut = function (z) {
    lastActive = performance.now() + 700;
    var hq = G.S.b[0], from = cam.z, to = Math.min(cam.z, z), t0 = performance.now();
    var tx = wx(hq.x + 1, hq.y + 1), ty = wy(hq.x + 1, hq.y + 1), fx = cam.x, fy = cam.y;
    (function step(now) {
      var k = Math.min(1, (now - t0) / 700), e = k * (2 - k);
      cam.z = from + (to - from) * e; cam.x = fx + (tx - fx) * e; cam.y = fy + (ty - fy) * e;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };
  // Test/Debug: Kamera auf einen Punkt, Lage der Küsten-Wahrzeichen
  V.lookAt = function (x, y, z) { cam.x = wx(x, y); cam.y = wy(x, y); cam.z = z || 1; };
  V.coastSpots = function () {
    var cg = coast(), z = E(cg.hw, cg.hwPos, 4), l = E(cg.sea, cg.light, cg.cu(cg.light)), m = E(cg.mount, N / 2, cg.mu(N / 2) + 2);
    return { zoll: z, leuchtturm: l, berg: m };
  };
  V.focus = function (b) {
    var d = MC.DEF[b.t];
    cam.x = wx(b.x + d.size / 2, b.y + d.size / 2); cam.y = wy(b.x + d.size / 2, b.y + d.size / 2);
  };

  // ---------- Eingabe ----------
  function bindInput() {
    var pts = {}, n = 0, moved = false, start = null, pinch = null, painting = null, dragGhost = false, lastPaint = null, brushing = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    // Hängende Finger vermeiden: iOS meldet nicht jedes Loslassen (Systemgesten, App-Wechsel, Benachrichtigungen).
    // Ein neuer erster Finger beginnt immer eine frische Geste; beim Verlassen der App wird alles zurückgesetzt.
    function resetTouches() { pts = {}; n = 0; start = null; pinch = null; painting = null; dragGhost = false; brushing = null; }
    window.addEventListener('blur', resetTouches);
    document.addEventListener('visibilitychange', function () { if (document.hidden) resetTouches(); });
    cv.addEventListener('lostpointercapture', function (e) { if (pts[e.pointerId]) { moved = true; up(e); } });   // abgebrochen: kein Antippen auslösen
    cv.addEventListener('touchend', function (e) { if (e.touches && e.touches.length === 0 && n > 0) setTimeout(function () { if (n > 0 && Object.keys(pts).length) { moved = true; Object.keys(pts).forEach(function (id) { up({ pointerId: id }); }); } }, 60); }, { passive: true });
    cv.addEventListener('pointerdown', function (e) {
      V.kick();
      if (e.isPrimary) resetTouches();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { }   // darf die Eingabe nie abbrechen
      var p = pos(e); pts[e.pointerId] = p; n = Object.keys(pts).length;
      if (n === 1) {
        moved = false; start = { x: p.x, y: p.y, cx: cam.x, cy: cam.y }; painting = null; dragGhost = false; lastPaint = null;
        var t = toTile(p.x, p.y), tx = Math.floor(t.fx), ty = Math.floor(t.fy);
        if (V.mode === 'road' && G.owned(tx, ty)) {
          var cur = G.at(tx, ty);
          if (cur === 0 || cur === -1) painting = { on: cur === 0, start: { x: tx, y: ty } };
        }
        brushing = null;
        if (V.mode === 'sign') {   // Vermieten-Pinsel: Wischen über Häuser vermietet sie (Start auf leerem Feld = Karte schieben)
          var bid = G.at(tx, ty);
          if (bid > 0 && MC.DEF[G.get(bid).t].kind === 'house') { brushing = { last: { x: tx, y: ty } }; MC.UI.brushSign(G.get(bid)); }
        }
        if (V.mode === 'place' && V.ghost) {
          var q = V.ghost, s = q.def.size;
          if (t.fx >= q.x - 0.5 && t.fx < q.x + s + 0.5 && t.fy >= q.y - 0.5 && t.fy < q.y + s + 0.5) dragGhost = { dx: t.fx - q.x, dy: t.fy - q.y };
        }
      } else if (n === 2) {
        painting = null; dragGhost = false; brushing = null; moved = true;
        pinch = pinchState();
      }
      e.preventDefault();
    });
    function pinchState() {
      var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z: cam.z, cx: cam.x, cy: cam.y };
    }
    cv.addEventListener('pointermove', function (e) {
      V.kick();
      if (!pts[e.pointerId]) return;
      var p = pos(e); pts[e.pointerId] = p;
      if (n === 1 && start) {
        var dx = p.x - start.x, dy = p.y - start.y;
        if (!moved && Math.hypot(dx, dy) > 9) moved = true;
        if (!moved) return;
        var t = toTile(p.x, p.y), tx = Math.floor(t.fx), ty = Math.floor(t.fy);
        if (brushing) {
          brushLine(brushing.last, { x: tx, y: ty }); brushing.last = { x: tx, y: ty };
        } else if (painting) {
          if (!lastPaint) { paintLine(null, painting.start, painting.on); lastPaint = painting.start; }   // Startfeld mitnehmen
          paintLine(lastPaint, { x: tx, y: ty }, painting.on); lastPaint = { x: tx, y: ty };
        } else if (dragGhost) {
          var q = V.ghost, s = q.def.size;
          q.x = Math.max(0, Math.min(N - s, Math.round(t.fx - dragGhost.dx)));
          q.y = Math.max(0, Math.min(N - s, Math.round(t.fy - dragGhost.dy)));
          MC.UI.ghostMoved && MC.UI.ghostMoved();
        } else {
          cam.x = start.cx - dx / cam.z; cam.y = start.cy - dy / cam.z; clampCam();
        }
      } else if (n >= 2 && pinch) {
        var c = pinchState();
        var z = Math.max(0.3, Math.min(2.6, pinch.z * c.d / Math.max(20, pinch.d)));
        // Punkt unter dem Finger-Mittelpunkt festhalten
        var ax = (pinch.mx - W / 2) / pinch.z + pinch.cx, ay = (pinch.my - H / 2) / pinch.z + pinch.cy;
        cam.z = z; cam.x = ax - (c.mx - W / 2) / z; cam.y = ay - (c.my - H / 2) / z; clampCam();
      }
      e.preventDefault();
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      var p = pts[e.pointerId];
      delete pts[e.pointerId]; n = Object.keys(pts).length;
      if (n === 0) {
        if (!moved && start) tap(p.x, p.y);
        start = null; pinch = null; painting = null; dragGhost = false; brushing = null;
      } else if (n === 1) {
        var k = Object.keys(pts)[0];
        start = { x: pts[k].x, y: pts[k].y, cx: cam.x, cy: cam.y }; pinch = null; moved = true;
      }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) {
      V.kick();
      var p = pos(e), z0 = cam.z, z = Math.max(0.3, Math.min(2.6, z0 * (e.deltaY < 0 ? 1.12 : 0.89)));
      var ax = (p.x - W / 2) / z0 + cam.x, ay = (p.y - H / 2) / z0 + cam.y;
      cam.z = z; cam.x = ax - (p.x - W / 2) / z; cam.y = ay - (p.y - H / 2) / z; clampCam();
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); });
    });

    function brushLine(a, b) {   // alle Felder zwischen zwei Fingerpositionen (schnelles Wischen überspringt sonst Häuser)
      var x = a.x, y = a.y, guard = 0;
      while ((x !== b.x || y !== b.y) && guard++ < 200) {
        if (x !== b.x) x += x < b.x ? 1 : -1; else y += y < b.y ? 1 : -1;
        var id = G.at(x, y);
        if (id > 0 && MC.DEF[G.get(id).t].kind === 'house') MC.UI.brushSign(G.get(id));
      }
    }
    function paintLine(a, b, on) {
      if (!a) { if (G.setRoad(b.x, b.y, on) && on) MC.UI.sound('tick'); return; }
      var x = a.x, y = a.y, guard = 0;
      while ((x !== b.x || y !== b.y) && guard++ < 200) {
        if (x !== b.x) x += x < b.x ? 1 : -1; else y += y < b.y ? 1 : -1;
        if (G.setRoad(x, y, on) && on) MC.UI.sound('tick');
      }
    }
  }

  function pick(sx, sy) {
    // vorderstes Gebäude unter dem Finger (pixelgenau über das Sprite)
    var t = toTile(sx, sy);
    if (V.flat) { var fid = G.at(Math.floor(t.fx), Math.floor(t.fy)); return fid > 0 ? G.get(fid) : null; }
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (!it.b) continue;
      var sp = it.sp, lx = t.px - (it.sx - sp.ox), ly = t.py - (it.sy - sp.oy);
      if (lx < 0 || ly < 0 || lx >= sp.w || ly >= sp.h) continue;
      // Symbol über dem Gebäude zählt mit
      try {
        var a = sp.c.getContext('2d').getImageData(Math.floor(lx * 2), Math.floor(ly * 2), 1, 1).data[3];
        if (a > 20) return it.b;
      } catch (e) { }
    }
    var id = G.at(Math.floor(t.fx), Math.floor(t.fy));
    return id > 0 ? G.get(id) : null;
  }
  function pickIcon(sx, sy) {
    if (V.flat) return null;
    var t = toTile(sx, sy), k = iconScale();
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (!it.b || !it.icon) continue;
      if (Math.hypot(t.px - it.ix, t.py - it.iy) < 20 * k) return it.b;
    }
    return null;
  }

  function tap(sx, sy) {
    var t = toTile(sx, sy), tx = Math.floor(t.fx), ty = Math.floor(t.fy);
    // Ein offenes Fenster schließt der erste Tipp daneben – ohne auf der Karte etwas auszulösen
    var sh = document.getElementById('sheet');
    if (sh && !sh.hidden && V.mode !== 'place') { MC.UI.closeSheet(); return; }
    if (V.mode === 'place') { setGhost(t.fx, t.fy); return; }
    if (V.mode === 'road') {
      var cur = G.at(tx, ty);
      if (!G.owned(tx, ty)) MC.UI.toast('Dieses Land gehört dir noch nicht.', true);
      else if (cur === 0) { G.setRoad(tx, ty, true); MC.UI.sound('tick'); }
      else if (cur === -1) G.setRoad(tx, ty, false);
      return;
    }
    var b = pickIcon(sx, sy) || pick(sx, sy);
    if (V.mode === 'sign') { if (b && MC.DEF[b.t].kind === 'house') MC.UI.brushSign(b); return; }
    if (G.visiting) { if (b) MC.UI.tapBuilding(b); return; }   // beim Besuch nur ansehen
    if (V.mode === 'bulldoze') {
      if (b) MC.UI.askDemolish(b);
      else if (G.isRoad(tx, ty)) G.setRoad(tx, ty, false);
      return;
    }
    if (V.mode === 'move') {
      if (b) V.setMode('place', { def: MC.DEF[b.t], moving: b });
      return;
    }
    if (b) { MC.UI.tapBuilding(b); return; }
    var sxx = Math.floor(tx / SEC), syy = Math.floor(ty / SEC);
    if (G.sectorBuyable(sxx, syy) && G.unlocked('land') && !G.inTut()) MC.UI.openLand(sxx, syy);
  }

  // ---------- Zeichenliste ----------
  function hash(a, b) { var h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rebuildItems() {
    items = [];
    var i, S = G.S;
    for (i = 0; i < S.b.length; i++) {
      var b = S.b[i], d = MC.DEF[b.t];
      var sid = b.lvlUp > 1 && MC.Assets && MC.Assets.canvas(b.t + '_s' + b.lvlUp) ? b.t + '_s' + b.lvlUp : b.t;
      items.push({ b: b, d: d, sp: A.sprite(sid), sx: wx(b.x, b.y), sy: wy(b.x, b.y), depth: b.x + b.y + d.size, stars: sid === b.t && b.lvlUp > 1 ? b.lvlUp - 1 : 0 });
    }
    // Wald auf fremdem Land
    if (!treeSp) treeSp = makeTree();
    for (var sx = 0; sx < MC.SECTORS; sx++) for (var sy = 0; sy < MC.SECTORS; sy++) {
      if (G.sectorOwned(sx, sy)) continue;
      var buy = G.sectorBuyable(sx, sy), cnt = buy ? 7 : 11;
      for (i = 0; i < cnt; i++) {
        var tx = sx * SEC + Math.floor(hash(sx * 31 + i, sy * 17 + 3) * SEC), ty = sy * SEC + Math.floor(hash(sx * 13 + 7, sy * 29 + i) * SEC);
        if (buy && Math.abs(tx - sx * SEC - SEC / 2) < 3 && Math.abs(ty - sy * SEC - SEC / 2) < 3) continue;
        items.push({ tree: true, sp: treeSp[(i + sx + sy) % treeSp.length], sx: wx(tx, ty), sy: wy(tx, ty), depth: tx + ty + 1 });
      }
    }
    coastItems();
    items.sort(function (a, c) { return a.depth - c.depth; });
    itemsDirty = false; statT = 0;
  }
  function makeTree() {
    var out = [], cols = ['#3f8f48', '#4a9c52', '#37823f'];
    for (var i = 0; i < 3; i++) {
      var a = A.img('baum_' + (i + 1));
      if (a) { out.push({ c: a, w: a.lw, h: a.lh, ox: a.lw / 2, oy: a.lh - 32 }); continue; }
      var c = document.createElement('canvas'); c.width = 128; c.height = 140;
      var q = c.getContext('2d'); q.scale(2, 2);
      A.kit(q, 32, 52).tree(0.5, 0.5, 1 + i * 0.12, cols[i]);
      out.push({ c: c, w: 64, h: 70, ox: 32, oy: 52 });
    }
    return out;
  }
  function refreshStates(now) {
    var t = G.now();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.b) continue;
      var st = G.state(it.b, t), k = it.d.kind, icon = null;
      if (st === 'build' || G.visiting) icon = null;   // beim Besuch: Stadt ohne Hinweisschilder zeigen
      else if (st === 'noroad') icon = 'noroad';
      else if (k === 'house') {
        if (st === 'empty') icon = 'contract';
        else if (st === 'ready') icon = (t > it.b.c.end + G.grace(it.b.c) * 0.75) ? 'coinwarn' : 'coin';
        else if (st === 'expired') icon = 'expired';
      } else if (k === 'shop' && st === 'ready') icon = G.customers(it.b) > 0 ? 'coin' : 'nocust';
      it.st = st; it.icon = icon;
      it.ix = it.sx; it.iy = it.sy + it.d.size * HH - Math.min(it.sp.top, 150) - 16;
    }
    statT = now;
  }
  function iconScale() { return Math.max(0.75, Math.min(1.7, 0.95 / cam.z)); }

  // ---------- Zeichnen ----------
  function diamondPath(x0, y0, x1, y1) {
    g.moveTo(wx(x0, y0), wy(x0, y0)); g.lineTo(wx(x1, y0), wy(x1, y0));
    g.lineTo(wx(x1, y1), wy(x1, y1)); g.lineTo(wx(x0, y1), wy(x0, y1)); g.closePath();
  }
  function diamond(x0, y0, x1, y1) {
    g.beginPath();
    g.moveTo(wx(x0, y0), wy(x0, y0)); g.lineTo(wx(x1, y0), wy(x1, y0));
    g.lineTo(wx(x1, y1), wy(x1, y1)); g.lineTo(wx(x0, y1), wy(x0, y1)); g.closePath();
  }

  V.dbg = {};   // Messschalter (noTerrain, noItems, noIcons) – nur für Leistungstests
  V.ms = 0;   // gleitende Zeichenzeit je Bild (ms), zur Leistungsmessung
  // Bildrate nach Bedarf: volle Rate bei Bewegung/Effekten, sonst 20 Bilder/s für die ruhigen Animationen
  var lastActive = 0, lastDraw = 0;
  V.kick = function () { lastActive = performance.now(); };
  function frame(now) {
    requestAnimationFrame(frame);
    var busy = now - lastActive < 700 || floats.length || parts.length || itemsDirty || V.mode === 'place' || V.mode === 'road' || V.mode === 'sign';
    if (!busy && now - lastDraw < (life.on ? 33 : 50)) return;
    lastDraw = now;
    var t0 = performance.now();
    draw(now);
    V.ms = V.ms * 0.9 + (performance.now() - t0) * 0.1;
  }
  function draw(now) {
    if (!W || !H) { resize(); return; }
    // Größe geändert ohne resize-Ereignis (z. B. App aus dem Hintergrund): neu vermessen, sonst wird das Bild verzerrt
    if (cv.clientWidth !== W || cv.clientHeight !== H || Math.min(window.devicePixelRatio || 1, 2) !== dpr) resize();
    if (itemsDirty) rebuildItems();
    if (now - statT > 300) refreshStates(now);

    var z = cam.z;
    var S = G.S, sx, sy, i, x, y, building = V.mode !== 'idle', grass = pat('boden_gras');
    var vx0 = cam.x - W / 2 / z, vx1 = cam.x + W / 2 / z, vy0 = cam.y - H / 2 / z, vy1 = cam.y + H / 2 / z;
    var pw = pat('wasser');
    // Gelände: jedes Pixel genau einmal malen (Meer nur außerhalb der Insel, Strand nur als Rand,
    // je Grundstück Rasen ODER Wiese, nur sichtbare Grundstücke) – auf Telefonen die teuerste Arbeit
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    if (!V.dbg.noTerrain) {
      drawCoast(now, vx0, vx1, vy0, vy1);
      // Grundstücke: Rasen (eigen) oder Wiese (fremd), unsichtbare überspringen
      var wild = pat('boden_wild') || '#62a85a', own = grass || '#8fd47c';
      for (sx = 0; sx < MC.SECTORS; sx++) for (sy = 0; sy < MC.SECTORS; sy++) {
        var X = sx * SEC, Y = sy * SEC;
        var l = wx(X, Y + SEC), r = wx(X + SEC, Y), tp = wy(X, Y), bt = wy(X + SEC, Y + SEC);
        if (r < vx0 || l > vx1 || bt < vy0 || tp > vy1) continue;
        var mine = G.sectorOwned(sx, sy);
        diamond(X, Y, X + SEC, Y + SEC); g.fillStyle = mine ? own : wild; g.fill();
        if (!mine && G.sectorBuyable(sx, sy)) {
          diamond(X + 0.15, Y + 0.15, X + SEC - 0.15, Y + SEC - 0.15);
          g.fillStyle = 'rgba(255,255,255,.13)'; g.fill();
          g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
        }
      }
      // Schachbrett-Schimmer (nur ohne Rasen-Textur) und Bauraster auf eigenem Land
      for (i = 0; i < S.land.length; i++) {
        var p = S.land[i].split(','), LX = p[0] * SEC, LY = p[1] * SEC;
        g.fillStyle = 'rgba(255,255,255,.05)';
        if (!grass) for (x = 0; x < SEC; x += 2) for (y = 0; y < SEC; y += 2) {
          diamond(LX + x, LY + y, LX + x + 1, LY + y + 1); g.fill();
          diamond(LX + x + 1, LY + y + 1, LX + x + 2, LY + y + 2); g.fill();
        }
        if (building || V.flat) {
          g.beginPath();
          for (x = 0; x <= SEC; x++) {
            g.moveTo(wx(LX + x, LY), wy(LX + x, LY)); g.lineTo(wx(LX + x, LY + SEC), wy(LX + x, LY + SEC));
            g.moveTo(wx(LX, LY + x), wy(LX, LY + x)); g.lineTo(wx(LX + SEC, LY + x), wy(LX + SEC, LY + x));
          }
          g.strokeStyle = 'rgba(20,70,30,.22)'; g.lineWidth = 0.7; g.stroke();
        }
      }
    } else { g.fillStyle = '#3f9ec4'; g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }

    if (!V.flat && !V.dbg.noLife) boats(now);

    // Straßen: Kachel-Asset strasse_<maske> (N=1, O=2, S=4, W=8) oder gezeichnet
    var roads = S.roads, plain = [], hwT = G.highwayTile();
    g.fillStyle = '#5a626e'; g.strokeStyle = '#5a626e'; g.lineWidth = 1;
    for (i = 0; i < roads.length; i++) {
      x = roads[i] % N; y = (roads[i] - x) / N;
      var rx = wx(x, y), ry = wy(x, y);
      if (rx < vx0 - 40 || rx > vx1 + 40 || ry < vy0 - 40 || ry > vy1 + 8) continue;
      var mask = (G.isRoad(x, y - 1) ? 1 : 0) | (G.isRoad(x + 1, y) ? 2 : 0) | (G.isRoad(x, y + 1) ? 4 : 0) | (G.isRoad(x - 1, y) ? 8 : 0);
      if (x === hwT[0] && y === hwT[1]) mask |= 1 << G.coast().hw;   // Anschluss an die Autobahn (N=1, O=2, S=4, W=8 = Kante 0..3)
      var rt = A.img('strasse_' + mask);
      if (rt) { g.drawImage(rt, rx - rt.lw / 2, ry - (rt.lh - 32), rt.lw, rt.lh); continue; }
      plain.push(roads[i]);
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + HW, ry + HH); g.lineTo(rx, ry + 2 * HH); g.lineTo(rx - HW, ry + HH); g.closePath();
      g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.3; g.setLineDash([4, 4]);
    g.beginPath();
    for (i = 0; i < plain.length; i++) {
      x = plain[i] % N; y = (plain[i] - x) / N;
      var cx = wx(x, y), cy = wy(x, y) + HH;
      var e = G.isRoad(x + 1, y), w = G.isRoad(x - 1, y), s = G.isRoad(x, y + 1), nn = G.isRoad(x, y - 1);
      if (e) { g.moveTo(cx, cy); g.lineTo(cx + 16, cy + 8); }
      if (w) { g.moveTo(cx, cy); g.lineTo(cx - 16, cy - 8); }
      if (s) { g.moveTo(cx, cy); g.lineTo(cx - 16, cy + 8); }
      if (nn) { g.moveTo(cx, cy); g.lineTo(cx + 16, cy - 8); }
    }
    g.stroke(); g.setLineDash([]);

    // Beim Bauen: abgehängte Straßenstücke rot markieren (zählen nicht zum Netz)
    if ((V.mode === 'road' || V.mode === 'place' || V.flat) && G.roadParts() > 1) {
      for (i = 0; i < roads.length; i++) {
        x = roads[i] % N; y = (roads[i] - x) / N;
        if (G.isMainRoad(x, y)) continue;
        diamond(x + 0.06, y + 0.06, x + 0.94, y + 0.94); g.fillStyle = 'rgba(217,48,37,.38)'; g.fill();
        g.strokeStyle = 'rgba(217,48,37,.9)'; g.lineWidth = 1.2; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
      }
    }

    // Straßenbau: Anschlussfeld der Autobahn pulsiert blau, solange nicht angeschlossen (und das Feld uns gehört)
    if ((V.mode === 'road' || V.flat) && !G.visiting) {
      var ht = G.highwayTile();
      if (G.ownsTile(ht[0], ht[1]) && !G.highwayLinked()) {
        var pa = 0.3 + 0.25 * Math.sin(now / 280);
        diamond(ht[0] + 0.06, ht[1] + 0.06, ht[0] + 0.94, ht[1] + 0.94); g.fillStyle = 'rgba(64,150,255,' + pa + ')'; g.fill();
        g.strokeStyle = 'rgba(40,110,230,.95)'; g.lineWidth = 1.6; g.stroke();
        V.kick();
      }
    }

    // Tutorial: Zielfelder pulsieren golden
    if (V.tutTiles) {
      var pu = 0.35 + 0.3 * Math.sin(now / 250);
      for (i = 0; i < V.tutTiles.length; i++) {
        var tt = V.tutTiles[i];
        if (G.at(tt[0], tt[1]) === -1 && tt.length < 3) continue;   // schon Straße
        diamond(tt[0] + 0.06, tt[1] + 0.06, tt[0] + (tt[2] || 1) - 0.06, tt[1] + (tt[2] || 1) - 0.06);
        g.fillStyle = 'rgba(255,214,90,' + pu + ')'; g.fill();
        g.strokeStyle = '#f2b632'; g.lineWidth = 2; g.stroke();
      }
    }

    // Vermieten-Pinsel: leere Häuser grün, fällige golden umranden
    if (V.mode === 'sign') {
      var tnow = G.now(), pul = 0.55 + 0.25 * Math.sin(now / 260);
      for (i = 0; i < S.b.length; i++) {
        var hb = S.b[i], hd = MC.DEF[hb.t];
        if (hd.kind !== 'house') continue;
        var hs = G.state(hb, tnow), col = hs === 'empty' || hs === 'expired' ? '60,200,110' : hs === 'ready' ? '242,182,50' : null;
        if (!col) continue;
        diamond(hb.x + 0.05, hb.y + 0.05, hb.x + hd.size - 0.05, hb.y + hd.size - 0.05);
        g.fillStyle = 'rgba(' + col + ',' + (pul * 0.45) + ')'; g.fill();
        g.strokeStyle = 'rgba(' + col + ',.95)'; g.lineWidth = 2.2; g.stroke();
      }
    }

    // Reichweite (Geist oder ausgewähltes Gebäude)
    var q = V.ghost, hl = q ? { x: q.x, y: q.y, d: q.def } : (V.highlight ? { x: V.highlight.x, y: V.highlight.y, d: MC.DEF[V.highlight.t] } : null);
    if (hl && hl.d.reach) {
      var r = hl.d.reach;
      diamond(hl.x - r, hl.y - r, hl.x + hl.d.size + r, hl.y + hl.d.size + r);
      g.fillStyle = hl.d.kind === 'shop' ? 'rgba(80,170,255,.22)' : 'rgba(255,220,80,.24)'; g.fill();
      g.strokeStyle = hl.d.kind === 'shop' ? 'rgba(40,120,230,.9)' : 'rgba(230,170,20,.95)'; g.lineWidth = 1.6; g.stroke();
    }
    if (q) {
      var ok = V.ghostOk();
      diamond(q.x, q.y, q.x + q.def.size, q.y + q.def.size);
      g.fillStyle = ok ? 'rgba(90,230,120,.55)' : 'rgba(240,70,60,.6)'; g.fill();
      g.strokeStyle = ok ? '#1f9d48' : '#b3261e'; g.lineWidth = 1.5; g.stroke();
    }

    // Gebäude und Bäume
    var t = G.now(), movingId = q && q.moving ? q.moving.id : 0;
    var gDepth = q ? q.x + q.y + q.def.size : Infinity, gDrawn = !q;
    function drawGhost() {
      var gs = A.sprite(q.def.id);
      g.globalAlpha = 0.85; g.drawImage(gs.c, wx(q.x, q.y) - gs.ox, wy(q.x, q.y) - gs.oy, gs.w, gs.h); g.globalAlpha = 1;
      gDrawn = true;
    }
    // Nacht: zuerst nur den Boden abdunkeln und Bodenlichter setzen – Gebäude, Fahrzeuge, Laternen kommen danach
    // in Tiefenreihenfolge (jedes Ding abgedunkelt + sein eigenes Licht), so verdecken vordere Dinge die Lichter dahinter
    NM = V.flat ? { col: null, light: 0, h: 90 } : V.mood(); V.light = NM.light;
    if (!V.flat) nightGround(vx0, vx1, vy0, vy1);
    var amb = V.flat || V.dbg.noLife ? [] : lifeStep(now), ai = 0;
    if (!V.flat) amb = mergeLamps(amb, vx0, vx1, vy0, vy1);
    for (i = 0; i < (V.dbg.noItems ? 0 : items.length); i++) {
      var it = items[i], sp = it.sp;
      if (V.flat) continue;
      while (ai < amb.length && amb[ai].d < it.depth) drawAmb(amb[ai++], now, vx0, vx1, vy0, vy1);
      if (!gDrawn && it.depth > gDepth) drawGhost();
      if (it.sx + sp.w < vx0 || it.sx - sp.w > vx1 || it.sy + sp.h < vy0 || it.sy - sp.oy > vy1) continue;
      if (it.b && it.b.id === movingId) { g.globalAlpha = 0.25; g.drawImage(sp.c, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h); g.globalAlpha = 1; continue; }
      if (it.b && it.st === 'build') { drawSite(it, t); continue; }
      if (!MC.SHADOW_CUT) drawShadow(it);
      if (it.flip) { g.save(); g.translate(it.sx, 0); g.scale(-1, 1); g.drawImage(tinted(sp.c), -sp.ox, it.sy - sp.oy, sp.w, sp.h); g.restore(); }
      else g.drawImage(tinted(sp.c), it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
      if (MC.SHADOW_CUT) drawShadow(it);   // ausgeschnittene Schatten liegen über dem eigenen Grundstücksboden
      if (it.deco && NM.light > 0.02) decoLight(it);
      if (it.b && NM.light > 0.02) itemLight(it);
      if (it.d && it.d.friend) flags(it, now);
      if (it.stars) stars(it);
    }
    while (ai < amb.length) drawAmb(amb[ai++], now, vx0, vx1, vy0, vy1);
    if (!V.flat && !V.dbg.noLife) birds(now, vx0, vx1, vy0, vy1);
    if (V.flat) drawFlat(t, movingId, q);
    if (q) {
      if (!gDrawn && !V.flat) drawGhost();
      ghostLabel(q, A.sprite(q.def.id));
    }

    // Verkaufsschilder
    var lp = G.landPrice();
    if (lp && V.mode === 'idle' && !V.flat && G.unlocked('land') && !G.inTut() && !G.visiting) {
      for (sx = 0; sx < MC.SECTORS; sx++) for (sy = 0; sy < MC.SECTORS; sy++) {
        if (!G.sectorBuyable(sx, sy)) continue;
        sign(wx(sx * SEC + SEC / 2, sy * SEC + SEC / 2), wy(sx * SEC + SEC / 2, sy * SEC + SEC / 2), lp);
      }
    }

    // Symbole
    var k = iconScale(), bob = Math.sin(now / 320) * 3;
    for (i = 0; i < items.length; i++) {
      var o = items[i];
      if (!o.b || o.b.id === movingId) continue;
      if (o.ix < vx0 - 30 || o.ix > vx1 + 30 || o.iy < vy0 - 40 || o.iy > vy1 + 40) continue;
      if (V.flat) continue;
      if (o.st === 'build') { progress(o, t, k); continue; }
      if (o.icon && V.mode !== 'place') icon(o.icon, o.ix, o.iy + bob * k, k, now);
    }

    // Münzen
    var coinImg = A.img('symbol_muenze');
    for (i = parts.length - 1; i >= 0; i--) {
      var pt = parts[i], dt = (now - pt.t) / 1000;
      if (dt < 0) continue;
      if (dt > 0.9) { parts.splice(i, 1); continue; }
      var px = pt.x + pt.vx * dt, py = pt.y + pt.vy * dt + 420 * dt * dt, rr2 = 7 * k;
      g.globalAlpha = dt < 0.6 ? 1 : (0.9 - dt) / 0.3;
      if (coinImg) g.drawImage(coinImg, px - rr2, py - rr2, rr2 * 2, rr2 * 2);
      else {
        var sq = Math.abs(Math.cos(dt * 14 + pt.r));
        g.beginPath(); g.ellipse(px, py, rr2 * Math.max(0.2, sq), rr2, 0, 0, Math.PI * 2);
        g.fillStyle = '#f2b632'; g.fill(); g.strokeStyle = '#a8750f'; g.lineWidth = 1.2 * k; g.stroke();
      }
      g.globalAlpha = 1;
    }

    // Schwebende Texte
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i], a = (now - f.t) / 1300;
      if (a >= 1) { floats.splice(i, 1); continue; }
      g.globalAlpha = a < 0.7 ? 1 : (1 - a) / 0.3;
      g.font = '800 ' + (15 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif';
      g.textAlign = 'center'; g.lineWidth = 3.5 * k; g.strokeStyle = 'rgba(15,25,45,.85)'; g.lineJoin = 'round';
      var fy = f.y - 30 - a * 46 * k;
      g.strokeText(f.text, f.x, fy); g.fillStyle = f.color; g.fillText(f.text, f.x, fy);
      g.globalAlpha = 1;
    }
  }

  // Flache Ansicht: Grundfläche je Gebäude (Farbe nach Art), kleines Bild in der Mitte, Name ab genug Platz
  function drawFlat(t, movingId, q) {
    var all = items.filter(function (it) { return it.b; });
    if (q) all.push({ ghost: true, b: { x: q.x, y: q.y, t: q.def.id }, d: q.def, sp: A.sprite(q.def.id) });
    for (var i = 0; i < all.length; i++) {
      var it = all[i], b = it.b, d = it.d, s = d.size, col = FLAT_COL[d.kind] || FLAT_COL.house;
      var fade = it.ghost ? 0.9 : (b.id && b.id === movingId ? 0.25 : 1);
      g.globalAlpha = fade;
      var inset = d.kind === 'deco' ? 0.14 : 0.07;
      if (!it.ghost) {   // der Geist hat schon seine grüne/rote Fläche
        diamond(b.x + inset, b.y + inset, b.x + s - inset, b.y + s - inset);
        var site = it.st === 'build';
        g.fillStyle = site ? '#dcc79a' : col[0]; g.fill();
        var bad = it.st === 'noroad';
        g.lineWidth = bad ? 2.4 : 1.4; g.strokeStyle = bad ? '#d93025' : col[1];
        if (site || bad) g.setLineDash([5, 4]);
        g.stroke(); g.setLineDash([]);
      }
      // kleines Bild: Sprite in die Raute eingepasst
      var sp = it.sp, cx = wx(b.x + s / 2, b.y + s / 2), cy = wy(b.x + s / 2, b.y + s / 2);
      var sc = Math.min((s * HW * 1.15) / sp.w, (s * HH * 1.7) / sp.h, 0.8);
      if (d.kind === 'deco') sc *= 0.9;
      g.drawImage(sp.c, cx - sp.w * sc / 2, cy - sp.h * sc * 0.62, sp.w * sc, sp.h * sc);
      // Name, wenn die Grundfläche auf dem Bildschirm breit genug ist
      if (!it.ghost && d.kind !== 'deco' && s * HW * 2 * cam.z > 92) {
        var fs = Math.min(13, 4 + s * 3) / Math.max(0.6, cam.z) * Math.min(1.25, cam.z);
        g.font = '700 ' + fs + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
        g.lineWidth = fs * 0.28; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.9)';
        var ty = cy + s * HH * 0.55;
        var nm = d.friend && G.S.friends ? d.name + ' +' + G.friendBonus() + ' %' : d.name;
        g.strokeText(nm, cx, ty); g.fillStyle = '#1d2b44'; g.fillText(nm, cx, ty);
      }
      g.globalAlpha = 1;
    }
  }

  // Platz der Freundschaft: eine Fahne je Freund an den Masten (vorne zuerst), darüber der Bonus
  var FLAGCOL = ['#e0533d', '#2b7de9', '#22a455', '#f2b632', '#9b59d0', '#ff7aa8', '#16b5c4', '#ff8a3c', '#4a5fd9', '#7cc242', '#d94f8a', '#3aa0e0'];
  function flags(it, now) {
    var n = Math.min(12, G.S.friends || 0), b = it.b, i;
    var poles = MC.FRIEND_POLES.map(function (p, k) { return { x: p[0], y: p[1], k: k }; }).sort(function (a, c) { return (c.x + c.y) - (a.x + a.y); });
    for (i = 0; i < n; i++) {
      var p = poles[i], X = wx(b.x + p.x, b.y + p.y), Y = wy(b.x + p.x, b.y + p.y) - 30;
      var w = Math.sin(now / 260 + i * 1.7) * 1.4;
      g.beginPath(); g.moveTo(X + 0.6, Y); g.quadraticCurveTo(X + 8, Y + w, X + 15, Y + 4.5 + w * 0.6);
      g.quadraticCurveTo(X + 8, Y + 8 + w, X + 0.6, Y + 9.5); g.closePath();
      g.fillStyle = FLAGCOL[i % FLAGCOL.length]; g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.5; g.stroke();
    }
    if ((G.S.friends || 0) > 0 && cam.z >= 0.5) {
      var k = iconScale(), cx = wx(b.x + 1, b.y + 1), cy = wy(b.x + 1, b.y + 1) - it.sp.top + 6;
      var txt = '+' + G.friendBonus() + ' %';
      g.font = '800 ' + (12 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
      var tw = g.measureText(txt).width + 14 * k;
      rr(cx - tw / 2, cy - 15 * k, tw, 20 * k, 10 * k); g.fillStyle = 'rgba(15,25,45,.85)'; g.fill();
      g.fillStyle = '#ffd96a'; g.fillText(txt, cx, cy - 1 * k);
    }
  }

  // ---------- Tag und Nacht nach dem echten Sonnenstand über der Mitte Deutschlands ----------
  // Sonnenhöhe aus der Uhrzeit (UTC, unabhängig von der Zeitzone des Geräts), dann Lichtstimmung als Multiplizier-Schicht
  // über der Welt und warme Lichter (Fenster bewohnter Häuser, Läden, Laternen, Scheinwerfer) darüber.
  var GEO = { lat: 51.16, lon: 10.45 };
  // Vorschau zu einer anderen Uhrzeit: …/?uhr=21:30 (Gerätezeit, nur zum Ausprobieren)
  (function () {
    var m = /[?&]uhr=(\d{1,2})[:.](\d{2})/.exec(location.search);
    if (m) V.dbg.clock = function () { var d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d; };
  })();
  V.sun = function (date) {
    var d = (date.getTime() / 86400000 + 2440587.5) - 2451545.0, rad = Math.PI / 180;
    var g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad, dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = ((gmst + GEO.lon / 15) * 15 - ra) * rad, lat = GEO.lat * rad;
    var h = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / rad;
    var rising = Math.sin(ha) < 0;   // Stundenwinkel negativ = Vormittag
    return { h: h, rising: rising };
  };
  // Stimmung je Sonnenhöhe (Grad): Farbe der Multiplizier-Schicht und Stärke der Lichter
  var MOOD_EVE = [[12, '#ffffff'], [6, '#fff1dc'], [2, '#ffd2a0'], [0, '#f4a57c'], [-3, '#b48cba'], [-6, '#7c78b4'], [-9, '#4d5b9a'], [-13, '#38467f']];
  var MOOD_MORN = [[12, '#ffffff'], [6, '#fff4e6'], [2, '#ffd6c0'], [0, '#f7b0a4'], [-3, '#bc94c2'], [-6, '#8582bc'], [-9, '#505e9e'], [-13, '#38467f']];
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function moodAt(h, rising) {
    var k = rising ? MOOD_MORN : MOOD_EVE, i;
    if (h >= k[0][0]) return { col: null, light: 0, h: h };
    for (i = 0; i < k.length - 1; i++) if (h >= k[i + 1][0]) break;
    var a = k[i], b = k[Math.min(i + 1, k.length - 1)], f = a[0] === b[0] ? 1 : (a[0] - h) / (a[0] - b[0]);
    var ca = hex(a[1]), cb = hex(b[1]), c = ca.map(function (v, j) { return Math.round(v + (cb[j] - v) * Math.max(0, Math.min(1, f))); });
    var light = Math.max(0, Math.min(1, (2.5 - h) / 10));
    return { col: 'rgb(' + c.join(',') + ')', light: light, h: h };
  }
  V.mood = function () {
    if (G.S.daynight === false) return { col: null, light: 0, h: 90 };
    var s = V.dbg.sunH !== undefined ? { h: V.dbg.sunH, rising: !!V.dbg.rising } : V.sun(V.dbg.clock ? V.dbg.clock() : new Date());
    return moodAt(s.h, s.rising);
  };
  // Fenstermaske je Gebäudebild: helle Glasflächen (#8fd0ea-artig) als warmes Licht, in Blöcken teils an, teils aus
  var masks = new WeakMap();
  function windowMask(sp, seed) {
    var m = masks.get(sp.c);
    if (m !== undefined) return m;
    m = null;
    try {
      var w = sp.c.width, h = sp.c.height, src = sp.c.getContext('2d').getImageData(0, 0, w, h).data;
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var q = c.getContext('2d'), img = q.createImageData(w, h), d = img.data, any = false;
      var glass = new Uint8Array(w * h), lab = new Int32Array(w * h), n = 0, stack = [];
      for (var k = 0; k < w * h; k++) {
        var r = src[k * 4], gg = src[k * 4 + 1], bl = src[k * 4 + 2], al = src[k * 4 + 3];
        glass[k] = al >= 200 && r >= 100 && bl >= 170 && bl >= r + 25 && gg >= r + 5 ? 1 : 0;
      }
      // zusammenhängende Glasflächen = einzelne Scheiben; jede Scheibe zufällig (aber fest) an oder aus
      for (k = 0; k < w * h; k++) {
        if (!glass[k] || lab[k]) continue;
        n++; var hsh = ((n * 2654435761) ^ seed) >>> 0, lit = hsh % 100 < 58, cool = hsh % 9 === 0, px = [];
        stack.push(k); lab[k] = n;
        while (stack.length) {
          var v = stack.pop(); px.push(v);
          var vx = v % w, vy = (v - vx) / w;
          if (vx > 0 && glass[v - 1] && !lab[v - 1]) { lab[v - 1] = n; stack.push(v - 1); }
          if (vx < w - 1 && glass[v + 1] && !lab[v + 1]) { lab[v + 1] = n; stack.push(v + 1); }
          if (vy > 0 && glass[v - w] && !lab[v - w]) { lab[v - w] = n; stack.push(v - w); }
          if (vy < h - 1 && glass[v + w] && !lab[v + w]) { lab[v + w] = n; stack.push(v + w); }
        }
        // sehr große Glasflächen (Glastürme ohne Sprossen) in Etagen-Streifen teilen
        var big = px.length > 1400;
        for (var j = 0; j < px.length; j++) {
          var pi = px[j], on = lit;
          if (big) { var row = ((pi / w) | 0) / 14 | 0, h2 = ((row * 73856093) ^ seed) >>> 0; on = h2 % 100 < 55; }   // ganze Etagen hell oder dunkel
          if (!on) continue;
          var o = pi * 4; d[o] = cool ? 170 : 255; d[o + 1] = cool ? 200 : 186; d[o + 2] = cool ? 255 : 92; d[o + 3] = 255; any = true;
        }
      }
      if (any) { q.putImageData(img, 0, 0); m = c; }
    } catch (e) { m = null; }
    masks.set(sp.c, m);
    return m;
  }
  var NM = { col: null, light: 0, h: 90 };   // Stimmung dieses Bildes
  // abgedunkelte Fassung eines Bildes (Multiplizieren mit der Stimmungsfarbe), je Bild und Farbe zwischengespeichert
  var tints = new WeakMap();
  function tinted(c) {
    if (!NM.col || !c) return c;
    var e = tints.get(c);
    if (e && e.col === NM.col) return e.c;
    var t = (e && e.c) || document.createElement('canvas'); t.width = c.width; t.height = c.height;
    var q = t.getContext('2d'); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, t.width, t.height);
    q.drawImage(c, 0, 0); q.globalCompositeOperation = 'multiply'; q.fillStyle = NM.col; q.fillRect(0, 0, t.width, t.height);
    q.globalCompositeOperation = 'destination-in'; q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-over';
    tints.set(c, { col: NM.col, c: t });
    return t;
  }
  function tintHex(hex) {   // Farbe für gezeichnete Dinge (Autos, Personen) passend abdunkeln
    if (!NM.col) return hex;
    var a = hex.charAt(0) === '#' ? [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)] : [200, 200, 200];
    var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(NM.col), b = m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
    return 'rgb(' + a.map(function (v, i) { return Math.round(v * b[i] / 255); }).join(',') + ')';
  }
  // Schatten-Ebene (Fable: schatten_<id>) – Stärke nach Sonnenstand
  function shadowAlpha() { return 0.3 * Math.max(0.12, Math.min(1, (NM.h + 4) / 14)); }
  function drawShadow(it) {
    var id = it.b ? spriteId(it) : it.deco; if (!id) return;
    var sh = A.img('schatten_' + id); if (!sh) return;
    var a = shadowAlpha(); if (a <= 0.01) return;
    g.globalAlpha = a;
    if (it.flip) { g.save(); g.translate(it.sx, 0); g.scale(-1, 1); g.drawImage(sh, -it.sp.ox, it.sy - it.sp.oy, it.sp.w, it.sp.h); g.restore(); }
    else g.drawImage(sh, it.sx - it.sp.ox, it.sy - it.sp.oy, it.sp.w, it.sp.h);
    g.globalAlpha = 1;
  }
  function spriteId(it) { return it.b && it.b.lvlUp > 1 && !it.stars ? it.b.t + '_s' + it.b.lvlUp : it.b ? it.b.t : ''; }
  // Boden: Welt einfärben (nur das, was schon gezeichnet ist: Gelände, Straßen, Boote) + Bodenlichter
  function nightGround(vx0, vx1, vy0, vy1) {
    if (!NM.col) return;
    g.save();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = NM.col;
    g.fillRect(vx0 - 20, vy0 - 20, vx1 - vx0 + 40, vy1 - vy0 + 40);
    var L = NM.light, i;
    if (L > 0.02) {
      g.globalCompositeOperation = 'lighter';
      lampList().forEach(function (lp) {   // Lichtkegel der Laternen auf der Straße
        var lx = wx(lp.gx, lp.gy), ly = wy(lp.gx, lp.gy);
        if (lx < vx0 - 60 || lx > vx1 + 60 || ly < vy0 - 60 || ly > vy1 + 60) return;
        var gr = g.createRadialGradient(lx, ly, 2, lx, ly, 34);
        gr.addColorStop(0, 'rgba(255,200,110,' + (0.30 * L) + ')'); gr.addColorStop(1, 'rgba(255,200,110,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(lx, ly, 34, 19, 0, 0, Math.PI * 2); g.fill();
      });
      for (i = 0; i < items.length; i++) {   // warmer Schein vor geöffneten Läden (auf dem Boden)
        var it = items[i];
        if (!it.b || it.d.kind !== 'shop' || it.st === 'build' || G.customers(it.b) <= 0) continue;
        var s2 = it.d.size, cx = wx(it.b.x + s2 / 2, it.b.y + s2 / 2), cy = wy(it.b.x + s2 / 2, it.b.y + s2 / 2) + s2 * 6;
        if (cx < vx0 - 100 || cx > vx1 + 100 || cy < vy0 - 100 || cy > vy1 + 100) continue;
        var sg = g.createRadialGradient(cx, cy, 4, cx, cy, s2 * 30);
        sg.addColorStop(0, 'rgba(255,180,90,' + (0.32 * L) + ')'); sg.addColorStop(1, 'rgba(255,180,90,0)');
        g.fillStyle = sg; g.beginPath(); g.ellipse(cx, cy, s2 * 30, s2 * 17, 0, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }
  // Fensterlicht eines Gebäudes direkt nach dem Gebäude (spätere, vordere Gebäude verdecken es)
  function decoLight(it) {   // Leuchtturm/Zoll: Licht-Ebene von Fable
    var m = A.img('licht_' + it.deco); if (!m) return;
    var sp = it.sp; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = NM.light * 0.9;
    if (it.flip) { g.translate(it.sx, 0); g.scale(-1, 1); g.drawImage(m, -sp.ox, it.sy - sp.oy, sp.w, sp.h); } else g.drawImage(m, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
    g.restore();
  }
  function itemLight(it) {
    var k = it.d.kind, on = k === 'hq' || k === 'wonder' ? 0.9 : k === 'shop' ? (G.customers(it.b) > 0 ? 1 : 0.35) : k === 'house' ? (it.st === 'running' || it.st === 'ready' ? 1 : 0.12) : 0;
    if (!on) return;
    var sp = it.sp, m = A.img('licht_' + spriteId(it)) || windowMask(sp, it.b.id * 2654435761);
    if (!m) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, NM.light * on * 0.85);
    g.drawImage(m, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
    g.restore();
  }
  // Laternen: am Straßenrand (Seite ohne Nachbarstraße), nicht auf Kreuzungen; als Objekte in der Tiefenreihenfolge
  var lampCache = { sig: '', list: [] };
  function lampList() {
    var S = G.S, sig = S.roads.length + ':' + (S.roads[0] || 0) + ':' + (S.roads[S.roads.length - 1] || 0);
    if (sig === lampCache.sig) return lampCache.list;
    var out = [];
    S.roads.forEach(function (id) {
      var x = id % N, y = (id - x) / N;
      if (((x * 7 + y * 3) % 4) !== 0) return;
      var side = !G.isRoad(x, y + 1) ? [0.5, 0.96, 0.5, 0.7] : !G.isRoad(x + 1, y) ? [0.96, 0.5, 0.7, 0.5] : !G.isRoad(x, y - 1) ? [0.5, 0.04, 0.5, 0.3] : !G.isRoad(x - 1, y) ? [0.04, 0.5, 0.3, 0.5] : null;
      if (!side) return;
      out.push({ lamp: 1, fx: x + side[0], fy: y + side[1], gx: x + side[2], gy: y + side[3] });
    });
    lampCache = { sig: sig, list: out };
    return out;
  }
  function mergeLamps(amb, vx0, vx1, vy0, vy1) {
    var showDay = !!A.img('laterne');
    if (!showDay && NM.light < 0.02) return amb;
    var ls = lampList().map(function (o) { return { o: o, d: o.fx + o.fy }; });
    return amb.concat(ls).sort(function (a, b) { return a.d - b.d; });
  }
  function drawLamp(o) {
    var px = wx(o.fx, o.fy), py = wy(o.fx, o.fy), im = A.img('laterne'), L = NM.light;
    if (im) g.drawImage(tinted(im), px - im.lw / 2, py - im.lh, im.lw, im.lh);
    else if (L > 0.02) { g.strokeStyle = 'rgba(40,45,60,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 13); g.stroke(); }
    if (L > 0.02) {
      var hy = py - (im ? im.lh * 0.9 : 14), gl = A.img('laterne_licht');
      g.save(); g.globalCompositeOperation = 'lighter';
      if (gl) { g.globalAlpha = L; g.drawImage(gl, px - gl.lw / 2, hy - gl.lh / 2, gl.lw, gl.lh); }
      else { g.fillStyle = 'rgba(255,236,180,' + (0.85 * L) + ')'; g.beginPath(); g.arc(px, hy, 1.8, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }


  // ---------- Leben in der Stadt: Autos, Fußgänger, Boote, Vögel ----------
  // Autos folgen dem Straßennetz (Rechtsverkehr, an Kreuzungen zufällig abbiegen, keine Kehrtwende außer in Sackgassen).
  // Fußgänger laufen am Straßenrand, ihre Zahl wächst mit den Bewohnern. Alles nur Deko, ohne Einfluss aufs Spiel.
  var life = { on: false, cars: [], peds: [], last: 0, sig: '' };
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N O S W in Feldern
  var CARCOL = ['#e0533d', '#2b7de9', '#f2b632', '#ffffff', '#22a455', '#3a3f4a', '#9b59d0', '#ff8a3c', '#16b5c4', '#c9c9c9'];
  var SHIRT = ['#e0533d', '#2b7de9', '#f2b632', '#22a455', '#9b59d0', '#ff7aa8', '#ffffff', '#16b5c4'];
  function roadNb(x, y) { var o = []; for (var k = 0; k < 4; k++) if (G.isRoad(x + DIRS[k][0], y + DIRS[k][1])) o.push(k); return o; }
  function spawnOn(list, mk) {
    var R = G.S.roads, tries = 12;
    while (tries--) {
      var id = R[Math.floor(Math.random() * R.length)], x = id % N, y = (id - x) / N, nb = roadNb(x, y);
      if (nb.length) { list.push(mk(x, y, nb[Math.floor(Math.random() * nb.length)])); return; }
    }
  }
  function nextDir(x, y, dir) {
    var nb = roadNb(x, y), back = (dir + 2) % 4, opts = nb.filter(function (k) { return k !== back; });
    if (!opts.length) return nb.length ? back : -1;
    if (opts.indexOf(dir) >= 0 && Math.random() < 0.6) return dir;   // meistens geradeaus
    return opts[Math.floor(Math.random() * opts.length)];
  }
  // Autobahn-Verkehr: ohne Anschluss Stau vor dem Zoll (Leute wollen in die Stadt), mit Anschluss fließender Verkehr
  var HWCARS = [], hwMov = [], hwLast = 0, hwK = 0;
  for (var hk = 0; hk < 18; hk++) HWCARS.push({ col: hk, type: null, seed: Math.random() });
  function highwayCars(now) {
    if (!MC.CARS || !MC.CARS.length) return [];
    var cg = G.coast(), e = cg.hw, linked = G.highwayLinked(), t = now / 1000, out = [], inb = (e + 2) % 4;
    // Mitte der Autobahn bei Abstand u (Felder nach außen; u = 0 ist der Kartenrand)
    function at(u, lane, dir) {
      var c = e === 0 ? [cg.hwPos + 0.5, -u] : e === 1 ? [N + u, cg.hwPos + 0.5] : e === 2 ? [cg.hwPos + 0.5, N + u] : [-u, cg.hwPos + 0.5];
      var dx = DIRS[dir][0], dy = DIRS[dir][1];
      return [c[0] - dy * lane, c[1] + dx * lane];   // rechte Spur in Fahrtrichtung
    }
    function car(k, u, dir, lane, m) {
      var h = HWCARS[k % HWCARS.length]; if (!h.type) h.type = MC.CARS[Math.floor(h.seed * MC.CARS.length)];
      var o;
      if (m) { o = m.o || (m.o = { car: 1, type: m.type || (m.type = h.type), hw: 1 }); }
      else o = h['o' + dir] || (h['o' + dir] = { car: 1, type: h.type, hw: 1 });
      var p = at(u, lane, dir);
      o.dir = dir; o.fx = p[0]; o.fy = p[1];
      // unter dem Zolldach (u 3,4 bis 6,6): hinter die Zollstation sortieren, sonst stünde das Auto auf dem Dach
      var zd = (e === 0 ? cg.hwPos - 1 - 6 : e === 1 ? N + 3 + cg.hwPos - 1 : e === 2 ? cg.hwPos - 1 + N + 3 : -6 + cg.hwPos - 1) + 3;
      out.push({ o: o, d: u > 4.3 && u < 5.7 ? zd - 0.05 : o.fx + o.fy });
    }
    if (!linked) {
      hwMov.length = 0;
      // Schlange ab der Schranke (Zoll liegt bei u = 4..6) nach außen; ruckelt ab und zu ein Stück vor
      for (var i = 0; i < 14; i++) {
        var creep = 0.12 * Math.max(0, Math.sin(t * 0.6 - i * 0.45));
        car(i, 6.6 + i * 0.55 - creep, inb, 0.3);
      }
    } else {
      var dt = Math.min(0.1, (now - (hwLast || now)) / 1000), nIn = 0, nOut = 0, far = 99, near = 99;
      hwLast = now;
      if (!hwMov.length) {   // gerade angeschlossen / geladen: Autobahn gleich gefüllt statt leer
        for (var f = 0; f < 8; f++) hwMov.push({ u: 1.5 + f * 3.1, dir: inb, v: 1.1 + Math.random() * 0.5, k: hwK++ });
        for (f = 0; f < 3; f++) hwMov.push({ u: 3 + f * 7.5, dir: e, v: 1.2 + Math.random() * 0.4, k: hwK++ });
      }
      hwMov.forEach(function (m) { if (m.dir === inb) { nIn++; far = Math.min(far, 26 - m.u); } else { nOut++; near = Math.min(near, m.u); } });
      if (nIn < 9 && far > 2.4) hwMov.push({ u: 26, dir: inb, v: 1.1 + Math.random() * 0.5, k: hwK++ });
      // wenig Verkehr aus der Stadt: Auto kommt unter dem Zolldach hervor (dort verdeckt)
      if (nOut < 3 && near > 3 && Math.random() < dt * 0.5) hwMov.push({ u: 5, dir: e, v: 1.2 + Math.random() * 0.4, k: hwK++ });
      for (i = hwMov.length - 1; i >= 0; i--) {
        var m = hwMov[i];
        m.u += (m.dir === e ? 1 : -1) * m.v * dt;
        if (m.u > 27) { hwMov.splice(i, 1); continue; }
        if (m.u <= -0.5) {   // Mitte des Anschlussfelds erreicht: weiter als Stadtauto
          hwMov.splice(i, 1);
          life.cars.unshift({ x: cg.hwTile[0], y: cg.hwTile[1], dir: inb, t: 0, v: m.v * 0.8, col: CARCOL[m.k % CARCOL.length], car: 1, type: m.type || MC.CARS[m.k % MC.CARS.length] });
          continue;
        }
        // Spur weich von Autobahn (0,3) auf Stadtstraße (0,15) überblenden
        var lane = 0.15 + 0.15 * Math.max(0, Math.min(1, (m.u + 0.5) / 2));
        car(m.k, m.u, m.dir, lane, m);
      }
    }
    return out;
  }
  function lifeStep(now) {
    var hw = G.visiting && !G.S.roads ? [] : highwayCars(now), city = lifeCity(now);
    if (!hw.length) return city;
    return city.concat(hw).sort(function (a, b) { return a.d - b.d; });
  }
  function lifeCity(now) {
    var S = G.S, dt = Math.min(0.1, (now - (life.last || now)) / 1000); life.last = now;
    var roads = S.roads.length, tenants = 0;
    if (roads < 3) { life.on = false; life.cars.length = 0; life.peds.length = 0; return []; }
    S.b.forEach(function (b) { if (MC.DEF[b.t].kind === 'house' && b.c) tenants += b.c.n || 0; });
    var wantCars = Math.min(140, Math.floor(roads / 6) + (tenants > 0 ? 1 : 0)), wantPeds = Math.min(140, Math.floor(tenants / 5) + (tenants > 0 ? 1 : 0));
    var sig = S.roads.length + ':' + (G.visiting ? 'v' : 'o');
    if (sig !== life.sig) { life.sig = sig; life.cars = life.cars.filter(function (c) { return G.isRoad(c.x, c.y); }); life.peds = life.peds.filter(function (c) { return G.isRoad(c.x, c.y); }); }
    while (life.cars.length < wantCars) spawnOn(life.cars, function (x, y, d) { return { x: x, y: y, dir: d, t: Math.random(), v: 0.9 + Math.random() * 0.6, col: CARCOL[Math.floor(Math.random() * CARCOL.length)], car: 1, type: MC.CARS[Math.floor(Math.random() * MC.CARS.length)] }; });
    while (life.peds.length < wantPeds) spawnOn(life.peds, function (x, y, d) { return { x: x, y: y, dir: d, t: Math.random(), v: 0.22 + Math.random() * 0.12, col: SHIRT[Math.floor(Math.random() * SHIRT.length)], side: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 6, pid: 1 + Math.floor(Math.random() * MC.PEOPLE) }; });
    life.cars.length = Math.min(life.cars.length, wantCars); life.peds.length = Math.min(life.peds.length, wantPeds);
    life.on = life.cars.length + life.peds.length > 0;
    var out = [], hwLink = !G.visiting || S.roads.length ? G.highwayLinked() : false, hwT = hwLink ? G.highwayTile() : null, hwE = hwLink ? G.coast().hw : -1;
    function move(o, i, list) {
      o.t += o.v * dt;
      while (o.t >= 1) {
        o.t -= 1; o.x += DIRS[o.dir][0]; o.y += DIRS[o.dir][1];
        if (!G.isRoad(o.x, o.y)) {
          list.splice(i, 1);
          if (o.car && hwLink && o.dir === hwE && o.x - DIRS[hwE][0] === hwT[0] && o.y - DIRS[hwE][1] === hwT[1])
            hwMov.push({ u: 0.5 + o.t, dir: hwE, v: Math.max(1.1, o.v), k: hwK++, type: o.type });   // auf die Autobahn
          return false;
        }
        var nd = nextDir(o.x, o.y, o.dir);
        if (o.car && hwLink && o.x === hwT[0] && o.y === hwT[1] && o.dir !== (hwE + 2) % 4 && Math.random() < 0.7) nd = hwE;   // raus aus der Stadt
        if (nd < 0) { list.splice(i, 1); return false; }
        o.dir = nd;
      }
      var dx = DIRS[o.dir][0], dy = DIRS[o.dir][1];
      // Mitte des Feldes -> Mitte des nächsten Feldes, versetzt auf die rechte Spur bzw. den Gehweg
      var off = o.car ? 0.15 : 0.43 * o.side;   // Spurmitte
      o.fx = o.x + 0.5 + dx * o.t - dy * off; o.fy = o.y + 0.5 + dy * o.t + dx * off;
      out.push({ o: o, d: o.fx + o.fy });
      return true;
    }
    for (var i = life.cars.length - 1; i >= 0; i--) move(life.cars[i], i, life.cars);
    for (i = life.peds.length - 1; i >= 0; i--) move(life.peds[i], i, life.peds);
    out.sort(function (a, b) { return a.d - b.d; });
    return out;
  }
  function P(x, y, z) { return [wx(x, y), wy(x, y) - (z || 0)]; }
  function quad(a, b, c, d, fill) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fillStyle = fill; g.fill(); }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255; return 'rgb(' + Math.round(r * f) + ',' + Math.round(gg * f) + ',' + Math.round(b * f) + ')'; }
  function box(x0, y0, x1, y1, z0, z1, col) {   // sichtbare Seiten eines achsparallelen Quaders: vorne-links (y1), vorne-rechts (x1), oben
    quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), shade(col, 0.82));
    quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), shade(col, 0.62));
    quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col);
  }
  // Richtung -> Grafik: O (rechts unten) = vorn, S (links unten) = vorn gespiegelt, N (rechts oben) = hinten, W (links oben) = hinten gespiegelt
  function dirSprite(prefix, dir) { var back = dir === 0 || dir === 3, flip = dir === 2 || dir === 3; return { im: A.img(prefix + (back ? '_hinten' : '_vorn')), flip: flip }; }
  function blit(im, x, y, flip, bottomOff, sc) {
    var w = im.lw * (sc || 1), h = im.lh * (sc || 1), c = tinted(im);
    if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(c, -w / 2, y - h + (bottomOff || 0), w, h); g.restore(); }
    else g.drawImage(c, x - w / 2, y - h + (bottomOff || 0), w, h);
  }
  // Halbe Fahrzeuglänge der Fable-Autos in Feldern (tools/svg/leben.py: Länge · 0,82 / 64); ihre Bodenmitte liegt 5,5 px über dem Ankerpunkt
  var CARLEN = { kleinwagen: 0.28, limousine: 0.38, lieferwagen: 0.36, taxi: 0.33, cabrio: 0.33 }, CARMID = 5.5;
  function carLights(o, sprite) {
    var L = NM.light; if (L < 0.02) return;
    var dx = DIRS[o.dir][0], dy = DIRS[o.dir][1];
    var a = sprite ? (CARLEN[o.type] || 0.33) : 0.2, b = sprite ? a : 0.21, up = sprite ? CARMID + 4.5 : 3, gy = sprite ? CARMID : 0;
    var fx = wx(o.fx + dx * a, o.fy + dy * a), fy = wy(o.fx + dx * a, o.fy + dy * a) - up;
    var ex = wx(o.fx + dx * (a + 0.55), o.fy + dy * (a + 0.55)), ey = wy(o.fx + dx * (a + 0.55), o.fy + dy * (a + 0.55)) - gy;
    g.save(); g.globalCompositeOperation = 'lighter';
    var mx = (fx + ex) / 2, my = (fy + ey + up - gy) / 2, hg = g.createRadialGradient(mx, my, 1, mx, my, 15);
    hg.addColorStop(0, 'rgba(255,240,190,' + (0.26 * L) + ')'); hg.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = hg; g.beginPath(); g.ellipse(mx, my, 15, 9, 0, 0, Math.PI * 2); g.fill();
    var front = o.dir === 1 || o.dir === 2;   // Front sichtbar (Grafik „vorn“), sonst Heck
    if (!sprite || front) { g.fillStyle = 'rgba(255,250,220,' + (0.9 * L) + ')'; g.beginPath(); g.arc(fx, fy, 1.3, 0, Math.PI * 2); g.fill(); }
    if (!sprite || !front) {
      var bx2 = wx(o.fx - dx * b, o.fy - dy * b), by2 = wy(o.fx - dx * b, o.fy - dy * b) - up;
      g.fillStyle = 'rgba(255,60,40,' + (0.9 * L) + ')'; g.beginPath(); g.arc(bx2, by2, 1.4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function drawAmb(a, now, vx0, vx1, vy0, vy1) {
    var o = a.o, sx = wx(o.fx, o.fy), sy = wy(o.fx, o.fy);
    if (sx < vx0 - 30 || sx > vx1 + 30 || sy < vy0 - 30 || sy > vy1 + 60) return;
    if (o.lamp) return drawLamp(o);
    if (o.car) {
      var cs0 = dirSprite('auto_' + o.type, o.dir);
      if (cs0.im) { blit(cs0.im, sx, sy, cs0.flip, 3.4, 0.82); carLights(o, true); return; }
      var along = o.dir % 2 === 1, L = 0.21, W = 0.11, x0, x1, y0, y1;   // halbe Länge/Breite in Feldern
      if (along) { x0 = o.fx - L; x1 = o.fx + L; y0 = o.fy - W; y1 = o.fy + W; } else { x0 = o.fx - W; x1 = o.fx + W; y0 = o.fy - L; y1 = o.fy + L; }
      g.beginPath(); g.ellipse(sx, sy + 1, 9, 4.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
      box(x0, y0, x1, y1, 1.5, 6, tintHex(o.col));
      // Kabine leicht nach hinten versetzt, Scheiben dunkel
      var dx = DIRS[o.dir][0], dy = DIRS[o.dir][1], cs = 0.6;
      var cx0 = o.fx - (o.fx - x0) * cs - dx * 0.03, cx1 = o.fx + (x1 - o.fx) * cs - dx * 0.03, cy0 = o.fy - (o.fy - y0) * cs - dy * 0.03, cy1 = o.fy + (y1 - o.fy) * cs - dy * 0.03;
      box(cx0, cy0, cx1, cy1, 6, 9.5, tintHex('#2d4a6e'));
      quad(P(cx0, cy0, 9.5), P(cx1, cy0, 9.5), P(cx1, cy1, 9.5), P(cx0, cy1, 9.5), tintHex(o.col));
      carLights(o);
    } else {
      var pim = A.img('person_' + o.pid + '_' + (Math.floor(now / 220 + o.ph) % 2 + 1));
      if (pim) { blit(pim, sx, sy, o.dir === 2 || o.dir === 3, 0); return; }
      var bob = Math.abs(Math.sin(now / 160 + o.ph)) * 1.2, step = Math.sin(now / 160 + o.ph) * 1.1;
      g.beginPath(); g.ellipse(sx, sy, 2.6, 1.3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
      g.strokeStyle = '#3a3f4a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(sx - 0.7, sy - 3.5); g.lineTo(sx - 0.7 + step * 0.6, sy); g.moveTo(sx + 0.7, sy - 3.5); g.lineTo(sx + 0.7 - step * 0.6, sy); g.stroke();
      g.fillStyle = tintHex(o.col); g.fillRect(sx - 1.6, sy - 7.6 - bob, 3.2, 4.4);
      g.beginPath(); g.arc(sx, sy - 9.2 - bob, 1.5, 0, Math.PI * 2); g.fillStyle = '#f0c8a0'; g.fill();
    }
  }
  // Boote: ziehen auf einem Rundkurs um die Insel (Felder außerhalb der Karte)
  var BOATS = [{ p: 0.05, v: 0.006, col: '#ffffff' }, { p: 0.4, v: 0.004, col: '#e0533d' }, { p: 0.72, v: 0.005, col: '#f2b632' }];
  function boats(now) {
    var cg = coast(), t = now / 1000;
    BOATS.forEach(function (bo, k) {
      var span = N + 16, ph = ((bo.p + t * bo.v) % 2 + 2) % 2, fwd = ph < 1, pos = -8 + (fwd ? ph : 2 - ph) * span;
      var u = cg.cu(pos) + 2.5 + k * 1.6, p = E(cg.sea, pos, u), q = E(cg.sea, pos + (fwd ? 1 : -1), u);
      var dx = Math.sign(Math.round(q[0] - p[0])), dy = Math.sign(Math.round(q[1] - p[1])), x = p[0], y = p[1];
      var sx = wx(x, y), sy = wy(x, y) + Math.sin(t * 2 + k) * 1.2;
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4;
      var bx = wx(x - dx * 0.9, y - dy * 0.9), by = wy(x - dx * 0.9, y - dy * 0.9);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(bx - 4, by + 2); g.moveTo(sx, sy); g.lineTo(bx + 4, by + 2); g.stroke();
      var dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0, typ = MC.BOATS[k % MC.BOATS.length], bs = dirSprite('boot_' + typ, dir);
      if (bs.im) { blit(bs.im, sx, sy, bs.flip, 6); return; }
      var along = dx !== 0, L = 0.38, W = 0.14;
      var x0 = along ? x - L : x - W, x1 = along ? x + L : x + W, y0 = along ? y - W : y - L, y1 = along ? y + W : y + L;
      box(x0, y0, x1, y1, -1, 4, tintHex(bo.col));
      box(x - 0.1 - dx * 0.08, y - 0.1 - dy * 0.08, x + 0.1 - dx * 0.08, y + 0.1 - dy * 0.08, 4, 9, tintHex('#dfe7f2'));
    });
  }

  // ---------- Küstenstadt: Gelände um die Karte, je Stadt per Seed ----------
  // Kanten: 0 = y=0 (oben rechts), 1 = x=N (unten rechts), 2 = y=N (unten links), 3 = x=0 (oben links).
  // E(kante, t, u): Punkt t entlang der Kante, u Felder nach außen. Bebaubare Fläche bleibt unverändert.
  function E(e, t, u) { return e === 0 ? [t, -u] : e === 1 ? [N + u, t] : e === 2 ? [t, N + u] : [-u, t]; }
  var rng = G.rng;
  function coast() { return G.coast(); }
  function polyPath(pts) { g.moveTo(wx(pts[0][0], pts[0][1]), wy(pts[0][0], pts[0][1])); for (var i = 1; i < pts.length; i++) g.lineTo(wx(pts[i][0], pts[i][1]), wy(pts[i][0], pts[i][1])); g.closePath(); }
  function band(e, f0, f1, far) {   // Fläche zwischen u = f0(t) und u = f1(t) entlang Kante e (über die Ecken hinaus)
    var pts = [], t;
    for (t = -far; t <= N + far; t += 1) pts.push(E(e, t, f0(t)));
    for (t = N + far; t >= -far; t -= 1) pts.push(E(e, t, f1(t)));
    return pts;
  }
  function drawCoast(now, vx0, vx1, vy0, vy1) {
    var cg = coast(), far = 70, i;
    // Land ringsum (Wiese), darüber Strand/Meer und Fels/Berg
    g.fillStyle = pat('boden_wild') || '#62a85a'; g.fillRect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4);
    // Bergseite: Fels-Hang, dann Berg
    g.beginPath(); polyPath(band(cg.mount, function () { return 0.4; }, function (t) { return cg.mu(t); }, far)); g.fillStyle = pat('boden_fels') || '#9a8f7c'; g.fill();
    g.beginPath(); polyPath(band(cg.mount, function (t) { return cg.mu(t); }, function () { return far; }, far)); g.fillStyle = pat('boden_berg') || '#7d7466'; g.fill();
    // Meerseite: Dünen, Strand, Wasser (Wellengang), Brandung
    g.beginPath(); polyPath(band(cg.sea, function () { return 0.15; }, function (t) { return cg.du(t); }, far)); g.fillStyle = pat('boden_duene') || '#d9cf9c'; g.fill();
    g.beginPath(); polyPath(band(cg.sea, function (t) { return cg.du(t); }, function (t) { return cg.cu(t); }, far)); g.fillStyle = pat('boden_strand') || '#ecdca5'; g.fill();
    var water = band(cg.sea, function (t) { return cg.cu(t); }, function () { return far; }, far), pw = pat('wasser');
    g.save(); g.beginPath(); polyPath(water); g.clip();
    if (pw) { g.translate((now / 120) % 128, 0); g.fillStyle = pw; g.fillRect(vx0 - 130, vy0 - 2, vx1 - vx0 + 260, vy1 - vy0 + 4); }
    else { g.fillStyle = '#3f9ec4'; g.fillRect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4); }
    g.restore();
    // nasser Sand + Schaumlinie
    g.beginPath(); polyPath(band(cg.sea, function (t) { return cg.cu(t) - 0.35; }, function (t) { return cg.cu(t); }, far)); g.fillStyle = 'rgba(160,140,90,.25)'; g.fill();
    var w = Math.sin(now / 900) * 0.08;
    g.beginPath(); for (var t = -far; t <= N + far; t += 0.5) { var p = E(cg.sea, t, cg.cu(t) + 0.12 + w + Math.sin(t * 2.3 + now / 700) * 0.04); if (t === -far) g.moveTo(wx(p[0], p[1]), wy(p[0], p[1])); else g.lineTo(wx(p[0], p[1]), wy(p[0], p[1])); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6; g.stroke();
    // Autobahn von weit draußen bis an den Kartenrand
    var linked = G.highwayLinked(), e = cg.hw, along = e === 0 || e === 2 ? 5 : 10, endMask = e === 0 ? 1 : e === 1 ? 2 : e === 2 ? 4 : 8;
    for (var u = 1; u <= 40; u++) {
      var tp = E(e, cg.hwPos, u - 1), tx = Math.floor(tp[0] + (e === 3 ? -1e-9 : 0)), ty = Math.floor(tp[1]);
      if (e === 0) ty = -u; else if (e === 1) tx = N + u - 1; else if (e === 2) ty = N + u - 1; else tx = -u;
      var rx = wx(tx, ty), ry = wy(tx, ty);
      if (rx < vx0 - 70 || rx > vx1 + 70 || ry < vy0 - 70 || ry > vy1 + 40) continue;
      // letzte Kachel: ohne Anschluss Endstück; angeschlossen Übergang zur Stadtstraße (Auffahrt N->S, für W gespiegelt), sonst durchgehend
      var flipT = false, id = 'autobahn_' + along;
      if (u === 1) {
        if (!linked) id = 'autobahn_' + endMask;
        else if ((e === 0 || e === 3) && A.img('auffahrt')) { id = 'auffahrt'; flipT = e === 3; }
      }
      var im = A.img(id);
      if (im && flipT) { g.save(); g.translate(rx, 0); g.scale(-1, 1); g.drawImage(im, -im.lw / 2, ry - (im.lh - 32), im.lw, im.lh); g.restore(); }
      else if (im) g.drawImage(im, rx - im.lw / 2, ry - (im.lh - 32), im.lw, im.lh);
      else { diamond(tx, ty, tx + 1, ty + 1); g.fillStyle = '#4a515c'; g.fill(); }
    }
  }
  // Objekte außerhalb der Karte: Wald auf den Landseiten, Felsen/Berge, Leuchtturm, Zollstation
  function coastItems() {
    var cg = coast(), r = rng(cg.seed ^ 0x51ed), k, e, i;
    function add(id, x, y, size, flip, sc) {
      var c = A.img(id); if (!c) return; sc = sc || 1;
      var w = c.lw * sc, h = c.lh * sc, base = size * 32 * sc;
      items.push({ sp: { c: c, w: w, h: h, ox: w / 2, oy: h - base, top: h - base }, sx: wx(x, y), sy: wy(x, y), depth: x + y + size * sc, flip: flip, deco: id });
    }
    // Landseiten: Wald, dichter weiter draußen
    [ (cg.sea + 1) % 4, (cg.sea + 3) % 4 ].forEach(function (e2) {
      for (i = 0; i < 70; i++) {
        var t = Math.floor(r() * (N + 20)) - 10, u = 1 + Math.floor(Math.pow(r(), 0.7) * 14), p = E(e2, t, u);
        if (e2 === cg.hw && Math.abs(t - cg.hwPos) < 3) continue;   // Autobahn freihalten
        if (!treeSp) treeSp = makeTree();
        items.push({ tree: true, sp: treeSp[i % treeSp.length], sx: wx(p[0], p[1]), sy: wy(p[0], p[1]), depth: p[0] + p[1] + 1 });
      }
    });
    // Bergseite als geschlossene Bergkette: festes 2×2-Raster, Reihe hinter Reihe, keine Überlappung.
    // Vorne niedrige Stufen/Grate, in der Mitte Tafelberge, hinten Grate; Spitzen nur selten als Akzent.
    // Einzelne Felsbrocken nur in kleinen Gruppen am Fuß des Hangs.
    // Reihen werden nach hinten größer und lockerer: vorne Stufen, Mitte Tafelberge, hinten hohe Grate.
    var ROWS = [[1, [3, 3, 4]], [1.5, [3, 1, 1]], [2.1, [1, 1, 4]], [2.6, [4, 1, 4, 2]]], u0 = 0;
    ROWS.forEach(function (rw, ri) {
      var sc = rw[0], step = 2 * sc * 0.9, off = r() * step;
      for (var t2 = -16 + off; t2 < N + 16; t2 += step * (0.85 + r() * 0.3)) {
        if (ri === 0 && r() < 0.35) continue;   // vorderste Reihe locker, Hang bleibt sichtbar
        var u2 = Math.ceil(cg.mu(t2)) + u0 + r() * 0.8, p2 = E(cg.mount, t2, u2), v = rw[1][Math.floor(r() * rw[1].length)];
        add('berg_' + v, Math.floor(p2[0]), Math.floor(p2[1]), 2, r() < 0.5, sc);
      }
      u0 += 2 * sc * 0.8;
    });
    for (i = 0; i < 9; i++) {
      var t1 = Math.floor(r() * (N + 10)) - 5, n1 = 2 + Math.floor(r() * 2);
      for (var j = 0; j < n1; j++) { var p1 = E(cg.mount, t1 + j, Math.max(0.6, cg.mu(t1 + j) - 0.8 + (j % 2) * 0.5)); add('fels_' + (1 + (i + j) % 3), Math.floor(p1[0]), Math.floor(p1[1]), 1); }
    }
    // Klippen an einigen Stellen der Küste, Leuchtturm auf einer Landzunge
    var back = cg.sea === 0 || cg.sea === 3, flip = cg.sea === 1 || cg.sea === 0;
    for (i = 0; i < 6; i++) { var t3 = Math.floor(r() * N), p3 = E(cg.sea, t3, cg.cu(t3) - 0.6); add((back ? 'klippe_hinten_' : 'klippe_') + (1 + i % 2), Math.floor(p3[0]), Math.floor(p3[1]), 1, flip); }
    var pl = E(cg.sea, cg.light, cg.cu(cg.light) - 1.6); add('leuchtturm', Math.floor(pl[0]), Math.floor(pl[1]), 2);
    // Zollstation über der Autobahn (Grafik zeigt die Autobahn von N nach S; für die anderen Kanten gespiegelt)
    var e3 = cg.hw, pz = e3 === 0 ? [cg.hwPos - 1, -6] : e3 === 1 ? [N + 3, cg.hwPos - 1] : e3 === 2 ? [cg.hwPos - 1, N + 3] : [-6, cg.hwPos - 1];
    add('zoll', pz[0], pz[1], 3, e3 === 1 || e3 === 3);
  }


  // Vogelschwarm: ab und zu ein paar „V“ quer über den sichtbaren Ausschnitt
  var flock = null;
  function birds(now, vx0, vx1, vy0, vy1) {
    if (!flock) {
      if (Math.random() < 0.0015) { var dir = Math.random() < 0.5 ? 1 : -1; flock = { t0: now, x0: dir > 0 ? vx0 - 60 : vx1 + 60, y: vy0 + (vy1 - vy0) * (0.15 + Math.random() * 0.4), dir: dir, n: 3 + Math.floor(Math.random() * 4) }; }
      return;
    }
    var age = (now - flock.t0) / 1000, bx = flock.x0 + flock.dir * age * 45;   // 45 Welt-Pixel je Sekunde
    if (age > 40) { flock = null; return; }
    var im1 = A.img('vogel_1'), im2 = A.img('vogel_2');
    g.strokeStyle = 'rgba(30,40,55,.75)'; g.lineWidth = 1.3; g.lineCap = 'round';
    for (var i = 0; i < flock.n; i++) {
      var x = bx - flock.dir * i * 14, y = flock.y + (i % 2 ? 7 : -3) + Math.sin(now / 300 + i) * 2;
      if (x < vx0 - 30 || x > vx1 + 30 || y < vy0 - 30 || y > vy1 + 30) continue;
      if (im1 && im2) { var im = Math.floor(now / 180 + i) % 2 ? im1 : im2; blit(im, x, y + im.lh / 2, flock.dir < 0, 0); continue; }
      var w = Math.sin(now / 120 + i) * 2.2;
      g.beginPath(); g.moveTo(x - 5, y - w); g.quadraticCurveTo(x - 2, y - 1.5, x, y); g.quadraticCurveTo(x + 2, y - 1.5, x + 5, y - w); g.stroke();
    }
  }


  // Ausbaustufe ohne eigene Grafik (noch nicht von Fable): kleine Sterne über dem Haus
  function stars(it) {
    var x = it.sx, y = it.sy - Math.min(it.sp.top, 120) + 6;
    for (var i = 0; i < it.stars; i++) {
      var cx = x + (i - (it.stars - 1) / 2) * 11;
      g.beginPath();
      for (var k = 0; k < 10; k++) { var r = k % 2 ? 2.4 : 5.5, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#f2b632'; g.fill(); g.strokeStyle = 'rgba(90,60,0,.7)'; g.lineWidth = 1; g.stroke();
    }
  }

  function drawSite(it, t) {
    var n = it.d.size, b = it.b;
    var pr = Math.max(0, Math.min(1, (t - b.cs) / Math.max(1, b.cu - b.cs)));
    diamond(b.x + 0.04, b.y + 0.04, b.x + n - 0.04, b.y + n - 0.04);
    g.fillStyle = '#c9a871'; g.fill(); g.strokeStyle = '#f2b632'; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
    var sp = it.sp, spc = tinted(sp.c);
    // Gebäude wächst von unten nach oben aus dem Gerüst
    var cut = (sp.h - n * 2 * HH) * (1 - pr);
    g.globalAlpha = 0.28; g.drawImage(spc, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
    g.globalAlpha = 0.95;
    var kx = sp.c.width / sp.w, ky = sp.c.height / sp.h;
    g.drawImage(spc, 0, cut * ky, sp.w * kx, (sp.h - cut) * ky, it.sx - sp.ox, it.sy - sp.oy + cut, sp.w, sp.h - cut);
    g.globalAlpha = 1;
    // Baugerüst (assets/sprites/baustelle_<größe>.svg), gleiche Regel wie Gebäude
    var sc = A.img('baustelle_' + n);
    if (sc) g.drawImage(sc, it.sx - sc.lw / 2, it.sy - (sc.lh - n * 32), sc.lw, sc.lh);
  }
  function progress(o, t, k) {
    var b = o.b, pr = Math.max(0, Math.min(1, (t - b.cs) / Math.max(1, b.cu - b.cs)));
    var w = 54 * k, h = 9 * k, x = o.ix - w / 2, y = o.iy - 4 * k;
    rr(x, y, w, h, h / 2); g.fillStyle = 'rgba(15,25,45,.8)'; g.fill();
    rr(x + 1.5 * k, y + 1.5 * k, Math.max(h - 3 * k, (w - 3 * k) * pr), h - 3 * k, (h - 3 * k) / 2); g.fillStyle = '#f2b632'; g.fill();
    g.font = '700 ' + (10.5 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(15,25,45,.85)'; g.lineJoin = 'round';
    var txt = MC.dur(b.cu - t);
    g.strokeText(txt, o.ix, y - 4 * k); g.fillStyle = '#fff'; g.fillText(txt, o.ix, y - 4 * k);
  }
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function bubble(x, y, k, fill, ring) {
    g.beginPath(); g.moveTo(x, y + 19 * k); g.lineTo(x - 6 * k, y + 10 * k); g.lineTo(x + 6 * k, y + 10 * k); g.closePath();
    g.fillStyle = ring; g.fill();
    g.beginPath(); g.arc(x, y, 14 * k, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    g.lineWidth = 2.2 * k; g.strokeStyle = ring; g.stroke();
  }
  var ICON_ASSET = { coin: 'symbol_miete', coinwarn: 'symbol_miete', contract: 'symbol_vertrag', expired: 'symbol_verfallen', noroad: 'symbol_strasse', nocust: 'symbol_kunden' };
  function icon(type, x, y, k, now) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (type === 'coinwarn') {
      var pw = (now % 900) / 900;
      g.beginPath(); g.arc(x, y, (15 + pw * 10) * k, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(240,60,50,' + (1 - pw) + ')'; g.lineWidth = 3 * k; g.stroke();
    }
    var ai = A.img(ICON_ASSET[type]);
    if (ai) { var s = 40 * k; g.drawImage(ai, x - s / 2, y - s / 2, s, s); return; }
    if (type === 'coin' || type === 'coinwarn') {
      if (false) {
        var pu = (now % 900) / 900;
        g.beginPath(); g.arc(x, y, (15 + pu * 10) * k, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(240,60,50,' + (1 - pu) + ')'; g.lineWidth = 3 * k; g.stroke();
      }
      g.beginPath(); g.arc(x, y + 1.5 * k, 14 * k, 0, Math.PI * 2); g.fillStyle = '#a8750f'; g.fill();
      var gr = g.createLinearGradient(x, y - 14 * k, x, y + 14 * k);
      gr.addColorStop(0, '#ffe680'); gr.addColorStop(1, '#f0a81c');
      g.beginPath(); g.arc(x, y, 14 * k, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
      g.beginPath(); g.arc(x, y, 10.5 * k, 0, Math.PI * 2); g.strokeStyle = 'rgba(150,95,0,.55)'; g.lineWidth = 1.2 * k; g.stroke();
      g.font = '900 ' + (17 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#8a5a00'; g.fillText('$', x, y + 6 * k);
    } else if (type === 'contract') {
      bubble(x, y, k, '#ffffff', '#2b7de9');
      g.strokeStyle = '#2b7de9'; g.lineWidth = 2 * k;
      g.strokeRect(x - 5.5 * k, y - 7.5 * k, 11 * k, 15 * k);
      g.beginPath(); g.moveTo(x - 2.5 * k, y - 3 * k); g.lineTo(x + 2.5 * k, y - 3 * k); g.moveTo(x - 2.5 * k, y + 0.5 * k); g.lineTo(x + 2.5 * k, y + 0.5 * k);
      g.moveTo(x - 2.5 * k, y + 4 * k); g.lineTo(x + 0.5 * k, y + 4 * k); g.stroke();
    } else if (type === 'expired') {
      bubble(x, y, k, '#fff1f0', '#d93025');
      g.strokeStyle = '#d93025'; g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(x, y - 7 * k); g.lineTo(x, y + 1.5 * k); g.stroke();
      g.beginPath(); g.arc(x, y + 6.5 * k, 1.7 * k, 0, Math.PI * 2); g.fillStyle = '#d93025'; g.fill();
    } else if (type === 'noroad') {
      bubble(x, y, k, '#fff7e0', '#e08a00');
      g.fillStyle = '#5a626e'; g.beginPath(); g.moveTo(x - 3 * k, y - 8 * k); g.lineTo(x + 3 * k, y - 8 * k); g.lineTo(x + 7 * k, y + 8 * k); g.lineTo(x - 7 * k, y + 8 * k); g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.6 * k; g.setLineDash([3 * k, 3 * k]);
      g.beginPath(); g.moveTo(x, y - 7 * k); g.lineTo(x, y + 8 * k); g.stroke(); g.setLineDash([]);
    } else if (type === 'nocust') {
      bubble(x, y, k, '#eef1f5', '#8a94a3');
      g.fillStyle = '#8a94a3'; g.beginPath(); g.arc(x, y - 3.5 * k, 3.6 * k, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, y + 9 * k, 7 * k, Math.PI, 0); g.fill();
    }
  }
  function sign(x, y, lp) {
    var k = Math.max(0.9, Math.min(2.4, 1 / cam.z));
    var t1 = 'Zu verkaufen', t2 = MC.short(lp[0]) + ' $' + (lp[1] ? ' + ' + lp[1] + ' Gold' : '');
    g.font = '800 ' + (13 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif';
    var w = Math.max(g.measureText(t2).width, 80 * k) + 22 * k, h = 40 * k;
    g.fillStyle = '#6b4a2b'; g.fillRect(x - 2 * k, y - 8 * k, 4 * k, 22 * k);
    rr(x - w / 2, y - h - 6 * k, w, h, 9 * k); g.fillStyle = '#fffaf0'; g.fill(); g.strokeStyle = '#d7a531'; g.lineWidth = 2.5 * k; g.stroke();
    g.textAlign = 'center';
    g.font = '700 ' + (10 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#8a6a1c'; g.fillText(t1.toUpperCase(), x, y - h + 10 * k);
    g.font = '800 ' + (13 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#1d2b44'; g.fillText(t2, x, y - h + 26 * k);
  }
  function ghostLabel(q, gs) {
    var d = q.def, txt = null, mid = q.moving ? q.moving.id : 0, warn = false;
    if (!V.ghostOk()) {
      var foreign = false;
      for (var gx = 0; gx < d.size; gx++) for (var gy = 0; gy < d.size; gy++) if (!G.owned(q.x + gx, q.y + gy)) foreign = true;
      txt = foreign ? 'Noch nicht dein Land' : 'Platz belegt'; warn = true;
    }
    else if (q.moving && !(q.moving.x === q.x && q.moving.y === q.y)) {
      var fee = G.moveFee(q.moving);
      txt = fee ? 'Umzug ' + MC.money(fee) : 'Umzug kostenlos';
    } else if (d.kind === 'house') {
      if (!G.touchesRoad(d, q.x, q.y)) { txt = 'Kein Straßenanschluss'; warn = true; }
      else txt = 'Deko-Bonus +' + G.bonusAt(d, q.x, q.y, mid) + ' %';
    } else if (d.kind === 'shop') {
      if (!G.touchesRoad(d, q.x, q.y)) { txt = 'Kein Straßenanschluss'; warn = true; }
      else txt = G.customers({ x: q.x, y: q.y }, d) + ' Kunden';
    } else if (d.kind === 'deco') {
      var n = 0, S = G.S;
      for (var i = 0; i < S.b.length; i++) { var h = S.b[i], dh = MC.DEF[h.t]; if (dh.kind === 'house' && G.inReach(q, d, d.reach, h, dh)) n++; }
      txt = '+' + d.bonus + ' % für ' + n + (n === 1 ? ' Haus' : ' Häuser');
    }
    if (!txt) return;
    var k = iconScale(), x = wx(q.x, q.y), y = V.flat ? wy(q.x, q.y) - 6 * k : wy(q.x, q.y) - Math.min(gs.top, 150) - 10 * k;
    g.font = '700 ' + (12 * k) + 'px -apple-system, "Segoe UI", system-ui, sans-serif';
    var w = g.measureText(txt).width + 18 * k;
    // im sichtbaren Bereich halten (am Bildschirmrand nicht abschneiden)
    var vl = cam.x - W / 2 / cam.z + 8 / cam.z, vr = cam.x + W / 2 / cam.z - 8 / cam.z, vt = cam.y - H / 2 / cam.z + 70 / cam.z;
    x = Math.max(vl + w / 2, Math.min(vr - w / 2, x)); y = Math.max(vt + 16 * k, y);
    rr(x - w / 2, y - 16 * k, w, 22 * k, 11 * k); g.fillStyle = warn ? 'rgba(190,40,30,.94)' : 'rgba(15,25,45,.88)'; g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(txt, x, y - 0.5 * k);
  }
})();
