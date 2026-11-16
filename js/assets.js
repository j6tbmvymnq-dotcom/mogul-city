/* Mogul City – Asset-Lader.
   Liest assets/manifest.json (erzeugt von tools/assets.js) und lädt alle vorhandenen Grafiken/Töne.
   Fehlt eine Datei, nutzt das Spiel automatisch den gezeichneten bzw. synthetischen Platzhalter. */
(function () {
  'use strict';
  var MC = window.MC;
  var AS = MC.Assets = { manifest: { sprites: {}, sounds: {}, voice: {} }, ready: false };
  var SS = 2;                 // Rasterauflösung (Retina)
  var BASE = window.MC_ASSET_BASE || '';   // Galerie unter tools/ setzt '../'
  var canv = {}, urls = {}, buffers = {}, listeners = [];

  AS.onReady = function (f) { if (AS.ready) f(); else listeners.push(f); };
  AS.has = function (id) { return !!canv[id]; };
  AS.canvas = function (id) { return canv[id] || null; };
  AS.url = function (id) { return urls[id] || null; };
  AS.sound = function (id) { return AS.manifest.sounds[id] || null; };
  AS.voice = function (adv, line) { var v = AS.manifest.voice[adv]; return v && v[line] ? BASE + 'assets/voice/' + adv + '/' + v[line] : null; };

  function raster(id, src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        if (!w || !h) return res();
        if (/\.png$/i.test(src)) { w /= 2; h /= 2; }   // PNG-Assets liegen in doppelter Auflösung vor
        var c = document.createElement('canvas');
        var ss = /^berg_/.test(id) ? SS * 2.5 : SS;   // Berge werden bis 2,6-fach groß gezeichnet
        c.width = Math.round(w * ss); c.height = Math.round(h * ss);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.lw = w; c.lh = h;          // logische Größe in Spielpixeln
        canv[id] = c; urls[id] = src;
        res();
      };
      im.onerror = function () { res(); };
      im.src = src;
    });
  }

  AS.load = function () {
    return fetch(BASE + 'assets/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (m) {
        if (m) AS.manifest = { sprites: m.sprites || {}, sounds: m.sounds || {}, voice: m.voice || {}, version: m.version };
        var ids = Object.keys(AS.manifest.sprites), done = 0;
        var jobs = ids.map(function (id) {
          return raster(id, BASE + 'assets/sprites/' + AS.manifest.sprites[id]).then(function () { done++; if (AS.onProgress) AS.onProgress(done / ids.length); });
        });
        return Promise.all(jobs);
      })
      .then(function () { AS.ready = true; listeners.forEach(function (f) { f(); }); listeners = []; });
  };

  // ---------- Audio ----------
  var ac = null, master = null, musicGain = null;
  AS.ctx = function () {
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C(); master = ac.createGain(); master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.45; musicGain.connect(ac.destination);
      applySession();
    }
    // iOS: nach Anruf/App-Wechsel steht der Kontext auf „suspended“ oder „interrupted“
    if (ac.state !== 'running' && ac.state !== 'closed') { try { ac.resume(); } catch (e) { } }
    return ac;
  };

  /* Ton trotz Stummschalter (iPhone/iPad). Web Audio folgt auf iOS dem Stummschalter („ambient“).
     iOS 17+: navigator.audioSession.type = 'playback'. Älter: ein stiller, geloopter <audio>-Clip, beim ersten
     Antippen gestartet, schaltet die Audio-Sitzung ebenfalls auf Wiedergabe. Nachteil: fremde Musik pausiert –
     deshalb abschaltbar (Menü). */
  var ignoreMute = true, silent = null;
  function silentUrl() {
    var sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function applySession() {
    var as = navigator.audioSession;
    if (as) { try { as.type = ignoreMute ? 'playback' : 'ambient'; } catch (e) { } return; }
    if (ignoreMute) {
      if (!silent) { silent = new Audio(silentUrl()); silent.loop = true; silent.setAttribute('playsinline', ''); }
      var pr = silent.play(); if (pr && pr.catch) pr.catch(function () { });
    } else if (silent) silent.pause();
  }
  AS.setIgnoreMute = function (on) { ignoreMute = !!on; if (ac) applySession(); };
  AS.master = function () { AS.ctx(); return master; };
  function buffer(url) {
    if (buffers[url]) return buffers[url];
    buffers[url] = fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (data) {
      return new Promise(function (res, rej) { ac.decodeAudioData(data, res, rej); });
    }).catch(function () { return null; });
    return buffers[url];
  }
  AS.preloadSounds = function () {
    if (!AS.ctx()) return;
    Object.keys(AS.manifest.sounds).forEach(function (id) { buffer(BASE + 'assets/sounds/' + AS.manifest.sounds[id]); });
  };
  // Spielt eine Datei ab; liefert false, wenn keine Datei vorhanden ist
  AS.play = function (id, vol) {
    var f = AS.manifest.sounds[id];
    if (!f || !AS.ctx()) return false;
    buffer(BASE + 'assets/sounds/' + f).then(function (b) {
      if (!b) return;
      var s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = b; g.gain.value = vol || 1; s.connect(g); g.connect(master); s.start();
    });
    return true;
  };

  // Sprecher: immer nur eine Zeile gleichzeitig
  var voiceSrc = null;
  AS.say = function (url) {
    if (!url || !AS.ctx()) return false;
    buffer(url).then(function (b) {
      if (!b) return;
      if (voiceSrc) try { voiceSrc.stop(); } catch (e) { }
      var s = ac.createBufferSource(); s.buffer = b; s.connect(master); s.start(); voiceSrc = s;
      // Musik während der Sprache absenken
      var t = ac.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setTargetAtTime(0.15, t, 0.1);
      musicGain.gain.setTargetAtTime(0.45, t + b.duration, 0.4);
    });
    return true;
  };

  // Musik: Stücke aus dem Manifest nacheinander in Schleife
  var musicSrc = null, musicOn = false, track = 0;
  AS.musicMode = 'erde';
  AS.setMusicMode = function (m) {   // Erde/Mond: anderes Stück, falls vorhanden
    if (AS.musicMode === m) return;
    AS.musicMode = m;
    if (musicOn) { AS.music(false); AS.music(true); }
  };
  AS.music = function (on) {
    musicOn = on;
    if (!on) { if (musicSrc) try { musicSrc.stop(); } catch (e) { } musicSrc = null; return; }
    if (musicSrc || !AS.ctx()) return;
    var all = MC.MUSIC.map(function (m) { return m[0]; }).filter(function (id) { return AS.manifest.sounds[id]; });
    var list = AS.musicMode === 'mond' && all.indexOf('musik_mond') >= 0 ? ['musik_mond'] : all.filter(function (id) { return id !== 'musik_mond'; });
    if (!list.length) return;
    var id = list[track % list.length];
    musicSrc = { stop: function () { } };
    buffer(BASE + 'assets/sounds/' + AS.manifest.sounds[id]).then(function (b) {
      if (!b || !musicOn) { musicSrc = null; return; }
      var s = ac.createBufferSource(); s.buffer = b; s.connect(musicGain);
      s.loop = list.length === 1;
      s.onended = function () { if (musicSrc === s) { musicSrc = null; track++; if (musicOn) AS.music(true); } };
      s.start(); musicSrc = s;
    });
  };
})();
