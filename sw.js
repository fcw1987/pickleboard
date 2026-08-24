const CACHE_PREFIX = 'pickleboard-';
const STATIC_CACHE = `${CACHE_PREFIX}static-v2`;
const LEGACY_CACHES = new Set(['pickleboard-cache-v1']);
const APP_SHELL_URL = new URL('./index.html', self.location).href;
const STATIC_ASSETS = [
  './',
  './index.html',
  './script.js',
  './styles.css',
  './manifest.json',
  './icons/apple-icon-180.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];
const CACHEABLE_URLS = new Set(STATIC_ASSETS.map(path => new URL(path, self.location).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const obsoletePickleboardCaches = cacheNames.filter(cacheName =>
      cacheName !== STATIC_CACHE &&
      (cacheName.startsWith(CACHE_PREFIX) || LEGACY_CACHES.has(cacheName))
    );
    await Promise.all(obsoletePickleboardCaches.map(cacheName => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

async function fetchAndRefresh(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const requestUrl = new URL(request.url);
    const shellUrl = new URL(APP_SHELL_URL);
    const scopePath = new URL(self.registration.scope).pathname;
    const isAppShell = requestUrl.pathname === shellUrl.pathname || requestUrl.pathname === scopePath;

    if (isAppShell && response.ok && response.type === 'basic') {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(APP_SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cachedShell = await caches.match(APP_SHELL_URL);
    if (!cachedShell) throw error;

    const requestPath = new URL(request.url).pathname;
    const shellPath = new URL(APP_SHELL_URL).pathname;
    const scopePath = new URL(self.registration.scope).pathname;
    if (requestPath !== shellPath && requestPath !== scopePath) {
      return Response.redirect(APP_SHELL_URL, 302);
    }
    return cachedShell;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  const normalizedUrl = new URL(requestUrl.pathname, self.location.origin).href;
  if (!CACHEABLE_URLS.has(normalizedUrl)) return;

  const normalizedRequest = new Request(normalizedUrl, { credentials: 'same-origin' });
  event.respondWith(fetchAndRefresh(normalizedRequest));
});
