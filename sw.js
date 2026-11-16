/* Mogul City – Offline-Cache. Bei jeder Änderung am Spiel VERSION erhöhen. */
var VERSION = 'mogulcity-6556d60a';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/data.js', 'js/game.js', 'js/cloud.js', 'js/assets.js', 'js/art.js', 'js/view.js', 'js/ui.js',
  'js/install.js', 'js/tutorial.js', 'js/mond.js', 'js/mondui.js', 'assets/staedte/bella.json', 'assets/staedte/viktor.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
// Alle Assets aus dem Manifest (Grafik, Ton, Sprache) für den Offline-Betrieb vorab laden
function assetFiles() {
  return fetch('assets/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
    var out = ['assets/manifest.json'];
    Object.keys(m.sprites || {}).forEach(function (k) { out.push('assets/sprites/' + m.sprites[k]); });
    Object.keys(m.sounds || {}).forEach(function (k) { out.push('assets/sounds/' + m.sounds[k]); });
    Object.keys(m.voice || {}).forEach(function (a) { Object.keys(m.voice[a]).forEach(function (l) { out.push('assets/voice/' + a + '/' + m.voice[a][l]); }); });
    return out;
  }).catch(function () { return []; });
}
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FILES).then(assetFiles).then(function (list) {
      return Promise.all(list.map(function (u) { return c.add(u).catch(function () { }); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // Netzwerk zuerst (Updates kommen sofort an), Cache nur offline
  // eigene Dateien immer beim Server nachfragen (sonst liefert der Browser-Cache bis zu 10 Min. alte Stände)
  var own = new URL(e.request.url).origin === location.origin;
  var req = own ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && new URL(e.request.url).origin === location.origin) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true });
  }));
});
