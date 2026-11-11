/* Glücksrad v21: App-Shell vollständig offline bereitstellen. */
const CACHE_NAME = 'gluecksrad-pwa-v21-1';
const OLD_CACHE_PREFIX = 'gluecksrad-pwa-';
const FILES = [
  './',
  './index.html',
  './woerter.html',
  './styles.css',
  './woerter.css',
  './woerter.js',
  './woerter-ansicht.js',
  './spiel.js',
  './raetselbrett.js',
  './raetselverlauf.js',
  './feen.js',
  './buchstabenfee.js',
  './pwa.js',
  './manifest.webmanifest',
  './buchstabenwand.webp',
  './buchstabenfee/alf-atlas.webp',
  './buchstabenfee/marin-atlas.webp',
  './buchstabenfee/pamela-atlas.webp',
  './buchstabenfee/picard-atlas.webp',
  './buchstabenfee/pirat-atlas.webp',
  './buchstabenfee/sonya-atlas.webp',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name.startsWith(OLD_CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  // Keine fremden Origins oder URLs außerhalb des Installationsordners cachen.
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

  if (event.request.mode === 'navigate') {
    // Für Seiten bei Verbindung frische Version verwenden, ohne Netz aus Cache.
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(event.request, { ignoreSearch: true })) ||
        (await cache.match('./index.html'));
    }));
    return;
  }

  // Vorkonfigurierte Skripte, Grafiken und Styles auch ohne Internet laden.
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then(cached => cached || fetch(event.request)));
});
