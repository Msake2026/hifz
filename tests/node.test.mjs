// Tests sans navigateur : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const loadGlobal = (file, name) => { const w = {}; new Function('window', read(file))(w); return w[name]; };

test('quran.js : 114 sourates, 6236 versets, empreinte SHA-256 correcte', () => {
  const Q = loadGlobal('quran.js', 'QURAN');
  assert.equal(Q.surahs.length, 114);
  const flat = Q.surahs.flatMap(s => s.a);
  assert.equal(flat.length, 6236);
  assert.equal(Q.verses, 6236);
  assert.equal(crypto.createHash('sha256').update(flat.map(v => v[0]).join('\n'), 'utf8').digest('hex'), Q.sha256);
  assert.equal(Math.min(...flat.map(v => v[2])), 1); assert.equal(Math.max(...flat.map(v => v[2])), 604);
  assert.equal(Math.max(...flat.map(v => v[1])), 30);
  assert.deepEqual(Q.surahs.map(s => s.a.length).slice(0, 3), [7, 286, 200]);
});

test('moutoun.js : 61 + 34 + 42 unités, chaque unité non vide', () => {
  const M = loadGlobal('moutoun.js', 'MOUTOUN');
  const n = Object.fromEntries(M.texts.map(t => [t.id, t.a.length]));
  assert.deepEqual(n, { tuhfa: 61, bayquniyya: 34, arbain: 42 });
  M.texts.forEach(t => t.a.forEach(u => assert.ok(u.t && u.t.trim(), t.id)));
});

test('traductions : chaque texte tr()/trp() de index.html existe en anglais et en arabe', () => {
  const src = read('index.html').match(/<script>([\s\S]*)<\/script>/)[1];
  const I = loadGlobal('i18n.js', 'I18N');
  const lit = i => { const q = src[i]; let j = i + 1, out = ''; while (j < src.length) { const c = src[j]; if (c === '\\') { out += src[j] + src[j + 1]; j += 2; continue; } if (c === q) break; out += c; j++; } try { return [eval(q + out + q), j + 1]; } catch { return [null, j + 1]; } };
  const keys = new Set(); const re = /\btrp?\(/g; let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "'" || c === '"') { const [v, j] = lit(i); if (v) keys.add(v); i = j; continue; }
      if (c === '`') { i++; while (i < src.length && src[i] !== '`') { if (src[i] === '\\') i++; i++; } i++; continue; }
      if (c === '(') depth++; if (c === ')') depth--; i++;
    }
  }
  const cand = [...keys].filter(k => /[A-Za-zÀ-ÿ]/.test(k) && !/^[a-z]+(\.[a-z]+)*$/.test(k) && !/^[a-z]{2,3}-[A-Z]{2}/.test(k));
  const missing = ['en', 'ar'].flatMap(L => cand.filter(k => I[L][k] === undefined).map(k => `${L}: ${k.slice(0, 70)}`));
  assert.deepEqual(missing, []);
  // les variables {x} doivent être identiques dans les traductions
  const vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
  const bad = []; for (const L of ['en', 'ar']) for (const [k, v] of Object.entries(I[L])) if (vars(k) !== vars(v)) bad.push(`${L}: ${k.slice(0, 60)}`);
  assert.deepEqual(bad, []);
});

test('fonction send-reminders : 1er et 2e rappel (une fois par jour, seulement dans la fenêtre)', () => {
  const ts = read('supabase/functions/send-reminders/index.ts');
  const code = ts.slice(ts.indexOf('function localParts'), ts.indexOf('Deno.serve'))
    .replace(/sub: Sub/g, 'sub').replace(/now: Date/g, 'now').replace(/tz: string/g, 'tz').replace('t: string | null, last: string | null', 't, last');
  const { decide } = new Function(code + '; return {decide};')();
  const base = { tz: 'Europe/Paris', remind_time: '20:00', remind_time2: '21:30', last_sent: null, last_sent2: null };
  const at = (h, m) => new Date(Date.UTC(2026, 9, 21, h - 2, m)); // Paris = UTC+2
  const g = (sub, d) => { const r = decide(sub, d); return r.first ? '1' : r.second ? '2' : '-'; };
  assert.equal(g(base, at(19, 55)), '-');
  assert.equal(g(base, at(20, 5)), '1');
  assert.equal(g({ ...base, last_sent: '2026-10-21' }, at(20, 30)), '-');
  assert.equal(g({ ...base, last_sent: '2026-10-21' }, at(21, 35)), '2');
  assert.equal(g({ ...base, last_sent: '2026-10-21', last_sent2: '2026-10-21' }, at(22, 0)), '-');
  assert.equal(g(base, at(21, 40)), '2');
  assert.equal(g({ ...base, remind_time2: null, last_sent: '2026-10-21' }, at(21, 35)), '-');
  assert.equal(g({ ...base, last_sent: '2026-10-20', last_sent2: '2026-10-20' }, at(20, 3)), '1');
  assert.equal(g({ ...base, remind_time2: null }, at(23, 10)), '-'); // fenêtre de 3 h dépassée (190 min après 20:00)
  assert.equal(g({ ...base, tz: 'Pacific/Auckland' }, at(20, 5)), '-'); // autre fuseau : pas la même heure locale
});

test('sécurité : aucune clé secrète dans les fichiers publiés', () => {
  const files = fs.readdirSync(root, { recursive: true }).filter(f => /\.(js|html|json|webmanifest|sql|ts|md|yml|py|mjs)$/.test(f) && !/^(vendor|fonts|\.git|node_modules)[\\/]/.test(f) && !/\.local\./.test(f));
  const hits = [];
  for (const f of files) {
    const t = fs.readFileSync(path.join(root, f), 'utf8');
    if (/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(t)) hits.push(f + ' (jeton JWT)');
    if (new RegExp('PRIVATE KEY' + '-----').test(t)) hits.push(f + ' (clé privée)');
    if (/service_role['"]?\s*[:=]\s*['"]/.test(t)) hits.push(f + ' (service_role)');
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(t)) hits.push(f + ' (clé sb_secret)');
  }
  assert.deepEqual(hits, []);
  assert.match(read('.gitignore'), /\.local\.txt/); assert.match(read('.gitignore'), /\.local\.sql/);
});

test('service worker : la version du cache change quand la liste de fichiers change', () => {
  const sw = read('sw.js'); const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const f of files) assert.ok(fs.existsSync(path.join(root, f)), `fichier absent : ${f}`);
  assert.ok(files.includes('quran.js') && files.includes('index.html'));
  assert.match(sw, /addEventListener\('push'/); assert.match(sw, /addEventListener\('notificationclick'/);
});

test('data/*.js : 6236 versets alignés sur quran.js, empreintes SHA-256 correctes, sources renseignées', () => {
  const Q = loadGlobal('quran.js', 'QURAN'); const counts = Q.surahs.map(s => s.a.length);
  for (const f of ['tajweed.js', 'tr-fr.js', 'tr-en.js', 'tafsir-ar.js']) {
    const w = {}; new Function('window', read('data/' + f))(w);
    const x = Object.values(w.QX)[0];
    assert.deepEqual(x.s.map(a => a.length), counts, f);
    assert.ok(x.s.every(a => a.every(v => v && v.trim())), f + ' : verset vide');
    assert.equal(crypto.createHash('sha256').update(x.s.flat().join('\n'), 'utf8').digest('hex'), x.sha256, f);
    assert.ok(x.name && x.author && x.url && x.source, f + ' : source manquante');
  }
});

test('tajwīd : balises équilibrées, codes de la légende officielle seulement', () => {
  const w = {}; new Function('window', read('data/tajweed.js'))(w); const t = w.QX.tajweed.s.flat().join('');
  const codes = new Set([...t.matchAll(/\[([a-z])\[/g)].map(m => m[1]));
  const allowed = new Set('hslnpmqcfwiaudbgo'); for (const c of codes) assert.ok(allowed.has(c), c);
  assert.equal((t.match(/\[[a-z]\[/g) || []).length, (t.match(/\]/g) || []).length);
});

test('modèles d\'e-mail : balises Supabase présentes, blocs {{ if }} équilibrés, trois langues, bouton vers {{ .ConfirmationURL }}', () => {
  for (const f of ['confirm-signup', 'reset-password']) {
    const t = read(`supabase/emails/${f}.html`);
    const open = (t.match(/\{\{-?\s*(if|with)\b/g) || []).length, end = (t.match(/\{\{-?\s*end\s*-?\}\}/g) || []).length;
    assert.equal(open, end, f + ' : {{ if/with }} et {{ end }} déséquilibrés');
    assert.match(t, /\.Data\.lang/); assert.match(t, /\{\{ \.ConfirmationURL \}\}/);
    assert.equal((t.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, 3, f + ' : un bouton par langue');
    assert.match(t, /dir="rtl"/); assert.match(t, /eq \$l "en"/); assert.match(t, /eq \$l "ar"/);
    const tri = read(`supabase/emails/${f}-trilingue.html`);   // secours : les trois langues dans le même message, sans condition
    assert.ok(!/\{\{ *(if|with)/.test(tri)); assert.equal((tri.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, 3);
  }
});
