// Génère les écrans de lancement iPhone (icons/splash/*.png) et les captures d'écran du manifeste (screenshots/*.png).
// Usage : python3 -m http.server 8766 (dans le dossier du projet), puis  node tools/build_store_assets.mjs   (demande Google Chrome)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const NAME = 'تثبيت', SUB = 'Coran et moutoun';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const font = url.pathToFileURL(path.join(root, 'fonts/amiri-quran-arabic.woff2')).href;
const ui = url.pathToFileURL(path.join(root, 'fonts/inter-latin.woff2')).href;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:8766/';
// [largeur appareil, hauteur appareil, densité] en points CSS : l'image mesure largeur×densité
const SPLASH = [[440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const prof = fs.mkdtempSync('/tmp/sa-');
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--allow-file-access-from-files', '--remote-debugging-port=9341', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:9341/json')).json(); if (list.length) break; } catch {} await sleep(500); }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
fs.mkdirSync(path.join(root, 'icons/splash'), { recursive: true }); fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
// --- écrans de lancement : fond vert du logo, nom en calligraphie, sous-titre
for (const [w, h, d] of SPLASH) {
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:AQ;src:url(${font})}@font-face{font-family:IN;src:url(${ui})}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}body{background:radial-gradient(circle at 35% 25%,#1b7a5c 0,#0b4a38 85%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${w * 0.03}px;color:#f1e2b4}
#n{font-family:AQ,serif;font-size:${w * 0.34}px;line-height:1.75;margin-top:-${w * 0.06}px}#s{font-family:IN,sans-serif;font-size:${w * 0.045}px;letter-spacing:.06em;color:#d9bd6a}#l{width:${w * 0.28}px;height:${w * 0.006}px;background:#d9bd6a;opacity:.7}</style>
<div id="n">${NAME}</div><div id="l"></div><div id="s">${SUB}</div>`;
  const tmp = path.join(prof, 's.html'); fs.writeFileSync(tmp, html);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: false });
  await send('Page.navigate', { url: url.pathToFileURL(tmp).href }); await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });   // JPEG : un dégradé en PNG pèse ~400 Ko
  const f = `icons/splash/splash-${w * d}x${h * d}.jpg`; fs.writeFileSync(path.join(root, f), Buffer.from(shot.result.data, 'base64')); console.log(f);
}
// --- captures d'écran de l'application (comptes désactivés pour la capture : la vraie interface, sans connexion)
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + 'index.html' }); await sleep(4000);
await ev("localStorage.clear(); CLOUD.url = ''; CLOUD.anonKey = ''; me = null; sb = null; cfg.scope = {type: 'surah', from: 78, to: 114}; cfg.mode = 'mix'; cfg.input = 'recite'; 1");
const shots = [['accueil', "go('home')"], ['reviser', "go('train')"], ['question', "cfg.mode = 'mcq'; start()"]];
for (const [name, code] of shots) {
  await ev(code); await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(root, `screenshots/${name}.png`), Buffer.from(shot.result.data, 'base64')); console.log('screenshots/' + name + '.png');
}
chrome.kill(); process.exit(0);
