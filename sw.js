const SHELL = 'hifz-shell-v1', RUNTIME = 'hifz-runtime-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './moutoun.js', './mutashabihat.js', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // application : réseau d'abord (mises à jour), cache en secours hors ligne
  // polices : cache d'abord
  const fresh = u.origin === location.origin;
  e.respondWith(fresh
    ? fetch(e.request).then(r => { caches.open(SHELL).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request))
    : caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { caches.open(RUNTIME).then(c => c.put(e.request, r.clone())); return r; })));
});
