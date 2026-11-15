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
      if (type === 'build' || type === 'move' || type === 'demolish' || type === 'land' || type === 'reset' || type === 'built' || type === 'visit') itemsDirty = true;
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
    cam.z = Math.max(0.3, Math.min(2.6, cam.z));
    var m = N * HW;
    cam.x = Math.max(-m, Math.min(m, cam.x));
    cam.y = Math.max(0, Math.min(N * 2 * HH, cam.y));
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
      V.setMode('move');
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
  V.focus = function (b) {
    var d = MC.DEF[b.t];
    cam.x = wx(b.x + d.size / 2, b.y + d.size / 2); cam.y = wy(b.x + d.size / 2, b.y + d.size / 2);
  };

  // ---------- Eingabe ----------
  function bindInput() {
    var pts = {}, n = 0, moved = false, start = null, pinch = null, painting = null, dragGhost = false, lastPaint = null, brushing = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    cv.addEventListener('pointerdown', function (e) {
      V.kick();
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
      items.push({ b: b, d: d, sp: A.sprite(b.t), sx: wx(b.x, b.y), sy: wy(b.x, b.y), depth: b.x + b.y + d.size });
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
      var o = 0.6;
      // Meer: Bildschirm minus Insel (gerade-ungerade-Regel)
      g.beginPath(); g.rect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4); diamondPath(-o, -o, N + o, N + o);
      if (pw) {   // Wellengang: Muster wandert langsam seitlich
        g.save(); g.clip('evenodd'); g.translate((now / 120) % 128, 0); g.fillStyle = pw;
        g.fillRect(vx0 - 130, vy0 - 2, vx1 - vx0 + 260, vy1 - vy0 + 4); g.restore();
      } else { g.fillStyle = '#3f9ec4'; g.fill('evenodd'); }
      // Inselschatten (nur der Streifen unter der Kante)
      g.beginPath(); diamondPath(-o, -o + 10 / 32, N + o, N + o + 10 / 32); diamondPath(-o, -o, N + o, N + o);
      g.fillStyle = '#2a779c'; g.fill('evenodd');
      // Strand: Ring zwischen Inselrand und Spielfläche
      g.beginPath(); diamondPath(-o, -o, N + o, N + o); diamondPath(0, 0, N, N);
      g.fillStyle = pat('boden_strand') || '#ecdca5'; g.fill('evenodd');
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
    var roads = S.roads, plain = [];
    g.fillStyle = '#5a626e'; g.strokeStyle = '#5a626e'; g.lineWidth = 1;
    for (i = 0; i < roads.length; i++) {
      x = roads[i] % N; y = (roads[i] - x) / N;
      var rx = wx(x, y), ry = wy(x, y);
      if (rx < vx0 - 40 || rx > vx1 + 40 || ry < vy0 - 40 || ry > vy1 + 8) continue;
      var mask = (G.isRoad(x, y - 1) ? 1 : 0) | (G.isRoad(x + 1, y) ? 2 : 0) | (G.isRoad(x, y + 1) ? 4 : 0) | (G.isRoad(x - 1, y) ? 8 : 0);
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
    var amb = V.flat || V.dbg.noLife ? [] : lifeStep(now), ai = 0;
    for (i = 0; i < (V.dbg.noItems ? 0 : items.length); i++) {
      var it = items[i], sp = it.sp;
      if (V.flat) continue;
      while (ai < amb.length && amb[ai].d < it.depth) drawAmb(amb[ai++], now, vx0, vx1, vy0, vy1);
      if (!gDrawn && it.depth > gDepth) drawGhost();
      if (it.sx + sp.w < vx0 || it.sx - sp.w > vx1 || it.sy + sp.h < vy0 || it.sy - sp.oy > vy1) continue;
      if (it.b && it.b.id === movingId) { g.globalAlpha = 0.25; g.drawImage(sp.c, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h); g.globalAlpha = 1; continue; }
      if (it.b && it.st === 'build') { drawSite(it, t); continue; }
      g.drawImage(sp.c, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
      if (it.d && it.d.friend) flags(it, now);
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
  function lifeStep(now) {
    var S = G.S, dt = Math.min(0.1, (now - (life.last || now)) / 1000); life.last = now;
    var roads = S.roads.length, tenants = 0;
    if (roads < 3) { life.on = false; life.cars.length = 0; life.peds.length = 0; return []; }
    S.b.forEach(function (b) { if (MC.DEF[b.t].kind === 'house' && b.c) tenants += b.c.n || 0; });
    var wantCars = Math.min(36, Math.floor(roads / 7) + (tenants > 0 ? 1 : 0)), wantPeds = Math.min(40, Math.floor(tenants / 6) + (tenants > 0 ? 1 : 0));
    var sig = S.roads.length + ':' + (G.visiting ? 'v' : 'o');
    if (sig !== life.sig) { life.sig = sig; life.cars = life.cars.filter(function (c) { return G.isRoad(c.x, c.y); }); life.peds = life.peds.filter(function (c) { return G.isRoad(c.x, c.y); }); }
    while (life.cars.length < wantCars) spawnOn(life.cars, function (x, y, d) { return { x: x, y: y, dir: d, t: Math.random(), v: 0.9 + Math.random() * 0.6, col: CARCOL[Math.floor(Math.random() * CARCOL.length)], car: 1 }; });
    while (life.peds.length < wantPeds) spawnOn(life.peds, function (x, y, d) { return { x: x, y: y, dir: d, t: Math.random(), v: 0.22 + Math.random() * 0.12, col: SHIRT[Math.floor(Math.random() * SHIRT.length)], side: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 6 }; });
    life.cars.length = Math.min(life.cars.length, wantCars); life.peds.length = Math.min(life.peds.length, wantPeds);
    life.on = life.cars.length + life.peds.length > 0;
    var out = [];
    function move(o, i, list) {
      o.t += o.v * dt;
      while (o.t >= 1) {
        o.t -= 1; o.x += DIRS[o.dir][0]; o.y += DIRS[o.dir][1];
        if (!G.isRoad(o.x, o.y)) { list.splice(i, 1); return false; }
        var nd = nextDir(o.x, o.y, o.dir); if (nd < 0) { list.splice(i, 1); return false; }
        o.dir = nd;
      }
      var dx = DIRS[o.dir][0], dy = DIRS[o.dir][1];
      // Mitte des Feldes -> Mitte des nächsten Feldes, versetzt auf die rechte Spur bzw. den Gehweg
      var off = o.car ? 0.2 : 0.43 * o.side;
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
  function drawAmb(a, now, vx0, vx1, vy0, vy1) {
    var o = a.o, sx = wx(o.fx, o.fy), sy = wy(o.fx, o.fy);
    if (sx < vx0 - 20 || sx > vx1 + 20 || sy < vy0 - 20 || sy > vy1 + 20) return;
    if (o.car) {
      var along = o.dir % 2 === 1, L = 0.21, W = 0.11, x0, x1, y0, y1;   // halbe Länge/Breite in Feldern
      if (along) { x0 = o.fx - L; x1 = o.fx + L; y0 = o.fy - W; y1 = o.fy + W; } else { x0 = o.fx - W; x1 = o.fx + W; y0 = o.fy - L; y1 = o.fy + L; }
      g.beginPath(); g.ellipse(sx, sy + 1, 9, 4.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
      box(x0, y0, x1, y1, 1.5, 6, o.col);
      // Kabine leicht nach hinten versetzt, Scheiben dunkel
      var dx = DIRS[o.dir][0], dy = DIRS[o.dir][1], cs = 0.6;
      var cx0 = o.fx - (o.fx - x0) * cs - dx * 0.03, cx1 = o.fx + (x1 - o.fx) * cs - dx * 0.03, cy0 = o.fy - (o.fy - y0) * cs - dy * 0.03, cy1 = o.fy + (y1 - o.fy) * cs - dy * 0.03;
      box(cx0, cy0, cx1, cy1, 6, 9.5, '#2d4a6e');
      quad(P(cx0, cy0, 9.5), P(cx1, cy0, 9.5), P(cx1, cy1, 9.5), P(cx0, cy1, 9.5), o.col);
    } else {
      var bob = Math.abs(Math.sin(now / 160 + o.ph)) * 1.2, step = Math.sin(now / 160 + o.ph) * 1.1;
      g.beginPath(); g.ellipse(sx, sy, 2.6, 1.3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
      g.strokeStyle = '#3a3f4a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(sx - 0.7, sy - 3.5); g.lineTo(sx - 0.7 + step * 0.6, sy); g.moveTo(sx + 0.7, sy - 3.5); g.lineTo(sx + 0.7 - step * 0.6, sy); g.stroke();
      g.fillStyle = o.col; g.fillRect(sx - 1.6, sy - 7.6 - bob, 3.2, 4.4);
      g.beginPath(); g.arc(sx, sy - 9.2 - bob, 1.5, 0, Math.PI * 2); g.fillStyle = '#f0c8a0'; g.fill();
    }
  }
  // Boote: ziehen auf einem Rundkurs um die Insel (Felder außerhalb der Karte)
  var BOATS = [{ p: 0.05, v: 0.006, col: '#ffffff' }, { p: 0.4, v: 0.004, col: '#e0533d' }, { p: 0.72, v: 0.005, col: '#f2b632' }];
  function boats(now) {
    var ring = 2.6, lo = -ring, hi = N + ring, len = (hi - lo) * 4, t = now / 1000;
    BOATS.forEach(function (b, k) {
      var s = ((b.p + t * b.v) % 1 + 1) % 1 * len, side = Math.floor(s / (hi - lo)), u = s % (hi - lo), x, y, dx, dy;
      if (side === 0) { x = lo + u; y = lo; dx = 1; dy = 0; } else if (side === 1) { x = hi; y = lo + u; dx = 0; dy = 1; }
      else if (side === 2) { x = hi - u; y = hi; dx = -1; dy = 0; } else { x = lo; y = hi - u; dx = 0; dy = -1; }
      var sx = wx(x, y), sy = wy(x, y) + Math.sin(t * 2 + k) * 1.2;
      // Kielwasser
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4;
      var bx = wx(x - dx * 0.9, y - dy * 0.9), by = wy(x - dx * 0.9, y - dy * 0.9);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(bx - 4, by + 2); g.moveTo(sx, sy); g.lineTo(bx + 4, by + 2); g.stroke();
      var along = dx !== 0, L = 0.38, W = 0.14;
      var x0 = along ? x - L : x - W, x1 = along ? x + L : x + W, y0 = along ? y - W : y - L, y1 = along ? y + W : y + L;
      box(x0, y0, x1, y1, -1, 4, b.col);
      box(x - 0.1 - dx * 0.08, y - 0.1 - dy * 0.08, x + 0.1 - dx * 0.08, y + 0.1 - dy * 0.08, 4, 9, '#dfe7f2');
    });
  }
  // Vogelschwarm: ab und zu ein paar „V“ quer über den sichtbaren Ausschnitt
  var flock = null;
  function birds(now, vx0, vx1, vy0, vy1) {
    if (!flock) { if (Math.random() < 0.0015) flock = { t0: now, y: vy0 + (vy1 - vy0) * (0.15 + Math.random() * 0.4), dir: Math.random() < 0.5 ? 1 : -1, n: 3 + Math.floor(Math.random() * 4) }; return; }
    var span = vx1 - vx0, k = (now - flock.t0) / 14000;
    if (k > 1) { flock = null; return; }
    var bx = flock.dir > 0 ? vx0 - 40 + (span + 80) * k : vx1 + 40 - (span + 80) * k, z = 1 / Math.max(0.5, cam.z);
    g.strokeStyle = 'rgba(30,40,55,.75)'; g.lineWidth = 1.3 * z; g.lineCap = 'round';
    for (var i = 0; i < flock.n; i++) {
      var x = bx - flock.dir * i * 14 * z, y = flock.y + (i % 2 ? 7 : -3) * z + Math.sin(now / 300 + i) * 2 * z, w = Math.sin(now / 120 + i) * 2.2 * z;
      g.beginPath(); g.moveTo(x - 5 * z, y - w); g.quadraticCurveTo(x - 2 * z, y - 1.5 * z, x, y); g.quadraticCurveTo(x + 2 * z, y - 1.5 * z, x + 5 * z, y - w); g.stroke();
    }
  }

  function drawSite(it, t) {
    var n = it.d.size, b = it.b;
    var pr = Math.max(0, Math.min(1, (t - b.cs) / Math.max(1, b.cu - b.cs)));
    diamond(b.x + 0.04, b.y + 0.04, b.x + n - 0.04, b.y + n - 0.04);
    g.fillStyle = '#c9a871'; g.fill(); g.strokeStyle = '#f2b632'; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
    var sp = it.sp;
    // Gebäude wächst von unten nach oben aus dem Gerüst
    var cut = (sp.h - n * 2 * HH) * (1 - pr);
    g.globalAlpha = 0.28; g.drawImage(sp.c, it.sx - sp.ox, it.sy - sp.oy, sp.w, sp.h);
    g.globalAlpha = 0.95;
    var kx = sp.c.width / sp.w, ky = sp.c.height / sp.h;
    g.drawImage(sp.c, 0, cut * ky, sp.w * kx, (sp.h - cut) * ky, it.sx - sp.ox, it.sy - sp.oy + cut, sp.w, sp.h - cut);
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
