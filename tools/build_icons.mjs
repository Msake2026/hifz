// Génère icons/*.png : nom de l'application en calligraphie Amiri Quran sur le fond vert, cadre doré, mot centré selon l'encre.
// Usage : node tools/build_icons.mjs   (demande Google Chrome ; le texte est dans NAME ci-dessous)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { ART_JS } from './_art.mjs';
const NAME = 'تثبيت';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const font = url.pathToFileURL(path.join(root, 'fonts/amiri-quran-arabic.woff2')).href;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// kind : standard (cadre à 10 %) ou maskable (cadre dans la zone sûre, 19,5 %)
const html = (S, kind) => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:AQ;src:url(${font})}html,body{margin:0}canvas{display:block}</style><canvas id="c" width="${S}" height="${S}"></canvas>
<script>${ART_JS}
document.fonts.load('100px AQ').then(() => { const S = ${S}, ctx = document.getElementById('c').getContext('2d'); fond(ctx, S, S);
  const inset = S * ${kind === 'maskable' ? 0.195 : 0.1}, w = S - 2 * inset;
  ctx.strokeStyle = '#d9bd6a'; ctx.lineWidth = S * 0.012; ctx.strokeRect(inset, inset, w, w);
  ctx.strokeStyle = 'rgba(217,189,106,.55)'; ctx.lineWidth = S * 0.006; ctx.strokeRect(inset + S * 0.03, inset + S * 0.03, w - S * 0.06, w - S * 0.06);
  const r = nom(ctx, ${JSON.stringify(NAME)}, S / 2, S / 2, w * 0.62, 'AQ', '#f1e2b4'); document.title = 'ready:' + JSON.stringify(r); });</script>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const prof = fs.mkdtempSync('/tmp/ic-');
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--allow-file-access-from-files', '--remote-debugging-port=9340', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:9340/json')).json(); if (list.length) break; } catch {} await sleep(500); }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
for (const [file, S, kind] of [['icon-512.png', 512, 'standard'], ['icon-192.png', 192, 'standard'], ['apple-touch-icon.png', 180, 'standard'], ['icon-maskable-512.png', 512, 'maskable']]) {
  const tmp = path.join(prof, 'i.html'); fs.writeFileSync(tmp, html(S, kind));
  await send('Emulation.setDeviceMetricsOverride', { width: S, height: S, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: url.pathToFileURL(tmp).href });
  let ink = ''; for (let i = 0; i < 40; i++) { await sleep(200); const r = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }); ink = String(r.result?.result?.value); if (ink.startsWith('ready')) break; }
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: S, height: S, scale: 1 } });
  fs.writeFileSync(path.join(root, 'icons', file), Buffer.from(shot.result.data, 'base64')); console.log(file, S, ink);
}
chrome.kill(); process.exit(0);
