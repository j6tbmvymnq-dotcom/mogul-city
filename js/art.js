/* Mogul City – prozedurale isometrische Grafik (keine Bilddateien nötig) */
(function () {
  'use strict';
  var MC = window.MC;
  var HW = 32, HH = 16, SS = 2;
  var A = MC.Art = { HW: HW, HH: HH };
  var cache = {};

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  A.shade = shade;

  function kit(g, ox, oy) {
    var K = { g: g };
    var EDGE = 'rgba(20,30,50,.22)';
    function P(x, y, z) { return [ox + (x - y) * HW, oy + (x + y) * HH - (z || 0)]; }
    K.P = P;
    function poly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke !== null) { g.strokeStyle = stroke || EDGE; g.lineWidth = 0.6; g.stroke(); }
    }
    K.poly = poly;
    K.quad = function (x0, y0, x1, y1, z, col, stroke) {
      poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], col, stroke === undefined ? null : stroke);
    };
    K.lot = function (n, col, edge) {
      K.quad(0.03, 0.03, n - 0.03, n - 0.03, 0, col, edge || 'rgba(0,0,0,.10)');
    };
    K.box = function (x0, y0, x1, y1, z0, z1, col, topCol) {
      poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], shade(col, -0.10));
      poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], shade(col, -0.30));
      poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], topCol || shade(col, 0.12));
    };
    // Fenster auf der linken Wand (y fest) bzw. rechten Wand (x fest)
    function wins(left, a0, a1, fix, z0, z1, na, nz, col, fa, fz, lit) {
      fa = fa || 0.55; fz = fz || 0.55;
      var da = (a1 - a0) / na, dz = (z1 - z0) / nz;
      for (var i = 0; i < na; i++) for (var j = 0; j < nz; j++) {
        var s = a0 + da * (i + (1 - fa) / 2), e = s + da * fa;
        var b = z0 + dz * (j + (1 - fz) / 2), t = b + dz * fz;
        var c = (lit && ((i * 7 + j * 13 + (left ? 0 : 3)) % 5 === 0)) ? lit : col;
        if (!left) c = (c.charAt(0) === '#') ? shade(c, -0.18) : c;
        if (left) poly([P(s, fix, b), P(e, fix, b), P(e, fix, t), P(s, fix, t)], c, null);
        else poly([P(fix, s, b), P(fix, e, b), P(fix, e, t), P(fix, s, t)], c, null);
      }
    }
    K.winL = function (x0, x1, y, z0, z1, nx, nz, col, fa, fz, lit) { wins(true, x0, x1, y, z0, z1, nx, nz, col, fa, fz, lit); };
    K.winR = function (y0, y1, x, z0, z1, ny, nz, col, fa, fz, lit) { wins(false, y0, y1, x, z0, z1, ny, nz, col, fa, fz, lit); };
    K.doorL = function (x, y, w, h, col) { poly([P(x - w / 2, y, 0), P(x + w / 2, y, 0), P(x + w / 2, y, h), P(x - w / 2, y, h)], col, null); };
    K.doorR = function (y, x, w, h, col) { poly([P(x, y - w / 2, 0), P(x, y + w / 2, 0), P(x, y + w / 2, h), P(x, y - w / 2, h)], shade(col, -0.15), null); };
    // Pyramidenstumpf über quadratischer Grundfläche (r1 = 0 -> Spitze)
    K.frustum = function (cx, cy, r0, r1, z0, z1, col) {
      var a = [P(cx - r0, cy - r0, z0), P(cx + r0, cy - r0, z0), P(cx + r0, cy + r0, z0), P(cx - r0, cy + r0, z0)];
      var b = [P(cx - r1, cy - r1, z1), P(cx + r1, cy - r1, z1), P(cx + r1, cy + r1, z1), P(cx - r1, cy + r1, z1)];
      poly([a[0], a[1], b[1], b[0]], shade(col, 0.05));
      poly([a[0], a[3], b[3], b[0]], shade(col, 0.18));
      poly([a[3], a[2], b[2], b[3]], shade(col, -0.06));
      poly([a[1], a[2], b[2], b[1]], shade(col, -0.28));
      if (r1 > 0) poly(b, shade(col, 0.12));
    };
    // Walmdach über Rechteck
    K.hip = function (x0, y0, x1, y1, z, h, col, o) {
      o = o === undefined ? 0.08 : o;
      x0 -= o; y0 -= o; x1 += o; y1 += o;
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, d = y1 - y0, r0, r1, t;
      if (Math.abs(w - d) < 0.01) { t = P(cx, cy, z + h); r0 = t; r1 = t; }
      else if (w > d) { r0 = P(x0 + d / 2, cy, z + h); r1 = P(x1 - d / 2, cy, z + h); }
      else { r0 = P(cx, y0 + w / 2, z + h); r1 = P(cx, y1 - w / 2, z + h); }
      var c = [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
      if (w >= d) {
        poly([c[0], c[1], r1, r0], shade(col, 0.10));
        poly([c[0], c[3], r0], shade(col, 0.16));
        poly([c[3], c[2], r1, r0], shade(col, -0.04));
        poly([c[1], c[2], r1], shade(col, -0.26));
      } else {
        poly([c[0], c[1], r0], shade(col, 0.10));
        poly([c[0], c[3], r1, r0], shade(col, 0.16));
        poly([c[3], c[2], r1], shade(col, -0.04));
        poly([c[1], c[2], r1, r0], shade(col, -0.26));
      }
    };
    // Satteldach, First entlang x; Giebel sichtbar an der rechten Wand
    K.gable = function (x0, y0, x1, y1, z, h, col, wall, o) {
      o = o === undefined ? 0.08 : o;
      var cy = (y0 + y1) / 2;
      poly([P(x1, y0, z), P(x1, y1, z), P(x1, cy, z + h)], shade(wall, -0.30));
      var a0 = P(x0 - o, cy, z + h), a1 = P(x1 + o, cy, z + h);
      poly([P(x0 - o, y0 - o, z - 2), P(x1 + o, y0 - o, z - 2), a1, a0], shade(col, 0.12));
      poly([P(x0 - o, y1 + o, z - 2), P(x1 + o, y1 + o, z - 2), a1, a0], shade(col, -0.05));
    };
    K.ell = function (cx, cy, z, r, col, stroke) {
      var p = P(cx, cy, z);
      g.beginPath(); g.ellipse(p[0], p[1], r * HW * 1.414, r * HH * 1.414, 0, 0, Math.PI * 2);
      if (col) { g.fillStyle = col; g.fill(); }
      if (stroke !== null) { g.strokeStyle = stroke || EDGE; g.lineWidth = 0.6; g.stroke(); }
    };
    K.cyl = function (cx, cy, r, z0, z1, col, topCol) {
      var a = P(cx, cy, z0), b = P(cx, cy, z1), rx = r * HW * 1.414, ry = r * HH * 1.414;
      var gr = g.createLinearGradient(a[0] - rx, 0, a[0] + rx, 0);
      gr.addColorStop(0, shade(col, 0.10)); gr.addColorStop(0.45, shade(col, -0.05)); gr.addColorStop(1, shade(col, -0.35));
      g.beginPath();
      g.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI, false);
      g.lineTo(b[0] - rx, b[1]);
      g.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true);
      g.closePath();
      g.fillStyle = gr; g.fill(); g.strokeStyle = EDGE; g.lineWidth = 0.6; g.stroke();
      K.ell(cx, cy, z1, r, topCol || shade(col, 0.15));
    };
    K.cone = function (cx, cy, r, z, h, col) {
      var a = P(cx, cy, z), t = P(cx, cy, z + h), rx = r * HW * 1.414, ry = r * HH * 1.414;
      var gr = g.createLinearGradient(a[0] - rx, 0, a[0] + rx, 0);
      gr.addColorStop(0, shade(col, 0.15)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.35));
      g.beginPath();
      g.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI, false);
      g.lineTo(t[0], t[1]); g.closePath();
      g.fillStyle = gr; g.fill(); g.strokeStyle = EDGE; g.lineWidth = 0.6; g.stroke();
    };
    K.ball = function (cx, cy, z, r, col) {
      var p = P(cx, cy, z);
      var gr = g.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.1, p[0], p[1], r);
      gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, -0.3));
      g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
    };
    K.shadow = function (cx, cy, r) { K.ell(cx, cy, 0, r, 'rgba(0,0,0,.16)', null); };
    K.line = function (a, b, col, w) {
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.strokeStyle = col; g.lineWidth = w || 1; g.lineCap = 'round'; g.stroke();
    };
    K.tree = function (cx, cy, s, col) {
      s = s || 1; col = col || '#3f9b4b';
      K.shadow(cx + 0.05, cy + 0.05, 0.26 * s);
      var a = P(cx, cy, 0), b = P(cx, cy, 12 * s);
      K.line(a, b, '#7a5230', 3 * s);
      K.ball(cx, cy, 17 * s, 10 * s, shade(col, -0.1));
      K.ball(cx - 0.08, cy + 0.06, 22 * s, 8 * s, col);
      K.ball(cx + 0.07, cy - 0.02, 27 * s, 6.5 * s, shade(col, 0.1));
    };
    K.palm = function (cx, cy, s) {
      s = s || 1;
      K.shadow(cx + 0.05, cy + 0.05, 0.2 * s);
      var a = P(cx, cy, 0), t = P(cx + 0.05, cy, 30 * s);
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(a[0] - 4 * s, (a[1] + t[1]) / 2, t[0], t[1]);
      g.strokeStyle = '#9a7445'; g.lineWidth = 3 * s; g.lineCap = 'round'; g.stroke();
      for (var i = 0; i < 7; i++) {
        var an = i / 7 * Math.PI * 2 + 0.3, ex = t[0] + Math.cos(an) * 15 * s, ey = t[1] + Math.sin(an) * 7 * s + 5 * s;
        g.beginPath(); g.moveTo(t[0], t[1]); g.quadraticCurveTo((t[0] + ex) / 2, t[1] - 7 * s, ex, ey);
        g.strokeStyle = i % 2 ? '#2f9a57' : '#44b468'; g.lineWidth = 3.2 * s; g.stroke();
      }
      K.ball(cx + 0.05, cy, 30 * s, 2.5 * s, '#8a5a2b');
    };
    K.bush = function (cx, cy, col, r) { K.ball(cx, cy, (r || 4), (r || 4) + 1, col || '#4aa857'); };
    // Markise an der linken Wand
    K.awnL = function (x0, x1, y, z, dep, c1, c2, n) {
      n = n || 6; var dx = (x1 - x0) / n;
      for (var i = 0; i < n; i++) {
        var s = x0 + dx * i, e = s + dx;
        poly([P(s, y, z), P(e, y, z), P(e, y + dep, z - 7), P(s, y + dep, z - 7)], i % 2 ? c1 : c2, null);
      }
    };
    K.awnR = function (y0, y1, x, z, dep, c1, c2, n) {
      n = n || 6; var dy = (y1 - y0) / n;
      for (var i = 0; i < n; i++) {
        var s = y0 + dy * i, e = s + dy;
        poly([P(x, s, z), P(x, e, z), P(x + dep, e, z - 7), P(x + dep, s, z - 7)], shade(i % 2 ? c1 : c2, -0.15), null);
      }
    };
    K.flag = function (x, y, z, h, col) {
      var a = P(x, y, z), b = P(x, y, z + h);
      K.line(a, b, '#d8dde6', 1.2);
      g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] + 11, b[1] + 3); g.lineTo(b[0], b[1] + 7); g.closePath();
      g.fillStyle = col; g.fill();
    };
    return K;
  }

  var GRASS = '#7cc46a', PAVE = '#cfd4da', GLASS = '#8fd0ea', LIT = '#ffe9a3', DARKGLASS = '#4f7fa6';

  // Generischer Laden mit Markise
  function shop(K, n, o) {
    var a = 0.22, b = n - 0.22, h = o.h || 20;
    K.lot(n, PAVE);
    K.box(a, a, b, b, 0, h, o.wall, o.roof);
    K.winL(a + 0.1, b - 0.1, b, 3, h - 7, n + 1, 1, GLASS, 0.7, 0.9);
    K.winR(a + 0.1, b - 0.1, b, 3, h - 7, n, 1, GLASS, 0.7, 0.9);
    K.doorL((a + b) / 2, b, 0.3, 12, '#5b4636');
    K.awnL(a, b, b, h - 4, 0.2, o.a1, o.a2, n * 3);
    K.awnR(a, b, b, h - 4, 0.2, o.a1, o.a2, n * 3);
    K.box(a, a, b, b, h, h + 2.5, o.trim || shade(o.wall, -0.2), o.roof);
  }

  var DRAW = {
    hq: [70, function (K) {
      K.lot(2, PAVE);
      K.box(0.2, 0.2, 1.8, 1.8, 0, 46, '#3b6ea8', '#9fb4c9');
      K.winL(0.25, 1.75, 1.8, 4, 44, 4, 6, GLASS, 0.78, 0.6, LIT);
      K.winR(0.25, 1.75, 1.8, 4, 44, 4, 6, GLASS, 0.78, 0.6, LIT);
      K.box(0.2, 0.2, 1.8, 1.8, 46, 50, '#e7b93c');
      K.box(0.7, 0.7, 1.3, 1.3, 50, 56, '#aab6c4');
      K.doorL(1, 1.8, 0.36, 10, '#1f3c5e');
      K.flag(1, 1, 56, 14, '#e7b93c');
    }],

    // ---------------- Häuser ----------------
    bungalow: [44, function (K) {
      K.lot(2, GRASS);
      K.quad(0.85, 1.6, 1.15, 1.97, 0, '#d9c9a8');
      K.box(0.35, 0.4, 1.65, 1.6, 0, 15, '#f3e3c0');
      K.winL(0.4, 1.6, 1.6, 4, 13, 3, 1, GLASS, 0.5, 0.75);
      K.doorL(1, 1.6, 0.22, 11, '#7a4a2a');
      K.winR(0.5, 1.5, 1.65, 4, 13, 2, 1, GLASS, 0.5, 0.75);
      K.gable(0.35, 0.4, 1.65, 1.6, 15, 13, '#c9503c', '#f3e3c0');
      K.bush(0.3, 1.8, '#4aa857'); K.bush(1.75, 1.82, '#58b565');
    }],
    reihenhaus: [60, function (K) {
      K.lot(2, GRASS);
      K.quad(0.2, 1.72, 1.8, 1.97, 0, PAVE);
      K.box(0.25, 0.35, 1.75, 1.7, 0, 30, '#c8785a');
      K.winL(0.3, 1.7, 1.7, 3, 28, 4, 2, GLASS, 0.5, 0.55, LIT);
      K.doorL(0.47, 1.7, 0.16, 11, '#4a3326'); K.doorL(1.17, 1.7, 0.16, 11, '#4a3326');
      K.winR(0.45, 1.6, 1.75, 3, 28, 2, 2, GLASS, 0.5, 0.55, LIT);
      K.gable(0.25, 0.35, 1.75, 1.7, 30, 15, '#56616f', '#c8785a');
      K.box(0.6, 0.8, 0.75, 0.95, 38, 50, '#8d5a44');
    }],
    landhaus: [60, function (K) {
      K.lot(3, GRASS);
      K.tree(0.45, 0.5, 0.9);
      K.box(0.5, 0.6, 2.5, 1.8, 0, 18, '#e9d6a8');
      K.winL(0.55, 1.4, 1.8, 4, 15, 2, 1, GLASS, 0.5, 0.75);
      K.hip(0.5, 0.6, 2.5, 1.8, 18, 15, '#5e8f5a');
      K.box(1.5, 1.6, 2.6, 2.6, 0, 18, '#e9d6a8');
      K.winL(1.6, 2.5, 2.6, 4, 15, 2, 1, GLASS, 0.5, 0.75);
      K.winR(1.7, 2.5, 2.6, 4, 15, 2, 1, GLASS, 0.5, 0.75);
      K.doorL(2.05, 2.6, 0.2, 11, '#6d4426');
      K.hip(1.5, 1.6, 2.6, 2.6, 18, 13, '#5e8f5a');
      K.bush(0.5, 2.5, '#58b565', 5); K.bush(1.0, 2.75, '#4aa857');
    }],
    villa: [70, function (K) {
      K.lot(3, GRASS);
      K.quad(0.25, 1.9, 1.35, 2.75, 0, '#e9e2d0');
      K.quad(0.4, 2.02, 1.2, 2.62, 0, '#5cc4ea', 'rgba(255,255,255,.8)');
      K.box(0.4, 0.4, 2.6, 1.7, 0, 32, '#fbf6ea');
      K.winL(0.5, 2.5, 1.7, 3, 30, 4, 2, GLASS, 0.6, 0.6, LIT);
      K.winR(0.5, 1.6, 2.6, 3, 30, 2, 2, GLASS, 0.6, 0.6);
      K.doorL(1.75, 1.7, 0.24, 12, '#6d4426');
      K.hip(0.4, 0.4, 2.6, 1.7, 32, 16, '#d07a4a');
      K.box(1.7, 1.7, 2.6, 2.5, 0, 16, '#fbf6ea', '#e9e2d0');
      K.winL(1.8, 2.5, 2.5, 3, 14, 2, 1, GLASS, 0.6, 0.75);
      K.winR(1.8, 2.4, 2.6, 3, 14, 2, 1, GLASS, 0.6, 0.75);
      K.palm(0.4, 0.5, 0.9);
    }],
    wohnblock: [86, function (K) {
      K.lot(2, PAVE);
      K.box(0.22, 0.22, 1.78, 1.78, 0, 62, '#d9d3c6', '#b9b3a6');
      K.winL(0.28, 1.72, 1.78, 6, 60, 4, 6, DARKGLASS, 0.55, 0.55, LIT);
      K.winR(0.28, 1.72, 1.78, 6, 60, 4, 6, DARKGLASS, 0.55, 0.55, LIT);
      K.doorL(1, 1.78, 0.3, 10, '#4a4f58');
      K.box(0.22, 0.22, 1.78, 1.78, 62, 65, '#e0774f');
      K.box(0.8, 0.8, 1.2, 1.2, 65, 71, '#9aa3ad');
    }],
    kolonial: [76, function (K) {
      K.lot(3, GRASS);
      K.quad(1.2, 2.3, 1.8, 2.97, 0, '#e2d9c5');
      K.box(0.4, 0.45, 2.6, 2.1, 0, 36, '#fffaf0');
      K.winL(0.5, 2.5, 2.1, 20, 34, 5, 1, '#3d5a73', 0.5, 0.75);
      K.winL(0.5, 1.3, 2.1, 4, 16, 2, 1, '#3d5a73', 0.5, 0.75); K.winL(1.7, 2.5, 2.1, 4, 16, 2, 1, '#3d5a73', 0.5, 0.75);
      K.winR(0.6, 2.0, 2.6, 4, 34, 3, 2, '#3d5a73', 0.5, 0.6);
      K.doorL(1.5, 2.1, 0.26, 14, '#2f4a3a');
      K.hip(0.4, 0.45, 2.6, 2.1, 38, 18, '#52657a');
      K.box(0.35, 2.1, 2.65, 2.4, 34, 38, '#f1ead8');
      for (var i = 0; i < 5; i++) K.cyl(0.5 + i * 0.5, 2.32, 0.05, 0, 34, '#ffffff');
      K.tree(0.4, 2.7, 0.75, '#3f9b4b'); K.tree(2.65, 2.75, 0.75, '#3f9b4b');
    }],
    luxusapart: [116, function (K) {
      K.lot(3, PAVE);
      K.quad(0.1, 2.5, 2.9, 2.95, 0, GRASS);
      K.box(0.35, 0.35, 2.65, 2.45, 0, 84, '#eef2f5', '#c6d0d8');
      K.winL(0.4, 2.6, 2.45, 6, 82, 5, 8, '#3fb5c9', 0.8, 0.62, LIT);
      K.winR(0.4, 2.4, 2.65, 6, 82, 4, 8, '#3fb5c9', 0.8, 0.62, LIT);
      K.doorL(1.5, 2.45, 0.4, 5, '#2b3b4d');
      K.box(0.8, 0.8, 2.2, 2.0, 84, 96, '#dfe6ec', '#c6d0d8');
      K.winL(0.85, 2.15, 2.0, 86, 94, 3, 1, '#3fb5c9', 0.85, 0.8);
      K.winR(0.85, 1.95, 2.2, 86, 94, 2, 1, '#3fb5c9', 0.85, 0.8);
      K.bush(0.5, 2.75, '#4aa857'); K.bush(2.5, 2.75, '#4aa857');
    }],
    chateau: [110, function (K) {
      K.lot(4, GRASS);
      K.quad(1.7, 3.2, 2.3, 3.97, 0, '#e2d9c5');
      K.cyl(0.75, 0.75, 0.3, 0, 54, '#efe6d2'); K.cone(0.75, 0.75, 0.36, 54, 30, '#4c5f7d');
      K.box(0.7, 0.7, 3.3, 2.9, 0, 40, '#efe6d2');
      K.winL(0.9, 3.1, 2.9, 4, 38, 5, 2, '#44607c', 0.45, 0.6, LIT);
      K.winR(0.9, 2.7, 3.3, 4, 38, 4, 2, '#44607c', 0.45, 0.6);
      K.doorL(2, 2.9, 0.34, 16, '#5a3a22');
      K.hip(0.7, 0.7, 3.3, 2.9, 40, 26, '#4c5f7d');
      K.cyl(3.3, 0.75, 0.3, 0, 54, '#efe6d2'); K.cone(3.3, 0.75, 0.36, 54, 30, '#4c5f7d');
      K.cyl(0.75, 2.9, 0.34, 0, 58, '#efe6d2'); K.cone(0.75, 2.9, 0.4, 58, 34, '#4c5f7d');
      K.cyl(3.3, 2.9, 0.34, 0, 58, '#efe6d2'); K.cone(3.3, 2.9, 0.4, 58, 34, '#4c5f7d');
      K.bush(1.3, 3.5, '#3f9b4b', 5); K.bush(2.7, 3.5, '#3f9b4b', 5);
    }],
    wolkenkratzer: [196, function (K) {
      K.lot(3, PAVE);
      K.box(0.3, 0.3, 2.7, 2.7, 0, 12, '#77828f');
      K.doorL(1.5, 2.7, 0.5, 9, '#1d2a3a');
      K.box(0.45, 0.45, 2.55, 2.55, 12, 110, '#4a86b8', '#9db4c8');
      K.winL(0.5, 2.5, 2.55, 14, 108, 5, 14, '#9fdcf5', 0.8, 0.6, LIT);
      K.winR(0.5, 2.5, 2.55, 14, 108, 5, 14, '#9fdcf5', 0.8, 0.6, LIT);
      K.box(0.8, 0.8, 2.2, 2.2, 110, 150, '#4a86b8', '#9db4c8');
      K.winL(0.85, 2.15, 2.2, 112, 148, 3, 6, '#9fdcf5', 0.8, 0.6, LIT);
      K.winR(0.85, 2.15, 2.2, 112, 148, 3, 6, '#9fdcf5', 0.8, 0.6, LIT);
      K.box(1.2, 1.2, 1.8, 1.8, 150, 164, '#77828f');
      K.line(K.P(1.5, 1.5, 164), K.P(1.5, 1.5, 190), '#c9d2dc', 1.4);
      K.ball(1.5, 1.5, 190, 1.8, '#ff5a4d');
    }],
    schloss: [130, function (K) {
      K.lot(4, '#8fbf72');
      var st = '#b9b4a8';
      K.cyl(0.6, 0.6, 0.38, 0, 62, st); K.cone(0.6, 0.6, 0.42, 62, 26, '#8a3f3a');
      K.box(0.5, 0.5, 3.5, 3.5, 0, 30, st);
      K.box(1.2, 1.2, 2.8, 2.8, 30, 70, shade(st, 0.08));
      K.winL(1.3, 2.7, 2.8, 36, 66, 3, 2, '#3b4756', 0.3, 0.55, LIT);
      K.winR(1.3, 2.7, 2.8, 36, 66, 3, 2, '#3b4756', 0.3, 0.55);
      K.hip(1.2, 1.2, 2.8, 2.8, 70, 28, '#8a3f3a');
      K.flag(2, 2, 98, 16, '#e7b93c');
      for (var i = 0; i < 6; i++) { K.box(0.6 + i * 0.5, 3.38, 0.82 + i * 0.5, 3.5, 30, 35, st); K.box(3.38, 0.6 + i * 0.5, 3.5, 0.82 + i * 0.5, 30, 35, st); }
      K.doorL(2, 3.5, 0.5, 18, '#4a3120');
      K.cyl(3.4, 0.6, 0.38, 0, 62, st); K.cone(3.4, 0.6, 0.42, 62, 26, '#8a3f3a');
      K.cyl(0.6, 3.4, 0.4, 0, 66, st); K.cone(0.6, 3.4, 0.44, 66, 28, '#8a3f3a');
      K.cyl(3.4, 3.4, 0.4, 0, 66, st); K.cone(3.4, 3.4, 0.44, 66, 28, '#8a3f3a');
    }],
    supertower: [262, function (K) {
      K.lot(4, PAVE);
      K.box(0.35, 0.35, 3.65, 3.65, 0, 16, '#3a4452');
      K.doorL(2, 3.65, 0.7, 11, '#e7b93c');
      var c = '#2f5d7a', w = '#f3d27a';
      K.box(0.6, 0.6, 3.4, 3.4, 16, 120, c, '#8aa3b5');
      K.winL(0.65, 3.35, 3.4, 18, 118, 7, 14, '#7fd3e8', 0.82, 0.6, w);
      K.winR(0.65, 3.35, 3.4, 18, 118, 7, 14, '#7fd3e8', 0.82, 0.6, w);
      K.box(1.0, 1.0, 3.0, 3.0, 120, 180, c, '#8aa3b5');
      K.winL(1.05, 2.95, 3.0, 122, 178, 5, 8, '#7fd3e8', 0.82, 0.6, w);
      K.winR(1.05, 2.95, 3.0, 122, 178, 5, 8, '#7fd3e8', 0.82, 0.6, w);
      K.box(1.4, 1.4, 2.6, 2.6, 180, 214, c, '#8aa3b5');
      K.winL(1.45, 2.55, 2.6, 182, 212, 3, 5, '#7fd3e8', 0.82, 0.6, w);
      K.winR(1.45, 2.55, 2.6, 182, 212, 3, 5, '#7fd3e8', 0.82, 0.6, w);
      K.frustum(2, 2, 0.6, 0, 214, 240, '#e7b93c');
      K.line(K.P(2, 2, 240), K.P(2, 2, 258), '#e7b93c', 1.4);
    }],

    // ---------------- Gewerbe ----------------
    cafe: [52, function (K) {
      shop(K, 2, { wall: '#f1e2c4', roof: '#a9773f', a1: '#b5533c', a2: '#fbf3e3', h: 20 });
      K.cyl(1, 1, 0.26, 23, 34, '#ffffff', '#6b4226');
      var p = K.P(1.3, 1.1, 30); K.g.beginPath(); K.g.arc(p[0] + 4, p[1], 4.5, -1.2, 1.4); K.g.strokeStyle = '#fff'; K.g.lineWidth = 2; K.g.stroke();
    }],
    baeckerei: [56, function (K) {
      shop(K, 2, { wall: '#f6d99a', roof: '#c98a3c', a1: '#e0a53a', a2: '#fff7e0', h: 20 });
      K.box(0.5, 0.5, 0.75, 0.75, 22, 38, '#b05a3c');
      K.ball(1.1, 1.1, 30, 8, '#d9963f'); K.ball(1.1, 1.1, 30, 3.5, '#f6d99a');
    }],
    blumen: [54, function (K) {
      shop(K, 2, { wall: '#e9f4e2', roof: '#6fb07a', a1: '#e56a9a', a2: '#ffffff', h: 20 });
      var cols = ['#ff6fa3', '#ffd34d', '#ff8a4c', '#c77dff', '#ff5a6e'];
      for (var i = 0; i < 9; i++) K.ball(0.5 + (i % 3) * 0.5, 0.5 + Math.floor(i / 3) * 0.5, 27, 4.5, cols[i % 5]);
      K.ball(0.25, 1.92, 4, 3.5, '#ff6fa3'); K.ball(1.9, 1.92, 4, 3.5, '#ffd34d');
    }],
    burger: [64, function (K) {
      shop(K, 3, { wall: '#fff3d6', roof: '#d64a3a', a1: '#d64a3a', a2: '#ffd34d', h: 22 });
      K.cyl(1.5, 1.5, 0.5, 25, 31, '#e0a14a');
      K.cyl(1.5, 1.5, 0.54, 31, 34, '#6aa84f');
      K.cyl(1.5, 1.5, 0.5, 34, 39, '#6b3a22');
      K.cyl(1.5, 1.5, 0.52, 39, 41, '#ffd34d');
      K.ball(1.5, 1.5, 44, 21, '#e8a84e');
    }],
    kino: [70, function (K) {
      K.lot(3, PAVE);
      K.box(0.3, 0.3, 2.7, 2.7, 0, 36, '#7a2f4a', '#5a2236');
      K.box(0.25, 2.7, 2.75, 2.95, 20, 30, '#ffd34d');
      for (var i = 0; i < 8; i++) K.ball(0.4 + i * 0.31, 2.95, 25, 1.8, i % 2 ? '#ff5a4d' : '#ffffff');
      K.doorL(1.2, 2.7, 0.3, 14, '#2a1420'); K.doorL(1.8, 2.7, 0.3, 14, '#2a1420');
      K.winR(0.5, 2.5, 2.7, 6, 30, 3, 1, '#f3d27a', 0.55, 0.8);
      K.box(1.1, 1.1, 1.9, 1.9, 36, 44, '#5a2236');
      K.ball(1.5, 1.5, 54, 9, '#ffd34d');
    }],
    bowling: [74, function (K) {
      shop(K, 3, { wall: '#dfe9f5', roof: '#3d6fb5', a1: '#3d6fb5', a2: '#ffffff', h: 24 });
      K.cyl(1.2, 1.5, 0.2, 27, 46, '#ffffff'); K.ball(1.2, 1.5, 52, 6, '#ffffff');
      K.cyl(1.2, 1.5, 0.21, 42, 45, '#e0453a');
      K.ball(1.9, 1.8, 37, 10, '#2b2f3a');
    }],
    club: [70, function (K) {
      K.lot(3, '#b9bec6');
      K.box(0.3, 0.3, 2.7, 2.7, 0, 34, '#2a2140', '#3a2e57');
      K.winL(0.4, 2.6, 2.7, 22, 30, 1, 1, '#ff4fd8', 0.9, 0.7);
      K.winR(0.4, 2.6, 2.7, 22, 30, 1, 1, '#4fd8ff', 0.9, 0.7);
      K.winL(0.4, 2.6, 2.7, 6, 9, 1, 1, '#4fd8ff', 0.9, 0.9);
      K.doorL(1.5, 2.7, 0.4, 15, '#ff4fd8');
      K.cyl(1.5, 1.5, 0.5, 34, 40, '#3a2e57');
      K.ball(1.5, 1.5, 52, 10, '#d9d9ff');
    }],
    mall: [84, function (K) {
      K.lot(4, PAVE);
      K.box(0.3, 0.3, 3.7, 3.7, 0, 40, '#eef1f4', '#c9d1d9');
      K.winL(0.4, 3.6, 3.7, 4, 36, 6, 2, GLASS, 0.85, 0.75, LIT);
      K.winR(0.4, 3.6, 3.7, 4, 36, 6, 2, GLASS, 0.85, 0.75);
      K.box(1.4, 3.7, 2.6, 3.95, 0, 24, '#e0774f');
      K.doorL(2, 3.95, 0.7, 16, '#243447');
      K.box(0.3, 0.3, 3.7, 3.7, 40, 44, '#e0774f', '#c9d1d9');
      K.frustum(2, 2, 1.1, 0.2, 44, 66, '#8fd0ea');
    }],
    casino: [170, function (K) {
      K.lot(4, PAVE);
      K.box(0.3, 0.3, 3.7, 3.7, 0, 30, '#7a1f2b', '#5c1620');
      K.winL(0.4, 3.6, 3.7, 6, 26, 8, 1, '#ffd34d', 0.5, 0.8);
      K.winR(0.4, 3.6, 3.7, 6, 26, 8, 1, '#ffd34d', 0.5, 0.8);
      K.doorL(2, 3.7, 0.8, 18, '#e7b93c');
      K.box(0.3, 0.3, 3.7, 3.7, 30, 34, '#e7b93c', '#5c1620');
      K.box(0.6, 0.6, 2.4, 2.4, 34, 130, '#b8873a', '#8a6529');
      K.winL(0.65, 2.35, 2.4, 36, 128, 4, 13, '#fff0b8', 0.75, 0.55, '#ffffff');
      K.winR(0.65, 2.35, 2.4, 36, 128, 4, 13, '#fff0b8', 0.75, 0.55, '#ffffff');
      K.cyl(1.5, 1.5, 0.6, 130, 138, '#e7b93c'); K.ball(1.5, 1.5, 146, 18, '#e7b93c');
      K.palm(3.0, 3.1, 1); K.palm(3.2, 2.2, 0.85);
    }],

    // ---------------- Dekoration ----------------
    blumenbeet: [16, function (K) {
      K.lot(1, GRASS);
      K.quad(0.15, 0.15, 0.85, 0.85, 0, '#7a5a3a');
      var cols = ['#ff6fa3', '#ffd34d', '#ffffff', '#c77dff', '#ff5a6e'];
      for (var i = 0; i < 9; i++) K.ball(0.28 + (i % 3) * 0.22, 0.28 + Math.floor(i / 3) * 0.22, 3, 3, cols[(i * 2) % 5]);
    }],
    eiche: [46, function (K) { K.lot(1, GRASS); K.tree(0.5, 0.5, 1.25, '#3f9b4b'); }],
    palme: [50, function (K) { K.lot(1, '#e8dcae'); K.palm(0.5, 0.5, 1.3); }],
    bank: [22, function (K) {
      K.lot(1, PAVE);
      K.box(0.2, 0.42, 0.8, 0.62, 5, 7, '#9a6a3a');
      K.box(0.2, 0.38, 0.8, 0.44, 7, 14, '#9a6a3a');
      K.box(0.22, 0.44, 0.28, 0.6, 0, 5, '#4a4f58'); K.box(0.72, 0.44, 0.78, 0.6, 0, 5, '#4a4f58');
      K.ball(0.85, 0.85, 4, 4, '#4aa857');
    }],
    brunnen: [50, function (K) {
      K.lot(2, PAVE);
      K.cyl(1, 1, 0.62, 0, 7, '#c9c2b4', '#5cc4ea');
      K.cyl(1, 1, 0.12, 7, 22, '#c9c2b4');
      K.cyl(1, 1, 0.3, 22, 25, '#c9c2b4', '#5cc4ea');
      var t = K.P(1, 1, 40), g = K.g;
      for (var i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(t[0], t[1] + 14); g.quadraticCurveTo(t[0] + i * 5, t[1] - 4, t[0] + i * 11, t[1] + 26 - Math.abs(i));
        g.strokeStyle = 'rgba(190,235,255,.9)'; g.lineWidth = 1.6; g.stroke();
      }
    }],
    goldstatue: [44, function (K) {
      K.lot(1, PAVE);
      K.box(0.28, 0.28, 0.72, 0.72, 0, 9, '#d9dde3');
      K.cone(0.5, 0.5, 0.15, 9, 20, '#e7b93c');
      K.ball(0.5, 0.5, 32, 4.5, '#e7b93c');
      K.line(K.P(0.5, 0.5, 26), K.P(0.3, 0.5, 34), '#e7b93c', 2.4);
    }],
    park: [50, function (K) {
      K.lot(3, '#86cf72');
      K.quad(1.35, 0.05, 1.65, 2.95, 0, '#e2d9c5'); K.quad(0.05, 1.35, 2.95, 1.65, 0, '#e2d9c5');
      K.ell(1.5, 1.5, 0, 0.5, '#e2d9c5', null); K.ell(1.5, 1.5, 0, 0.34, '#5cc4ea', 'rgba(255,255,255,.7)');
      K.tree(0.6, 0.6, 1.05); K.tree(2.4, 0.6, 0.95, '#4fae5a');
      K.ball(0.4, 2.0, 3, 3, '#ff6fa3'); K.ball(0.7, 2.3, 3, 3, '#ffd34d'); K.ball(1.0, 2.6, 3, 3, '#ffffff');
      K.tree(0.6, 2.5, 0.95, '#4fae5a'); K.tree(2.4, 2.4, 1.1);
    }],
    skulptur: [50, function (K) {
      K.lot(2, '#e9e4d8');
      K.quad(0.15, 0.15, 1.85, 1.85, 0, '#86cf72');
      K.box(0.35, 0.35, 0.75, 0.75, 0, 26, '#e0453a');
      K.cone(1.45, 0.6, 0.24, 0, 36, '#3d6fb5');
      K.box(0.4, 1.3, 0.8, 1.6, 0, 5, '#d9dde3'); K.ball(0.6, 1.45, 15, 10, '#e7b93c');
      K.cyl(1.4, 1.4, 0.2, 0, 14, '#8a56c2'); K.ball(1.4, 1.4, 21, 7, '#ffffff');
    }],

    // ---------------- Weltwunder ----------------
    w_statue: [84, function (K) {
      K.lot(2, PAVE);
      K.frustum(1, 1, 0.7, 0.55, 0, 8, '#c9c2b4');
      K.box(0.6, 0.6, 1.4, 1.4, 8, 30, '#ddd6c8');
      K.box(0.72, 1.4, 1.28, 1.42, 13, 24, '#e7b93c');
      var br = '#b07a3c';
      K.cyl(1, 1, 0.2, 30, 56, br); K.ball(1, 1, 64, 6.5, br);
      K.line(K.P(1, 1.15, 52), K.P(0.75, 1.3, 70), br, 4);
      K.box(0.62, 1.2, 0.82, 1.4, 68, 76, '#e7b93c');
    }],
    w_uhr: [150, function (K) {
      K.lot(2, PAVE);
      K.box(0.35, 0.35, 1.65, 1.65, 0, 14, '#a89a84');
      K.box(0.5, 0.5, 1.5, 1.5, 14, 96, '#cdbf9f');
      K.winL(0.6, 1.4, 1.5, 18, 66, 2, 4, '#5a4a3a', 0.3, 0.6);
      K.winR(0.6, 1.4, 1.5, 18, 66, 2, 4, '#5a4a3a', 0.3, 0.6);
      var g = K.g, p = K.P(1, 1.5, 82);
      g.save(); g.transform(1, 0.5, 0, 1, p[0], p[1]);
      g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fillStyle = '#fffdf2'; g.fill(); g.strokeStyle = '#3a2f22'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.moveTo(0, 0); g.lineTo(5, 2); g.stroke(); g.restore();
      p = K.P(1.5, 1, 82);
      g.save(); g.transform(1, -0.5, 0, 1, p[0], p[1]);
      g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fillStyle = '#e8e4d6'; g.fill(); g.strokeStyle = '#3a2f22'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.moveTo(0, 0); g.lineTo(5, 2); g.stroke(); g.restore();
      K.box(0.42, 0.42, 1.58, 1.58, 96, 101, '#a89a84');
      K.frustum(1, 1, 0.5, 0, 101, 136, '#3f6b5a');
      K.ball(1, 1, 138, 2.5, '#e7b93c');
    }],
    w_rad: [124, function (K) {
      K.lot(3, PAVE);
      K.quad(0.2, 0.2, 2.8, 1.2, 0, GRASS);
      var g = K.g, cz = 62, R = 50, U = 35.78, y = 1.6, cx = 1.5, i, a;
      function W(an, r) { return K.P(cx + Math.cos(an) * r / U, y, cz + Math.sin(an) * r); }
      K.line(K.P(cx, y - 0.5, 0), K.P(cx, y, cz), '#8a94a3', 3.5);
      g.beginPath();
      for (i = 0; i <= 48; i++) { a = W(i / 48 * Math.PI * 2, R); if (i) g.lineTo(a[0], a[1]); else g.moveTo(a[0], a[1]); }
      g.strokeStyle = '#e0453a'; g.lineWidth = 3; g.stroke();
      g.beginPath();
      for (i = 0; i <= 48; i++) { a = W(i / 48 * Math.PI * 2, R * 0.72); if (i) g.lineTo(a[0], a[1]); else g.moveTo(a[0], a[1]); }
      g.strokeStyle = '#f2f4f7'; g.lineWidth = 1.2; g.stroke();
      for (i = 0; i < 12; i++) K.line(W(0, 0), W(i / 12 * Math.PI * 2, R), '#f2f4f7', 1);
      var cols = ['#ffd34d', '#4fb3e8', '#6aa84f', '#ff6fa3'];
      for (i = 0; i < 12; i++) { a = W(i / 12 * Math.PI * 2, R); g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(a[0], a[1] + 4, 4.2, 0, Math.PI * 2); g.fill(); }
      K.line(K.P(cx - 0.7, y + 0.5, 0), K.P(cx, y, cz), '#aab3c0', 4);
      K.line(K.P(cx + 0.7, y + 0.5, 0), K.P(cx, y, cz), '#aab3c0', 4);
      K.ball(cx, y, cz, 5, '#e7b93c');
      K.box(1.0, 2.3, 2.0, 2.7, 0, 9, '#e0453a', '#ffd34d');
    }],
    w_turm: [200, function (K) {
      K.lot(3, PAVE);
      K.quad(0.6, 0.6, 2.4, 2.4, 0, GRASS);
      var c = '#6f7c8c', g = K.g;
      var legs = [[0.35, 0.35], [2.65, 0.35], [0.35, 2.65], [2.65, 2.65]];
      for (var i = 0; i < 4; i++) {
        var a = K.P(legs[i][0], legs[i][1], 0), b = K.P(1.5 + (legs[i][0] - 1.5) * 0.45, 1.5 + (legs[i][1] - 1.5) * 0.45, 52);
        g.beginPath(); g.moveTo(a[0] - 4, a[1]); g.lineTo(a[0] + 4, a[1]); g.lineTo(b[0] + 3, b[1]); g.lineTo(b[0] - 3, b[1]); g.closePath();
        g.fillStyle = i === 1 ? A.shade(c, -0.25) : (i === 3 ? A.shade(c, -0.1) : c); g.fill();
      }
      K.box(0.95, 0.95, 2.05, 2.05, 50, 56, '#8794a5');
      K.frustum(1.5, 1.5, 0.5, 0.26, 56, 110, c);
      K.box(1.2, 1.2, 1.8, 1.8, 110, 115, '#8794a5');
      K.frustum(1.5, 1.5, 0.24, 0.05, 115, 176, c);
      K.line(K.P(1.5, 1.5, 176), K.P(1.5, 1.5, 194), '#c9d2dc', 1.4);
      for (var z = 62; z < 108; z += 9) K.line(K.P(1.5 - 0.5 + (z - 56) * 0.0044, 1.5 + 0.5 - (z - 56) * 0.0044, z), K.P(1.5 + 0.5 - (z - 56) * 0.0044, 1.5 + 0.5 - (z - 56) * 0.0044, z), 'rgba(255,255,255,.35)', 0.8);
    }],
    w_freiheit: [150, function (K) {
      K.lot(3, '#86cf72');
      K.frustum(1.5, 1.5, 1.2, 1.0, 0, 10, '#bdb6a6');
      K.frustum(1.5, 1.5, 0.7, 0.5, 10, 50, '#d6cfbf');
      var c = '#6fc2a8';
      K.cone(1.5, 1.5, 0.36, 50, 44, c);
      K.cyl(1.5, 1.5, 0.17, 84, 100, c);
      K.ball(1.5, 1.5, 107, 7, c);
      var g = K.g, h = K.P(1.5, 1.5, 112);
      for (var i = -2; i <= 2; i++) K.line([h[0] + i * 2, h[1]], [h[0] + i * 5, h[1] - 9 + Math.abs(i)], c, 1.6);
      K.line(K.P(1.5, 1.62, 98), K.P(1.2, 1.7, 128), c, 4.5);
      K.ball(1.2, 1.7, 133, 4.5, '#ffb52e'); K.ball(1.2, 1.7, 137, 2.6, '#ffe27a');
      K.box(1.62, 1.6, 1.8, 1.72, 84, 96, '#8fd6bf');
      void g;
    }],
    w_pyramide: [120, function (K) {
      K.lot(4, '#e8d8a0');
      var c = '#e3c476', g = K.g;
      K.frustum(2, 2, 1.8, 0.28, 0, 92, c);
      K.frustum(2, 2, 0.28, 0, 92, 106, '#e7b93c');
      for (var i = 1; i < 9; i++) {
        var r = 1.8 - (1.52 * i / 9), z = 92 * i / 9;
        K.line(K.P(2 - r, 2 + r, z), K.P(2 + r, 2 + r, z), 'rgba(120,90,30,.28)', 0.8);
        K.line(K.P(2 + r, 2 - r, z), K.P(2 + r, 2 + r, z), 'rgba(90,60,20,.3)', 0.8);
      }
      K.palm(0.35, 3.6, 0.8); K.palm(3.65, 3.7, 0.7);
      void g;
    }],
    w_rakete: [150, function (K) {
      K.lot(3, '#b9bec6');
      K.box(0.4, 0.4, 2.6, 2.6, 0, 8, '#8a94a3');
      K.box(0.55, 0.9, 0.95, 1.3, 8, 112, '#b5533c');
      for (var z = 20; z < 110; z += 12) K.line(K.P(0.55, 1.3, z), K.P(0.95, 1.3, z + 10), 'rgba(255,255,255,.4)', 0.8);
      K.cyl(1.55, 1.3, 0.3, 14, 92, '#e98a3a'); K.cone(1.55, 1.3, 0.3, 92, 26, '#e98a3a');
      K.cyl(1.2, 1.55, 0.11, 12, 78, '#f4f6f8'); K.cone(1.2, 1.55, 0.11, 78, 10, '#f4f6f8');
      K.cyl(1.9, 1.05, 0.11, 12, 78, '#f4f6f8'); K.cone(1.9, 1.05, 0.11, 78, 10, '#f4f6f8');
      K.cyl(1.75, 1.6, 0.2, 16, 74, '#ffffff'); K.cone(1.75, 1.6, 0.2, 74, 20, '#2b2f3a');
      K.poly([K.P(1.55, 1.95, 16), K.P(2.25, 1.75, 16), K.P(1.9, 1.7, 44)], '#eceff3');
      K.line(K.P(0.95, 1.2, 70), K.P(1.4, 1.3, 70), '#b5533c', 2);
    }]
  };

  // Platzhalter für die neuen Gebäude (werden von echten Assets ersetzt)
  DRAW.luxreihenhaus = [64, function (K) {
    K.lot(2, GRASS);
    K.quad(0.2, 1.72, 1.8, 1.97, 0, '#e9e2d0');
    K.box(0.25, 0.35, 1.75, 1.7, 0, 32, '#f4efe6');
    K.winL(0.3, 1.7, 1.7, 3, 30, 4, 2, '#3d5a73', 0.5, 0.55, LIT);
    K.doorL(0.47, 1.7, 0.16, 12, '#2f4a3a'); K.doorL(1.17, 1.7, 0.16, 12, '#2f4a3a');
    K.winR(0.45, 1.6, 1.75, 3, 30, 2, 2, '#3d5a73', 0.5, 0.55);
    K.gable(0.25, 0.35, 1.75, 1.7, 32, 16, '#2f3b4a', '#f4efe6');
    K.bush(0.3, 1.85, '#3f9b4b'); K.bush(1.75, 1.85, '#3f9b4b');
  }];
  DRAW.luxvilla = [80, function (K) {
    K.lot(3, GRASS);
    K.quad(0.15, 1.8, 1.5, 2.85, 0, '#f1ead8');
    K.quad(0.3, 1.95, 1.35, 2.7, 0, '#3fc6f0', 'rgba(255,255,255,.85)');
    K.box(0.35, 0.35, 2.65, 1.65, 0, 22, '#ffffff', '#e8ecef');
    K.winL(0.4, 2.6, 1.65, 3, 20, 3, 1, '#7fd3e8', 0.85, 0.85);
    K.winR(0.4, 1.6, 2.65, 3, 20, 2, 1, '#7fd3e8', 0.85, 0.85);
    K.box(1.2, 0.5, 2.6, 1.5, 22, 42, '#ffffff', '#e8ecef');
    K.winL(1.25, 2.55, 1.5, 25, 40, 2, 1, '#7fd3e8', 0.85, 0.85);
    K.winR(0.55, 1.45, 2.6, 25, 40, 2, 1, '#7fd3e8', 0.85, 0.85);
    K.box(1.7, 1.65, 2.65, 2.6, 0, 18, '#ffffff', '#e8ecef');
    K.winL(1.75, 2.6, 2.6, 3, 16, 2, 1, '#7fd3e8', 0.85, 0.85);
    K.palm(0.3, 0.45, 1); K.palm(2.75, 2.8, 0.9);
  }];
  DRAW.penthouse = [150, function (K) {
    K.lot(3, PAVE);
    K.box(0.4, 0.4, 2.6, 2.6, 0, 110, '#2b2f3a', '#3a404d');
    K.winL(0.45, 2.55, 2.6, 4, 106, 4, 12, '#e7b93c', 0.8, 0.62, '#fff3c4');
    K.winR(0.45, 2.55, 2.6, 4, 106, 4, 12, '#e7b93c', 0.8, 0.62, '#fff3c4');
    K.box(0.7, 0.7, 2.3, 2.3, 110, 128, '#e7b93c', '#f3d27a');
    K.winL(0.75, 2.25, 2.3, 112, 126, 3, 1, '#7fd3e8', 0.9, 0.85);
    K.winR(0.75, 2.25, 2.3, 112, 126, 3, 1, '#7fd3e8', 0.9, 0.85);
    K.palm(1.0, 1.0, 0.6); K.flag(2.0, 1.2, 128, 14, '#e7b93c');
  }];
  DRAW.hafenbar = [66, function (K) {
    K.lot(3, '#c9b48a');
    K.quad(0.05, 2.2, 2.95, 2.95, 0, '#3fa7d6');
    for (var i = 0; i < 6; i++) K.box(0.1 + i * 0.48, 2.2, 0.5 + i * 0.48, 2.95, 1, 3, '#a87a4a');
    shop(K, 3, { wall: '#ffffff', roof: '#2f7fb8', a1: '#2f7fb8', a2: '#ffffff', h: 22 });
    K.flag(2.4, 0.6, 24, 18, '#e0453a');
  }];
  DRAW.kristallbrunnen = [60, function (K) {
    K.lot(2, '#e9e4d8');
    K.cyl(1, 1, 0.66, 0, 8, '#dfe6ec', '#7fe0ff');
    K.frustum(1, 1, 0.22, 0.05, 8, 40, '#bff3ff');
    K.ball(1, 1, 44, 5, '#e6fbff');
    var t = K.P(1, 1, 44), g = K.g;
    for (var i = -3; i <= 3; i++) {
      g.beginPath(); g.moveTo(t[0], t[1]); g.quadraticCurveTo(t[0] + i * 6, t[1] - 10, t[0] + i * 12, t[1] + 30 - Math.abs(i));
      g.strokeStyle = 'rgba(190,240,255,.9)'; g.lineWidth = 1.4; g.stroke();
    }
  }];

  // Sprite holen: echtes Asset (assets/sprites/<id>.svg) oder gezeichneter Platzhalter
  // Asset-Regel: Breite = 64 × Größe; die Grundfläche (Raute) liegt bündig am unteren Bildrand.
  A.sprite = function (id) {
    if (cache[id]) return cache[id];
    var ac = MC.Assets && MC.Assets.canvas(id);
    if (ac) {
      var sz = MC.DEF[id] ? MC.DEF[id].size : 1;
      return (cache[id] = { c: ac, w: ac.lw, h: ac.lh, ox: ac.lw / 2, oy: ac.lh - sz * 32, top: ac.lh - sz * 32, asset: true });
    }
    var d = MC.DEF[id], def = DRAW[id], n = d.size, maxH = def[0];
    var w = n * 64, h = n * 32 + maxH + 6;
    var c = document.createElement('canvas');
    c.width = w * SS; c.height = h * SS;
    var g = c.getContext('2d');
    g.scale(SS, SS); g.lineJoin = 'round';
    def[1](kit(g, n * HW, maxH + 4), n);
    return (cache[id] = { c: c, w: w, h: h, ox: n * HW, oy: maxH + 4, top: maxH });
  };
  var urls = {};
  A.url = function (id) {
    var u = MC.Assets && MC.Assets.url(id);
    return u || urls[id] || (urls[id] = A.sprite(id).c.toDataURL());
  };
  // Nach dem Laden der Assets: Cache leeren, damit echte Grafiken greifen
  A.reset = function () { cache = {}; urls = {}; };
  // Beliebiges Zusatz-Asset (Symbole, Porträts, Sammelstücke) – null, wenn nicht vorhanden
  A.img = function (id) { return MC.Assets ? MC.Assets.canvas(id) : null; };
  A.kit = kit;
})();
