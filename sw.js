/* Cap studio service worker: makes the app installable and lets it open offline.
   Bump VERSION whenever you upload a new index.html so returning visitors get the update. */
const VERSION = 'cap-studio-v29';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
// Third-party files the app needs: the 3D engine and the fonts
const VENDOR = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];
const VENDOR_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await Promise.all(VENDOR.map(u => cache.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages: try the network first so updates show up, fall back to the saved copy offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 3D engine and fonts: serve from cache, fetch once if missing
  if (VENDOR_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, res.clone());
        return res;
      } catch (e) { return Response.error(); }
    })());
    return;
  }

  // Everything else on this site: answer from cache right away, refresh it in the background
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
