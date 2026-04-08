/// <reference lib="webworker" />
// Agent Desk PWA service worker.
// - Caches the UI shell (HTML/JS/CSS/vendor libs) on install.
// - Network-first for /api/* (with offline fallback to cached shell).
// - Lets /ws (WebSocket) pass straight through — never cached.
// - Bump CACHE_VERSION to invalidate old caches.

export {};

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'agent-desk-pwa-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// Paths that make up the offline shell. Vite will fingerprint JS/CSS at
// build time; the runtime fetch handler caches those lazily on first hit.
const SHELL_ASSETS: string[] = ['/', '/index.html', '/manifest.webmanifest', '/icons/192.png', '/icons/512.png'];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // Best-effort: don't fail install if one asset 404s during dev.
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('agent-desk-pwa-') && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept WebSocket upgrades or non-GET requests.
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/ws')) return;

  // Network-first for API — fall back to cached shell for navigations offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r ?? new Response('offline', { status: 503 }))),
    );
    return;
  }

  // Navigations: serve cached index.html when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r ?? new Response('offline', { status: 503 }))),
    );
    return;
  }

  // Static assets: cache-first, populate on first network hit.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    }),
  );
});
