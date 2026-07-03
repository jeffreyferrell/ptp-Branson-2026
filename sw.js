// Minimal service worker - no caching of index.html so changes show immediately
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // Always fetch fresh from network - no caching
  e.respondWith(fetch(e.request));
});
