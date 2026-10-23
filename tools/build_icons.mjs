// Génère icons/*.png (et ajuste icon.svg) : nom de l'application en calligraphie Amiri Quran sur le fond vert, cadre doré.
// Usage : node tools/build_icons.mjs   (demande Google Chrome ; le texte est dans NAME ci-dessous)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const NAME = 'تثبيت';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const font = url.pathToFileURL(path.join(root, 'fonts/amiri-quran-arabic.woff2')).href;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// kind : standard (cadre à 10 %) ou maskable (cadre dans la zone sûre, 20 %)
const html = (S, kind) => {
  const inset = kind === 'maskable' ? 0.195 : 0.1, frame = S * inset, w = S - 2 * frame;
  return `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:AQ;src:url(${font})}
html,body{margin:0;width:${S}px;height:${S}px;overflow:hidden}
#b{position:relative;width:${S}px;height:${S}px;background:radial-gradient(circle at 35% 25%,#1b7a5c 0,#0b4a38 80%)}
.f{position:absolute;box-sizing:border-box;border:solid #d9bd6a}
#t{position:absolute;left:0;right:0;top:50%;transform:translateY(-54%);text-align:center;color:#f1e2b4;font-family:AQ,serif;line-height:1;white-space:nowrap;direction:rtl}</style>
<div id="b"><div class="f" style="inset:${frame}px;border-width:${S * 0.012}px"></div><div class="f" style="inset:${frame + S * 0.03}px;border-width:${S * 0.006}px;border-color:rgba(217,189,106,.55)"></div><div id="t">${NAME}</div></div>
<script>document.fonts.load('100px AQ').then(() => { const t = document.getElementById('t'); t.style.fontSize = '100px'; const r = document.createRange(); r.selectNodeContents(t); const w100 = r.getBoundingClientRect().width; t.style.fontSize = (100 * ${w} * 0.66 / w100) + 'px'; document.title = 'ready:' + w100; });</script>`;
};
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
  for (let i = 0; i < 40; i++) { await sleep(200); const r = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }); if (String(r.result?.result?.value).startsWith('ready')) break; }
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: S, height: S, scale: 1 } });
  fs.writeFileSync(path.join(root, 'icons', file), Buffer.from(shot.result.data, 'base64')); console.log(file, S);
}
chrome.kill(); process.exit(0);
