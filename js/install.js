/* Mogul City – Erst auf den Home-Bildschirm, dann spielen.
   Im Browser: Stadt benennen -> Anleitung passend zum Gerät. Gespielt wird nur in der installierten App.
   Wichtig: Auf iPhone/iPad teilt die Home-Bildschirm-App KEINEN Speicher mit Safari. Der Name kommt
   deshalb über den Cloud-Code in der Adresse (?code=…) mit; das Manifest hat dafür absichtlich keine
   start_url (dann übernimmt das System die aktuelle Adresse samt Code).
   Ausnahmen: Desktop-Rechner (Entwicklung), ?browser=1 und „Trotzdem im Browser spielen“. */
(function () {
  'use strict';
  var MC = window.MC;
  var ua = navigator.userAgent || '', KEY = 'mogulcity.browser';
  var I = MC.Install = { prompt: null };

  // ---------- Gerät erkennen ----------
  var iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;   // iPad meldet sich als Mac
  var ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  var android = /Android/i.test(ua);
  function ver(re) { var m = re.exec(ua); return m ? parseFloat(m[1].replace('_', '.')) : 0; }
  I.env = {
    ios: ios, android: android, ipad: /iPad/.test(ua) || iPadOS,
    osVer: ios ? ver(/OS (\d+[_.]\d+)/) : android ? ver(/Android (\d+(?:\.\d+)?)/) : 0,
    safariVer: ver(/Version\/(\d+(?:\.\d+)?)/),
    browser: /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|LinkedInApp|Pinterest|Twitter|GSA\//.test(ua) ? 'inapp'
      : /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS|EdgA/.test(ua) ? 'edge'
      : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox'
      : /; wv\)/.test(ua) ? 'inapp' : /Chrome/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other'
  };
  // Safari 26 meldet die Systemversion eingefroren – die Safari-Version ist dort aussagekräftiger
  if (ios && I.env.browser === 'safari' && I.env.safariVer >= 26) I.env.osVer = Math.max(I.env.osVer, I.env.safariVer);

  I.standalone = function () {
    return navigator.standalone === true || ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) {
      return window.matchMedia && window.matchMedia('(display-mode: ' + m + ')').matches;
    });
  };
  function bypass() {
    if (/[?&]browser=1/.test(location.search)) { try { localStorage.setItem(KEY, '1'); } catch (e) { } return true; }
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  I.needed = function () { return (ios || android) && !I.standalone() && !bypass(); };

  // Android/Chrome: eigener Installieren-Knopf
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); I.prompt = e; if (I.refresh) I.refresh(); });
  window.addEventListener('appinstalled', function () { I.installed = true; if (I.refresh) I.refresh(); });

  // ---------- Symbole (Inline-SVG, keine Emojis) ----------
  var SV = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    share: '<svg ' + SV + '><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    plus: '<svg ' + SV + '><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg ' + SV + '><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg>',
    vdots: '<svg ' + SV + '><circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/></svg>',
    burger: '<svg ' + SV + '><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    check: '<svg ' + SV + '><path d="M5 12l5 5 9-10"/></svg>',
    home: '<svg ' + SV + '><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>',
    compass: '<svg ' + SV + '><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    copy: '<svg ' + SV + '><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    down: '<svg ' + SV + '><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>'
  };
  function step(icon, html) { return '<li><span class="ic">' + icon + '</span><span>' + html + '</span></li>'; }

  // ---------- Anleitung passend zum Gerät ----------
  function guide() {
    var e = I.env, dev = e.ipad ? 'iPad' : ios ? 'iPhone' : android ? 'Android-Handy' : 'Gerät', s = [];
    if (e.browser === 'inapp') {
      return { title: 'Bitte im richtigen Browser öffnen',
        text: 'Du hast den Link in einer App geöffnet (z. B. Instagram oder Facebook). Von dort lässt sich Mogul City nicht auf den Home-Bildschirm legen.',
        steps: [step(IC.dots, 'Tippe oben rechts auf <b>…</b> bzw. das Menü.'),
          step(IC.compass, ios ? 'Wähle <b>In Safari öffnen</b> (oder „Im Browser öffnen“).' : 'Wähle <b>Im Browser öffnen</b> (Chrome).'),
          step(IC.copy, 'Klappt das nicht: Link unten kopieren und in ' + (ios ? 'Safari' : 'Chrome') + ' einfügen.')], copy: true };
    }
    if (ios) {
      if (e.browser !== 'safari' && e.osVer && e.osVer < 16.4) {
        return { title: 'Bitte in Safari öffnen', text: 'Auf deinem ' + dev + ' (iOS ' + Math.floor(e.osVer) + ') geht „Zum Home-Bildschirm“ nur in Safari.',
          steps: [step(IC.copy, 'Link unten kopieren.'), step(IC.compass, 'Safari öffnen, Link in die Adresszeile einfügen.'), step(IC.share, 'Dann erscheint dort diese Anleitung für Safari.')], copy: true };
      }
      var where = e.ipad ? 'oben rechts' : 'unten';
      if (e.browser === 'chrome' || e.browser === 'edge') {
        s.push(step(IC.share, 'Tippe auf <b>Teilen</b> ' + (e.browser === 'chrome' ? 'rechts in der Adresszeile' : 'im Menü') + '.'));
      } else if (e.browser === 'firefox') {
        s.push(step(IC.burger, 'Tippe auf das <b>Menü</b> (drei Striche) und dann auf <b>Teilen</b>.'));
      } else if (e.osVer >= 26) {
        s.push(step(IC.dots, 'Tippe auf <b>…</b> ' + (e.ipad ? 'oben rechts' : 'unten rechts neben der Adresszeile') + ' und dann auf <b>Teilen</b>.'));
      } else {
        s.push(step(IC.share, 'Tippe ' + where + ' auf <b>Teilen</b> (Quadrat mit Pfeil nach oben).'));
      }
      s.push(step(IC.plus, 'Scrolle etwas nach unten und wähle <b>Zum Home-Bildschirm</b>' + (e.osVer >= 26 ? ' (eventuell erst unter <b>Mehr</b>)' : '') + '.'));
      if (e.osVer >= 26) s.push(step(IC.check, '<b>Als Web-App öffnen</b> eingeschaltet lassen und <b>Hinzufügen</b> tippen.'));
      else s.push(step(IC.check, 'Oben rechts auf <b>Hinzufügen</b> tippen.'));
      s.push(step(IC.home, 'Mogul City jetzt über das neue Symbol auf dem Home-Bildschirm starten.'));
      return { title: 'Leg Mogul City auf deinen Home-Bildschirm', text: 'Als App auf deinem ' + dev + ' läuft das Spiel im Vollbild, mit Ton und ohne Browserleisten.', steps: s, arrow: e.browser === 'safari' && e.osVer < 26 && !e.ipad };
    }
    if (android) {
      if (I.prompt) return { title: 'Installiere Mogul City', text: 'Ein Tipp genügt – danach startest du das Spiel wie eine App.', steps: [], install: true };
      if (e.browser === 'samsung') {
        s.push(step(IC.burger, 'Tippe unten rechts auf das <b>Menü</b> (drei Striche).'));
        s.push(step(IC.plus, 'Wähle <b>Seite hinzufügen zu</b> und dann <b>Startbildschirm</b>.'));
      } else if (e.browser === 'firefox') {
        s.push(step(IC.vdots, 'Tippe auf das <b>Menü</b> (drei Punkte).'));
        s.push(step(IC.plus, 'Wähle <b>Installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.'));
      } else {
        s.push(step(IC.vdots, 'Tippe oben rechts auf das <b>Menü</b> (drei Punkte).'));
        s.push(step(IC.plus, 'Wähle <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.'));
      }
      s.push(step(IC.check, 'Mit <b>Installieren</b> bzw. <b>Hinzufügen</b> bestätigen.'));
      s.push(step(IC.home, 'Mogul City über das neue Symbol starten.'));
      return { title: 'Leg Mogul City auf deinen Startbildschirm', text: 'Als App läuft das Spiel im Vollbild und ohne Browserleisten.', steps: s };
    }
    return { title: 'Mogul City als App', text: 'Öffne diesen Link am besten auf deinem iPhone, iPad oder Android-Handy und lege ihn dort auf den Home-Bildschirm.',
      steps: [step(IC.share, 'Im Browser auf <b>Teilen</b> oder das <b>Menü</b> tippen.'), step(IC.plus, '<b>Zum Home-Bildschirm</b> bzw. <b>App installieren</b> wählen.'), step(IC.home, 'Über das neue Symbol starten.')], copy: true };
  }

  // ---------- Anzeige ----------
  I.show = function (name, code) {
    var box = document.getElementById('install');
    if (!box) { box = document.createElement('div'); box.id = 'install'; document.body.appendChild(box); }
    document.body.classList.add('gated');
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    I.refresh = function () {
      var g = guide(), done = I.installed;
      box.innerHTML = '<div class="inner">' +
        '<img class="logo" src="icons/icon-192.png" alt="">' +
        (name ? '<div class="city">Deine Stadt: <b>' + esc(name) + '</b> ist reserviert.</div>' : '') +
        (done ? '<h2>Fertig installiert</h2><p>Schließe dieses Fenster und starte Mogul City über das neue Symbol.</p>'
          : '<h2>' + g.title + '</h2><p>' + g.text + '</p>' + (g.steps.length ? '<ol>' + g.steps.join('') + '</ol>' : '') +
            (g.install ? '<button class="btn primary big" id="instBtn">' + IC.down + ' Installieren</button>' : '') +
            (g.copy ? '<button class="btn ghost" id="instCopy">' + IC.copy + ' Link kopieren</button>' : '')) +
        (code ? '<div class="code">Dein Stadt-Code: <b>' + esc(code) + '</b><span>Falls die App danach fragt – damit holst du deine Stadt.</span></div>' : '') +
        '<button class="escape" id="instEsc">Geht bei mir nicht</button>' +
        '</div>' + (g.arrow && !done ? '<div class="arrow"></div>' : '');
      var b = document.getElementById('instBtn');
      if (b) b.onclick = function () {
        var p = I.prompt; if (!p) return; I.prompt = null;
        p.prompt(); (p.userChoice || Promise.resolve({})).then(function (r) { if (r && r.outcome === 'accepted') I.installed = true; I.refresh(); });
      };
      var c = document.getElementById('instCopy');
      if (c) c.onclick = function () {
        var link = (MC.Cloud && MC.Cloud.code) ? MC.Cloud.link() : location.href;
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { c.textContent = 'Link kopiert'; }, function () { prompt('Link kopieren:', link); });
      };
      document.getElementById('instEsc').onclick = function () {
        this.outerHTML = '<p class="small">Manche Geräte oder Browser können keine Web-Apps anlegen. Du kannst dann im Browser spielen – Vollbild und Ton funktionieren dort aber nicht immer zuverlässig.</p>' +
          '<button class="btn ghost" id="instBrowser">Trotzdem im Browser spielen</button>';
        document.getElementById('instBrowser').onclick = function () {
          try { localStorage.setItem(KEY, '1'); } catch (e) { }
          document.body.classList.remove('gated'); box.parentNode.removeChild(box); I.refresh = null;
          if (I.onBypass) I.onBypass();
        };
      };
    };
    I.refresh();
  };

  // iPhone-App mit durchsichtiger Statusleiste: iOS meldet die Fensterhöhe teils um die Statusleiste zu kurz,
  // unten bleibt dann ein Streifen frei. Dann die volle Bildschirmhöhe erzwingen (nur iPhone: dort immer Vollbild).
  function fitPhone() {
    if (!ios || I.env.ipad || !I.standalone() || !window.screen) return;
    var portrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
    var full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    var st = document.body.style;
    if (window.innerHeight < full - 10) { st.height = full + 'px'; st.bottom = 'auto'; } else { st.height = ''; st.bottom = ''; }
  }
  I.fitPhone = fitPhone;
  if (document.body) fitPhone(); else document.addEventListener('DOMContentLoaded', fitPhone);
  window.addEventListener('resize', fitPhone);
  window.addEventListener('orientationchange', function () { setTimeout(fitPhone, 150); });

  // iPhone/iPad: zusätzlich ein Manifest mit fester Startadresse samt Code (falls iOS die start_url doch liest)
  I.pinCode = function (code) {
    if (!ios || !code) return;
    try {
      var base = location.origin + location.pathname.replace(/[^/]*$/, '');
      var m = { name: 'Mogul City', short_name: 'Mogul City', lang: 'de', display: 'standalone', scope: base,
        start_url: base + '?code=' + code, background_color: '#2f86b0', theme_color: '#16233b',
        icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] };
      var l = document.querySelector('link[rel="manifest"]');
      if (l) l.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(m));
    } catch (e) { }
  };
})();
