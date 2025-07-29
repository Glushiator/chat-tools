const CACHE_NAME = 'geo-timestamp-cache-v1';
const OFFLINE_URL = 'index.html';
const PRECACHE_ASSETS = [
  './index.html',
  './index.js',
  './manifest.json',
  './icon-256.png',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/css/materialdesignicons.min.css',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.eot?',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.woff2?v=5.8.55',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.woff?v=5.8.55',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.eot?v=5.8.55',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.ttf?v=5.8.55',
  './cdn.jsdelivr.net/npm/buefy@1/dist/buefy.min.js',
  './cdn.jsdelivr.net/npm/buefy@1/dist/buefy.min.css',
  './unpkg.com/vue@3/dist/vue.global.prod.js',
  './use.fontawesome.com/releases/v5.2.0/css/all.css',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.woff2',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.woff2',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.eot?',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.ttf',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.eot?',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.ttf',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.woff2',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.eot?',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
