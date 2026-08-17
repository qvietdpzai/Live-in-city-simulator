/* ============================================================
 * sw.js — offline cache for "Live in City"
 * ============================================================ */

const CACHE = 'live-in-city-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/sprites.js',
  './js/map.js',
  './js/sim.js',
  './js/render.js',
  './js/audio.js',
  './js/input.js',
  './js/ui.js',
  './js/main.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
