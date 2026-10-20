// Service worker Hifz : l'application fonctionne hors ligne, mais NE MET JAMAIS EN CACHE les échanges de compte (Supabase).
const SHELL = 'hifz-shell-v2', RUNTIME = 'hifz-runtime-v2';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './icon.svg', './moutoun.js', './mutashabihat.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
// seuls ces hôtes externes sont mis en cache (polices, texte du Coran, bibliothèque) ; tout le reste passe directement par le réseau
const CACHEABLE = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.alquran.cloud', 'cdn.jsdelivr.net'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin){ // application : réseau d'abord (mises à jour), cache en secours hors ligne
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(SHELL).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
  } else if (CACHEABLE.includes(u.hostname)){ // cache d'abord
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) caches.open(RUNTIME).then(c => c.put(e.request, r.clone())); return r; })));
  } // sinon : le navigateur gère (Supabase, audio…)
});
