/* Offline shell. Only same-origin GET requests are cached. */
'use strict';

var CACHE = 'grocery-v2';
var SHELL = [
  './',
  './index.html',
  './app.js',
  './logic.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  var isPage = req.mode === 'navigate';
  event.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var cached = await cache.match(isPage ? './index.html' : req, { ignoreSearch: true });
    var refresh = fetch(req)
      .then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          cache.put(isPage ? './index.html' : req, res.clone());
        }
        return res;
      })
      .catch(function () { return null; });
    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    var fresh = await refresh;
    return fresh || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
