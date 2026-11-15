/* Mogul City – Cloud-Spielstand über einen persönlichen Code (…/?code=XXXXXXXX).
   Aktiv nur, wenn js/config.js eine Supabase-URL und einen Schlüssel enthält.
   Abgleich über eine Revisionsnummer: Wer zuletzt hochgeladen hat, gewinnt. */
(function () {
  'use strict';
  var MC = window.MC, G = MC.G;
  var cfg = (window.MC_CONFIG && window.MC_CONFIG.cloud) || {};
  var CL = MC.Cloud = { enabled: !!(cfg.url && cfg.key), code: '', status: 'aus', last: 0, first: Promise.resolve() };
  // ?test=1 markiert die Stadt dauerhaft als Teststadt (nicht in Bestenliste und Statistik), ?test=0 hebt das auf
  var TEST = (/[?&]test=([01])/.exec(location.search) || [])[1];
  function markTest() { if (TEST === '1' && !G.S.test) { G.S.test = 1; G.save(); } else if (TEST === '0' && G.S.test) { delete G.S.test; G.save(); } }
  var KEY = 'mogulcity.code', ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var pulling = false, pushTimer = null, ready = false, listeners = [];

  CL.on = function (f) { listeners.push(f); };
  function set(st) { CL.status = st; listeners.forEach(function (f) { f(st); }); }
  function clean(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
  function gen() { var s = ''; for (var i = 0; i < 8; i++) s += ABC[Math.floor(Math.random() * ABC.length)]; return s; }
  function urlCode() {
    var m = /[?&#]code=([A-Za-z0-9]+)/.exec(location.search + location.hash);
    return m ? clean(m[1]) : '';
  }
  // Code in die Adresszeile schreiben, damit „Zum Home-Bildschirm“ ihn übernimmt
  function showInUrl() {
    try { history.replaceState(null, '', location.pathname + '?code=' + CL.code); } catch (e) { }
  }
  CL.link = function () { return location.origin + location.pathname + '?code=' + CL.code; };

  function rpc(name, body, keep) {
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST', keepalive: !!keep,
      headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.status === 204 ? null : r.json();
    });
  }

  // Server-Stand holen; neuer als der lokale Stand -> übernehmen
  CL.pull = function () {
    if (!CL.enabled || pulling || G.visiting) return Promise.resolve();
    pulling = true; set('lädt');
    return rpc('get_save', { p_code: CL.code }).then(function (rows) {
      var row = rows && rows[0], S = G.S;
      if (row && row.rev > (S.syncRev || 0)) {
        var d = row.data; d.syncRev = row.rev; d.cloudCode = CL.code;
        G.replace(d); markTest();
        set('geladen');
      } else if (!row || (S.dirty && row.rev === (S.syncRev || 0))) {
        ready = true; return CL.push();
      } else set('aktuell');
    }).catch(function () { set('offline'); })
      .then(function () { pulling = false; ready = true; CL.last = Date.now(); });
  };
  CL.push = function (keep) {
    if (!CL.enabled || !ready) return Promise.resolve();
    var S = G.visiting ? G.visiting.own : G.S, rev = (S.syncRev || 0) + 1;
    if (!G.visiting) S.worthCache = G.netWorth();
    S.syncRev = rev; S.cloudCode = CL.code; S.dirty = false;
    set('speichert');
    return rpc('put_save', { p_code: CL.code, p_rev: rev, p_data: S }, keep).then(function () { set('gespeichert'); CL.last = Date.now(); })
      .catch(function () { S.syncRev = rev - 1; S.dirty = true; set('offline'); });
  };
  function schedule() {
    if (!CL.enabled) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { if (!pulling) CL.push(); }, 4000);
  }

  CL.start = function () {
    if (!CL.enabled) return;
    var u = urlCode(), stored = '';
    try { stored = clean(localStorage.getItem(KEY)); } catch (e) { }
    CL.code = u || stored || G.S.cloudCode || gen();
    try { localStorage.setItem(KEY, CL.code); } catch (e) { }
    // Lokaler Stand gehört zu einem anderen Code: vom Server neu beginnen
    if (G.S.cloudCode && G.S.cloudCode !== CL.code) G.S.syncRev = 0;
    markTest();
    showInUrl();
    var orig = G.saveNow;
    G.saveNow = function () { (G.visiting ? G.visiting.own : G.S).dirty = true; orig(); schedule(); };
    CL.first = CL.pull();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(pushTimer); if (G.S.dirty) CL.push(true); }
      else CL.pull();
    });
  };
  // Anonyme Nutzungsstatistik: nur Meilensteine pro Stadt-Code (Server-Funktion log_event, docs/CLOUD.md Schritt 3).
  // onceKey: Ereignis nur einmal pro Stadt melden (gemerkt im Spielstand, gilt damit auch geräteübergreifend)
  var evDev = '', evErr = 0;
  CL.track = function (ev, val, onceKey) {
    if (!CL.enabled || !CL.code || G.visiting) return;
    if (onceKey) { var S = G.S; S.evs = S.evs || {}; if (S.evs[onceKey]) return; S.evs[onceKey] = 1; G.save(); }
    if (!evDev) {
      var I = MC.Install, e = I && I.env;
      evDev = e ? (e.ipad ? 'ipad' : e.ios ? 'iphone' : e.android ? 'android' : 'desktop') + '/' + e.browser + '/' + (I.standalone() ? 'app' : 'web') : '';
    }
    rpc('log_event', { p_code: CL.code, p_ev: String(ev), p_val: val == null ? null : String(val).slice(0, 40), p_dev: evDev }).catch(function () { });
  };
  // Skriptfehler mitzählen (höchstens 3 pro Sitzung) – zeigt, wo es technisch hakt
  window.addEventListener('error', function (e) {
    if (evErr++ < 3) CL.track('fehler', String((e && e.message) || 'unbekannt').slice(0, 40) + ' @' + String((e && e.filename) || '').split('/').pop() + ':' + ((e && e.lineno) || 0));
  });

  // Bestenliste und Besuche (Server-Funktionen list_cities / get_city / my_pub, siehe docs/CLOUD.md)
  CL.listCities = function () {
    if (!CL.enabled) return Promise.resolve([]);
    return Promise.all([rpc('list_cities', { p_code: CL.code }), rpc('my_pub', { p_code: CL.code }).catch(function () { return null; })])
      .then(function (r) { var mine = r[1]; return (r[0] || []).filter(function (c) { return c.pub_id !== mine; }); })
      .catch(function () { return []; });
  };
  CL.getCity = function (pub) { return rpc('get_city', { p_pub: pub }); };
  // Mit einem anderen Code weiterspielen (z. B. Stadt vom iPhone aufs iPad holen)
  CL.useCode = function (c) {
    c = clean(c);
    if (c.length < 6) return Promise.resolve('Der Code ist zu kurz.');
    return rpc('get_save', { p_code: c }).then(function (rows) {
      if (!rows || !rows[0]) return 'Zu diesem Code gibt es keinen Spielstand.';
      CL.code = c;
      try { localStorage.setItem(KEY, c); } catch (e) { }
      showInUrl();
      var d = rows[0].data; d.syncRev = rows[0].rev; d.cloudCode = c;
      G.replace(d); set('geladen');
      return null;
    }).catch(function () { return 'Keine Verbindung zum Server.'; });
  };
})();
