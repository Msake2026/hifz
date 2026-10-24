// Service worker Tathbīt : l'application fonctionne hors ligne, mais NE MET JAMAIS EN CACHE les échanges de compte (Supabase).
const SHELL = 'tathbit-shell-v26', RUNTIME = 'tathbit-runtime-v26', AUDIO = 'tathbit-audio-v1';   // AUDIO : sourates téléchargées par l'utilisateur (jamais effacé automatiquement)
const FILES = ['./', './index.html', './config.js', './i18n.js', './manifest.webmanifest', './icon.svg', './quran.js', './huruf.js', './moutoun.js', './mutashabihat.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './fonts/fonts.css', './fonts/amiri-quran-arabic.woff2', './fonts/amiri-quran-latin.woff2', './fonts/cormorant-garamond-latin.woff2', './fonts/cormorant-garamond-latin-ext.woff2',
  './fonts/inter-latin.woff2', './fonts/inter-latin-ext.woff2', './fonts/noto-sans-arabic-arabic.woff2'];
// seuls ces hôtes externes sont mis en cache (texte du Coran, bibliothèque) ; tout le reste passe directement par le réseau. Les polices sont hébergées ici.
const CACHEABLE = ['api.alquran.cloud', 'cdn.jsdelivr.net'];
const keep = (cacheName, req, res) => { const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {}); }; // clone AVANT de rendre la réponse
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME, AUDIO].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin){ // application : réseau d'abord (toujours revalidé, pas de cache HTTP de 10 min), cache en secours hors ligne
    e.respondWith(fetch(e.request.url, {cache: 'no-cache'}).then(r => { if (r.ok) keep(SHELL, e.request, r); return r; })
      .catch(() => caches.match(e.request, {ignoreSearch: true}).then(hit => hit || caches.match('./index.html'))));
  } else if (CACHEABLE.includes(u.hostname)){ // cache d'abord
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) keep(RUNTIME, e.request, r); return r; })));
  } else if (u.hostname === 'everyayah.com'){ // audio téléchargé pour l'écoute hors ligne (le lecteur demande des plages d'octets)
    e.respondWith(audioResponse(e.request));
  } // sinon : le navigateur gère (Supabase, audio en ligne…)
});
// « bytes=a-b », « bytes=a- » ou « bytes=-n » -> [début, fin] dans un fichier de `size` octets (null si invalide)
function rangeOf(header, size){
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || ''); if (!m || (m[1] === '' && m[2] === '')) return null;
  let a, b; if (m[1] === ''){ a = Math.max(0, size - +m[2]); b = size - 1; } else { a = +m[1]; b = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
  return a > b || a >= size ? null : [a, b];
}
async function audioResponse(req){
  const hit = await (await caches.open(AUDIO)).match(req.url);
  if (!hit) return fetch(req);                                    // pas téléchargé : réseau
  const buf = await hit.arrayBuffer(), h = req.headers.get('range');
  if (!h) return new Response(buf, {status: 200, headers: {'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength), 'Accept-Ranges': 'bytes', 'X-Tathbit-Offline': '1'}});
  const r = rangeOf(h, buf.byteLength);
  if (!r) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${buf.byteLength}`}});
  return new Response(buf.slice(r[0], r[1] + 1), {status: 206, headers: {'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'X-Tathbit-Offline': '1', 'Content-Length': String(r[1] - r[0] + 1), 'Content-Range': `bytes ${r[0]}-${r[1]}/${buf.byteLength}`}});
}

// notifications Web Push (rappels de révision) : chaque message reçu DOIT afficher une notification (exigence d'iOS)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tathbīt', {
    body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: d.tag || undefined, data: {url: d.url || './'}}));   // une étiquette PAR notification (rappel 1, rappel 2, message…) : avec une étiquette commune, la seconde remplaçait la première sans alerte
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow(url);
  }));
});
