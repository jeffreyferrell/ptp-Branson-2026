// Service worker - always fetch index.html fresh, cache everything else
const CACHE = 'ptp-2026-v4';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Always fetch index.html and admin.html fresh from network
  if (url.pathname.endsWith('index.html') || 
      url.pathname.endsWith('/') || 
      url.pathname.endsWith('admin.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Cache everything else (icons, manifest, sw.js)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
