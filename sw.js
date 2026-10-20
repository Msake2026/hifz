// Service worker Hifz : l'application fonctionne hors ligne, mais NE MET JAMAIS EN CACHE les échanges de compte (Supabase).
const SHELL = 'hifz-shell-v4', RUNTIME = 'hifz-runtime-v4';
const FILES = ['./', './index.html', './config.js', './i18n.js', './manifest.webmanifest', './icon.svg', './moutoun.js', './mutashabihat.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './fonts/fonts.css', './fonts/amiri-quran-arabic.woff2', './fonts/amiri-quran-latin.woff2', './fonts/cormorant-garamond-latin.woff2', './fonts/cormorant-garamond-latin-ext.woff2',
  './fonts/inter-latin.woff2', './fonts/inter-latin-ext.woff2', './fonts/noto-sans-arabic-arabic.woff2'];
// seuls ces hôtes externes sont mis en cache (texte du Coran, bibliothèque) ; tout le reste passe directement par le réseau. Les polices sont hébergées ici.
const CACHEABLE = ['api.alquran.cloud', 'cdn.jsdelivr.net'];
const keep = (cacheName, req, res) => { const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {}); }; // clone AVANT de rendre la réponse
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin){ // application : réseau d'abord (toujours revalidé, pas de cache HTTP de 10 min), cache en secours hors ligne
    e.respondWith(fetch(e.request.url, {cache: 'no-cache'}).then(r => { if (r.ok) keep(SHELL, e.request, r); return r; })
      .catch(() => caches.match(e.request, {ignoreSearch: true}).then(hit => hit || caches.match('./index.html'))));
  } else if (CACHEABLE.includes(u.hostname)){ // cache d'abord
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) keep(RUNTIME, e.request, r); return r; })));
  } // sinon : le navigateur gère (Supabase, audio…)
});
