const CACHE_NAME = 'geo-timestamp-cache-20260918-233401';
const OFFLINE_URL = './index.html';
const PRECACHE_ASSETS = [
  './index.html',
  './index.js',
  './manifest.json',
  './icon-256.png',
  './cdn.jsdelivr.net/npm/buefy@1/dist/buefy.min.css',
  './cdn.jsdelivr.net/npm/buefy@1/dist/buefy.min.js',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/css/materialdesignicons.min.css',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.eot',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.ttf',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.woff',
  './cdn.jsdelivr.net/npm/@mdi/font@5.8.55/fonts/materialdesignicons-webfont.woff2',
  './unpkg.com/vue@3/dist/vue.global.prod.js',
  './use.fontawesome.com/releases/v5.2.0/css/all.css',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.ttf',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-brands-400.woff2',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.ttf',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-regular-400.woff2',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.eot',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.svg',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.ttf',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.woff',
  './use.fontawesome.com/releases/v5.2.0/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', (event) => {
  // No skipWaiting() here on purpose: a new worker parks in `waiting` until the
  // Settings page explicitly promotes it, so "Check for Updates" can actually
  // see the update instead of reporting "up to date" after a silent takeover.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) {
    return;
  }
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_NAME.replace('geo-timestamp-cache-', '') });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    // ignoreSearch: the icon fonts are requested with a cache-busting query
    // (`...woff2?v=5.8.55`) that the precache list does not carry, so an exact
    // match always missed and icons fell back to tofu boxes when offline.
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).catch(async (err) => {
        if (event.request.mode === 'navigate') {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) {
            return offline;
          }
        }
        // Let the page see a real network error rather than resolving
        // respondWith() with undefined.
        throw err;
      });
    })
  );
});
