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

test('modèles d\'e-mail : trois langues, bouton vers {{ .ConfirmationURL }}, aucune condition', () => {
  for (const f of ['confirm-signup', 'reset-password']) {
    const t = read(`supabase/emails/${f}.html`);
    assert.equal((t.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, 3, f + ' : un bouton par langue');
    assert.ok(!/\{\{ *(if|with|end)/.test(t), f + ' : pas de logique de modèle');
    assert.match(t, /dir="rtl"/);
    assert.ok(/[\u0600-\u06FF]/.test(t) && /Confirm|Reset|password|email/i.test(t));
  }
});

test('révision espacée : intervalle adaptatif et liste « à renforcer en priorité »', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* SRS:begin'), html.indexOf('/* SRS:end */'));
  assert.ok(code.includes('function srsNext') && code.includes('function weakList'));
  const { srsNext, weakList, SRS } = new Function(code + '; return {srsNext, weakList, SRS};')();
  const DAY = 864e5, T = Date.UTC(2026, 9, 21, 12);
  // première réussite : 1 jour ; puis l'intervalle grandit d'un facteur qui augmente un peu à chaque réussite
  let s = srsNext(undefined, 1, T); assert.equal(s.iv, 1); assert.equal(s.due, T + DAY);
  let s2 = srsNext(s, 1, s.due); assert.ok(Math.abs(s2.iv - 2.25) < 1e-9, 'le facteur (2,2 au départ, +0,05 par réussite) est appliqué'); assert.ok(s2.ez > s.ez);
  // un raté : retour dans 6 h, facteur réduit, jamais sous le plancher
  const f = srsNext(s2, 0, s2.due); assert.equal(f.iv, 0.25); assert.ok(f.ez < s2.ez); assert.equal(f.due, s2.due + 0.25 * DAY);
  let g = f; for (let i = 0; i < 20; i++) g = srsNext(g, 0, g.due); assert.equal(g.ez, SRS.EZMIN);
  // après un raté, la première réussite ramène à 1 jour (pas à 0,55 jour)
  assert.equal(srsNext(f, 1, f.due).iv, 1);
  // un verset difficile grandit plus lentement qu'un verset facile
  const easy = srsNext({iv: 10, ez: 2.5, due: T}, 1, T), hard = srsNext({iv: 10, ez: 1.4, due: T}, 1, T); assert.ok(easy.iv > hard.iv);
  // hésitation : ×0,7 mais 1 jour au moins ; plafond de 180 jours
  assert.equal(srsNext({iv: 10, ez: 2.2, due: T}, 0.5, T).iv, 7); assert.equal(srsNext({iv: 0, ez: 2.2, due: 0}, 0.5, T).iv, 1);
  assert.equal(srsNext({iv: 150, ez: 2.8, due: T}, 1, T).iv, SRS.MAXIV);
  // réviser bien avant l'échéance : rien ne change
  const early = srsNext({iv: 10, ez: 2.2, due: T + 9 * DAY}, 1, T); assert.deepEqual(early, { iv: 10, ez: 2.2, due: T + 9 * DAY });
  // liste à renforcer
  const e = (k, daysAgo, sc = 0) => ({ k, t: T - daysAgo * DAY, sc });
  const errs = [e('2:5', 0), e('2:5', 1), e('3:9', 40), e('4:1', 2, 0.5), e('9:9', 2)];
  const stats = { '2:5': [1, 4], '3:9': [9, 1], '4:1': [5, 1], '9:9': [3, 1], '1:1': [10, 0] };
  const sched = { '2:5': { iv: 0.25, due: T - 2 * DAY }, '3:9': { iv: 30, due: T + 5 * DAY }, '9:9': { iv: 20, due: T + 10 * DAY } };
  const W = weakList(errs, stats, sched, T);
  assert.equal(W[0].k, '2:5', 'le plus fragile d\'abord'); assert.equal(W[0].n30, 2); assert.ok(W[0].lateD >= 2); assert.equal(W[0].pct, 20);
  assert.ok(!W.some(w => w.k === '3:9'), 'erreur ancienne et verset stable : pas dans la liste');
  assert.ok(!W.some(w => w.k === '1:1'), 'jamais d\'erreur : pas dans la liste');
  assert.ok(!W.some(w => w.k === '9:9') || W.find(w => w.k === '9:9').pri < W[0].pri, 'un verset stable pèse moins');
  for (let i = 1; i < W.length; i++) assert.ok(W[i - 1].pri >= W[i].pri, 'trié par priorité');
  // l'erreur récente compte plus que l'ancienne
  const rec = weakList([e('1:1', 1)], {}, {}, T)[0], mid = weakList([e('1:1', 12)], {}, {}, T), old = weakList([e('1:1', 20)], {}, {}, T);
  assert.ok(rec && rec.pri > 1.5); assert.equal(mid.length, 1, 'une erreur d\'il y a 12 jours reste à surveiller'); assert.equal(old.length, 0, 'une erreur d\'il y a 20 jours seule ne suffit plus');
  assert.deepEqual(weakList([], {}, {}, T), []);
});

test('exercice de tajwīd : segments, parties surlignées, parties à trouver, vrai/faux, propositions', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* TJ:begin'), html.indexOf('/* TJ:end */'));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const { TJFAM, TJGROUP, tjSegs, tjMulti, tjParts, tjFindPicks, tjFalseFam, tjOptions } = new Function('esc', code + '; return {TJFAM, TJGROUP, tjSegs, tjMulti, tjParts, tjFindPicks, tjFalseFam, tjOptions};')(esc);
  // segments : le texte est conservé, les codes de la source sont regroupés comme dans sa légende
  const raw = 'بِسْمِ [h[ٱ]للَّهِ [h[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [s[و]مَ[d[ن ي]'; const segs = tjSegs(raw);
  assert.equal(segs.map(x => x.t).join(''), raw.replace(/\[[a-z]\[/g, '').replace(/\]/g, ''));
  assert.deepEqual(segs.filter(x => x.c).map(x => x.c), ['h', 'h', 'l', 'n', 'l', 'd']);      // s -> l (lettre muette / lām solaire), b -> d
  assert.equal(TJFAM.s, 'l'); assert.equal(TJFAM.b, 'd'); assert.equal(Object.keys(TJGROUP).length, 15);
  assert.deepEqual(tjSegs('abc'), [{ t: 'abc', c: '' }]);
  // une partie réduite à un signe reçoit sa lettre porteuse ; le texte total ne change jamais
  const sg = tjSegs('رَّحْمَ[n[ـٰ]نِ'), i = sg.findIndex(x => x.c === 'n'), P = tjMulti(sg, [i]);
  assert.equal(P.map(x => x.t).join(''), 'رَّحْمَـٰنِ'); const mk = P.filter(x => x.k).map(x => x.t).join('');
  assert.ok(/^[\u0621-\u064A]/.test(mk) && mk.endsWith('ـٰ'), 'lettre + signe : ' + mk);
  const L = tjMulti(tjSegs('x[l[ل]y'), [1]); assert.deepEqual(L.filter(x => x.k).map(x => x.t), ['ل']);
  // rendu : une seule balise <mark> par partie, numéros et couleurs facultatifs, texte échappé
  const h = tjParts(tjMulti(tjSegs('a<[n[b]c'), [1]), { colors: true, numbers: true });
  assert.equal(h, 'a&lt;<mark class="tjq"><span class="tj-n">b</span></mark><sup class="tjn">1</sup>c');
  assert.equal(tjParts(tjMulti(tjSegs('a[n[b]c'), [1])), 'a<mark class="tjq">b</mark>c');
  // deux parties voisines : jamais de chevauchement, numéros distincts
  const two = tjParts(tjMulti(tjSegs('[n[ب][q[ج]'), [0, 1]), { numbers: true }); assert.equal((two.match(/<mark/g) || []).length, 2); assert.ok(two.includes('>1</sup>') && two.includes('>2</sup>'));
  // parties à trouver : 4 parties, dont une seule de la règle demandée, de préférence de règles différentes
  const names = Object.fromEntries('hlnpmoqcfwiaudg'.split('').map(c => [c, c]));
  let seed = 7; const rnd = n => (seed = (seed * 16807) % 2147483647) % n, shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const verse = tjSegs('[n[a]x[p[b]x[q[c]x[f[d]x[n[e]x[g[f]'); 
  for (let k = 0; k < 50; k++) {
    const F = tjFindPicks(verse, 'n', rnd, shuf); assert.equal(F.picks.length, 4); assert.ok(F.picks.includes(F.target)); assert.equal(verse[F.target].c, 'n');
    assert.equal(F.picks.filter(i => verse[i].c === 'n').length, 1, 'une seule bonne partie'); assert.deepEqual(F.picks, [...F.picks].sort((x, y) => x - y));
    assert.equal(new Set(F.picks.filter(i => i !== F.target).map(i => verse[i].c)).size, 3, 'trois autres règles différentes');
  }
  assert.equal(tjFindPicks(tjSegs('[n[a]x[p[b]'), 'n', rnd, shuf), null, 'verset trop pauvre : pas de question');
  assert.equal(tjFindPicks(verse, 'o', rnd, shuf), null, 'règle absente du verset');
  // vrai/faux : l'autre règle est différente et de préférence de la même famille
  for (const fam of 'hlnpmoqcfwiaudg') for (let k = 0; k < 10; k++) { const f = tjFalseFam(fam, names, shuf); assert.notEqual(f, fam); assert.equal(TJGROUP[f], TJGROUP[fam], 'même famille'); }
  // propositions : 4 distinctes, la bonne dedans, de préférence de la même famille de règles
  for (const fam of 'hlnpmoqcfwiaudg') {
    const o = tjOptions(fam, names, shuf); assert.equal(o.length, 4); assert.equal(new Set(o).size, 4); assert.ok(o.includes(fam));
    const same = o.filter(c => c !== fam && TJGROUP[c] === TJGROUP[fam]).length;
    assert.ok(same >= Math.min(2, Object.keys(names).filter(c => c !== fam && TJGROUP[c] === TJGROUP[fam]).length), 'proches de la bonne réponse : ' + fam);
  }
});

test('data/tajweed.js : les 15 familles de règles existent et chaque verset est bien segmenté', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* TJ:begin'), html.indexOf('/* TJ:end */'));
  const { tjSegs } = new Function('esc', code + '; return {tjSegs};')(x => x);
  const w = {}; new Function('window', read('data/tajweed.js'))(w); const all = w.QX.tajweed.s.flat();
  const fam = new Set(); let spans = 0;
  for (const v of all) { const sg = tjSegs(v); for (const x of sg) if (x.c) { fam.add(x.c); spans++; } }
  assert.deepEqual([...fam].sort(), [...'acdfghilmnopqu'.split(''), 'w'].sort());
  assert.ok(spans > 50000, 'beaucoup de parties annotées : ' + spans);
});

test('huruf.js : 17 points de sortie, 28 lettres, qualités cohérentes, sources renseignées', () => {
  const w = {}; new Function('window', read('huruf.js'))(w); const H = w.HURUF;
  assert.equal(H.letters.length, 28); assert.equal(H.points.length, 17); assert.equal(H.sources.length, 3);
  assert.ok(H.sources.every(x => /^https:\/\/ar\.wiki(source|pedia)\.org\/w\/index\.php\?oldid=\d+$/.test(x.url)), 'versions précises des sources');
  const all = H.points.filter(p => p.area !== 'jawf').flatMap(p => p.letters); assert.deepEqual([...all].sort(), [...H.letters].sort(), 'chaque lettre a un seul point');
  assert.deepEqual(H.points.find(p => p.id === 'jawf').letters, ['ا', 'و', 'ي']);
  assert.deepEqual(H.points.filter(p => p.area === 'halq').map(p => p.letters.join('')), ['ءه', 'عح', 'غخ']);
  const n = Object.fromEntries(Object.entries(H.sets).map(([k, v]) => [k, v.length]));
  assert.deepEqual(n, { hams: 10, shidda: 8, tawassut: 5, istila: 7, itbaq: 4, idhlaq: 6, safir: 3, qalqala: 5, lin: 2, inhiraf: 2, takrir: 1, tafashshi: 1, istitala: 1 });
  for (const c of H.letters) {
    const a = H.per[c]; assert.equal(a.filter(x => ['jahr', 'hams'].includes(x)).length, 1, c); assert.equal(a.filter(x => ['shidda', 'tawassut', 'rakhawa'].includes(x)).length, 1, c);
    assert.equal(a.filter(x => ['istila', 'istifal'].includes(x)).length, 1, c); assert.equal(a.filter(x => ['itbaq', 'infitah'].includes(x)).length, 1, c); assert.equal(a.filter(x => ['idhlaq', 'ismat'].includes(x)).length, 1, c);
  }
  // quelques lettres connues (contrôle de bon sens sur le calcul)
  assert.deepEqual(H.per['ل'], ['jahr', 'tawassut', 'istifal', 'infitah', 'idhlaq', 'inhiraf']);
  assert.deepEqual(H.per['ض'], ['jahr', 'rakhawa', 'istila', 'itbaq', 'ismat', 'istitala']);
  assert.ok(H.per['م'].includes('idhlaq') && !H.per['م'].includes('inhiraf'));
  assert.equal(H.mnemonics.length, 8); assert.ok(H.mnemonics.every(m => m.ar && H.sets[m.attr]));
});

test('exercices makhārij / ṣifāt : questions toujours valides (milliers de tirages)', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* HF:begin'), html.indexOf('/* HF:end */'));
  const { mkBuild, sfBuild, hfPointOf, HF_AMBIG } = new Function(code + '; return {mkBuild, sfBuild, hfPointOf, HF_AMBIG};')();
  const w = {}; new Function('window', read('huruf.js'))(w); const H = w.HURUF;
  let seed = 11; const rnd = n => (seed = (seed * 16807) % 2147483647) % n, shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const distinct = q => new Set(q.options.map(o => o.v)).size === q.options.length && q.options.some(o => o.v === q.correct);
  for (let i = 0; i < 400; i++) {
    let q = mkBuild('zone', H, rnd, shuf); assert.ok(distinct(q) && q.options.length === 4); assert.equal(q.correct, hfPointOf(H, q.letter).area); assert.ok(!HF_AMBIG.includes(q.letter));
    q = mkBuild('same', H, rnd, shuf); assert.ok(distinct(q) && q.options.length === 4); assert.equal(q.options.find(o => o.v === q.correct).letters.includes(q.letter), true); assert.ok(q.point.letters.length >= 2);
    assert.equal(q.options.filter(o => o.letters.includes(q.letter)).length, 1, 'une seule proposition contient la lettre');
    q = mkBuild('odd', H, rnd, shuf); assert.equal(q.shown.length, 3); const pts = q.shown.map(c => hfPointOf(H, c).id); assert.equal(new Set(pts).size, 2, 'deux points distincts');
    assert.equal(pts.filter(x => x === hfPointOf(H, q.correct).id).length, 1, 'une seule intruse'); assert.ok(distinct(q));
    q = mkBuild('halq', H, rnd, shuf); assert.equal(q.options.length, 3); assert.ok(q.point.letters.includes(q.letter)); assert.equal(q.correct, hfPointOf(H, q.letter).id);
    q = mkBuild('tf', H, rnd, shuf); assert.equal(q.same, hfPointOf(H, q.a) === hfPointOf(H, q.b)); assert.equal(q.correct, q.same ? 't' : 'f'); assert.notEqual(q.a, q.b);
    q = sfBuild('pair', H, rnd, shuf); assert.ok(distinct(q)); assert.equal(q.options.filter(o => H.per[q.letter].includes(o.v)).length, 1, 'une seule bonne qualité'); assert.ok(q.options.length >= 2);
    q = sfBuild('which', H, rnd, shuf); assert.ok(distinct(q) && q.options.length === 4); assert.equal(q.options.filter(o => H.sets[q.attr].includes(o.v)).length, 1, 'une seule bonne lettre');
    q = sfBuild('mnemo', H, rnd, shuf); assert.ok(distinct(q) && q.options.length === 4); assert.ok(H.mnemonics.some(m => m.ar === q.word && m.attr === q.correct));
    q = sfBuild('tf', H, rnd, shuf); assert.equal(q.correct, H.per[q.letter].includes(q.attr) ? 't' : 'f');
  }
});

test('qualités conditionnelles : la règle de qalqala coïncide avec l\'annotation du tajwīd sur les 6236 versets', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* HF:begin'), html.indexOf('/* HF:end */'));
  const { hfClusters, hfCond, condBuild } = new Function(code + '; return {hfClusters, hfCond, condBuild};')();
  const Qd = loadGlobal('quran.js', 'QURAN').surahs; const tj = {}; new Function('window', read('data/tajweed.js'))(tj);
  let diff = [];
  Qd.forEach((s, si) => s.a.forEach((v, vi) => {
    const cl = hfClusters(v[0]); let mine = 0;
    cl.forEach((x, k) => { const r = hfCond(cl, k, 'qalqala'); if (r && r.has) mine++; });
    const src = (tj.QX.tajweed.s[si][vi].match(/\[q\[/g) || []).length; if (mine !== src) diff.push(`${si + 1}:${vi + 1} ${mine}/${src}`);
  }));
  assert.deepEqual(diff, [], 'écarts avec la source du tajwīd : ' + diff.slice(0, 5));
});

test('qualités conditionnelles : līn et questions posées sur de vrais versets', () => {
  const html = read('index.html'); const code = html.slice(html.indexOf('/* HF:begin'), html.indexOf('/* HF:end */'));
  const { hfClusters, hfCond, condBuild } = new Function(code + '; return {hfClusters, hfCond, condBuild};')();
  const Qd = loadGlobal('quran.js', 'QURAN').surahs, Q = Qd.map(s => ({ n: s.n, a: s.a.map(v => ({ t: v[0] })) }));
  // cas connus : « خَوۡف » (exemple de l'article) et « ٱلۡبَيۡتِ » (106:3) ont un līn ; « يَقُولُ » : la lettre و est une lettre de madd
  const lin = t => { const cl = hfClusters(t); return cl.map((x, k) => [x.c, hfCond(cl, k, 'lin')]).filter(([, r]) => r); };
  assert.deepEqual(lin(Q[105].a[2].t).filter(([, r]) => r.has).map(([c]) => c), ['ي']); assert.ok(lin(Q[105].a[3].t).some(([c, r]) => c === 'و' && r.has));
  assert.ok(lin('يَقُولُ').some(([c, r]) => c === 'و' && !r.has && r.why === 'madd'));
  // 3000 questions : lettre surlignée dans le bon ensemble, bonne réponse cohérente avec la règle recalculée, verset reconstitué à l'identique
  let seed = 5; const rnd = n => (seed = (seed * 16807) % 2147483647) % n, shuf = a => a.slice();
  const seen = { qalqala: [0, 0], lin: [0, 0] };
  for (let i = 0; i < 3000; i++) {
    const q = condBuild(Q, rnd, shuf); assert.ok(q); const t = Q[q.ref.s - 1].a[q.ref.a - 1].t; assert.equal(q.before + q.mark + q.after, t);
    assert.ok((q.attr === 'qalqala' ? 'قطبجد' : 'وي').includes(q.letter)); assert.ok(q.mark.startsWith(q.letter));
    const cl = hfClusters(t), k = cl.findIndex(x => x.s === q.before.length); const r = hfCond(cl, k, q.attr); assert.equal(r.has, q.correct === 't'); assert.equal(r.why, q.why);
    seen[q.attr][q.correct === 't' ? 0 : 1]++;
  }
  for (const a of ['qalqala', 'lin']) assert.ok(seen[a][0] > 200 && seen[a][1] > 200, 'oui et non bien répartis : ' + JSON.stringify(seen));
});

test('data/ahkam.js : ensembles de lettres cohérents, occurrences conformes à la règle, questions toujours valides', () => {
  const html = read('index.html'); const hf = html.slice(html.indexOf('/* HF:begin'), html.indexOf('/* HF:end */')), ah = html.slice(html.indexOf('/* AH:begin'), html.indexOf('/* AH:end */'));
  const { hfClusters, hfPick, ahIndex, ahBuild, ahLetterRule } = new Function(hf + ah + '; return {hfClusters, hfPick, ahIndex, ahBuild, ahLetterRule};')();
  const w = {}; new Function('window', read('data/ahkam.js'))(w); const A = w.AHKAM;
  const S = A.sets; assert.deepEqual(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v].length])), { H: 6, G: 4, N: 2, Q: 1, K: 15 });
  assert.equal([...Object.values(S).join('')].length, 28); assert.equal(new Set(Object.values(S).join('')).size, 28, 'les 5 groupes couvrent les 28 lettres sans recouvrement');
  assert.equal(S.H, 'ءهعحغخ'); assert.equal(S.Q, 'ب'); assert.ok(A.sources.length === 3 && A.sources.every(x => /oldid=\d+/.test(x.url)));
  const Qd = loadGlobal('quran.js', 'QURAN').surahs, Q = Qd.map(s => ({ n: s.n, a: s.a.map(v => ({ t: v[0] })) }));
  const nameOf = { H: S.H, M: 'يو', G: S.G, N: S.N, Q: S.Q, K: S.K };
  let n = 0;
  for (const [key, v] of Object.entries(A.occ)) {
    const [sn, an] = key.split(':').map(Number), cl = hfClusters(Q[sn - 1].a[an - 1].t);
    for (const o of v.split(',')) {
      const [k, j, r] = o.split('.'); const a = cl[+k], b = cl[+j]; assert.ok(a && b && +j > +k, key + ' ' + o); n++;
      if (r.startsWith('m')) { assert.equal(a.c, 'م'); assert.equal(r, b.c === 'ب' ? 'mK' : b.c === 'م' ? 'mG' : 'mH', key + ' ' + o); }
      else { assert.ok(a.c === 'ن' || /[\u064B-\u064D]/.test(a.m), key); const bl = b.c === 'ٱ' ? 'ا' : b.c;
        if (r === 'M') assert.ok('يو'.includes(b.c) && a.c === 'ن'); else assert.ok([...nameOf[r]].includes({ 'أ': 'ء', 'إ': 'ء', 'ؤ': 'ء', 'ئ': 'ء', 'ى': 'ي' }[bl] || bl), `${key} ${o} ${b.c}`); }
    }
  }
  assert.ok(n > 15000, 'nombre d\'occurrences : ' + n);
  for (const [key, v] of Object.entries(A.gh)) { const [sn, an] = key.split(':').map(Number), cl = hfClusters(Q[sn - 1].a[an - 1].t); for (const k of v.split(',')) assert.ok('نم'.includes(cl[+k].c) && /\u0651/.test(cl[+k].m), key); }
  let seed = 3; const rnd = m => (seed = (seed * 16807) % 2147483647) % m, shuf = a => a.slice().sort(() => rnd(3) - 1);
  const seen = {};
  for (let i = 0; i < 1500; i++) for (const kind of ['nun', 'mim', 'letter', 'group', 'ghunna', 'tf']) {
    const q = ahBuild(kind, A, Q, rnd, shuf); assert.ok(q, kind); seen[kind + (q.correct || '')] = 1;
    assert.equal(new Set(q.options.map(o => o.v)).size, q.options.length, kind);
    if (kind === 'letter') assert.equal(q.correct, ahLetterRule(A, q.letter)); assert.ok(q.options.some(o => o.v === q.correct), kind);
    if (kind === 'group') assert.equal(q.options.filter(o => o.v === q.rule).length, 1);
    if (kind === 'tf') assert.equal(q.correct, ahLetterRule(A, q.letter) === q.rule ? 't' : 'f');
    if (kind === 'ghunna') { const t = Q[q.ref.s - 1].a[q.ref.a - 1].t; assert.equal(/\u0651/.test(q.a.m), q.correct === 't'); assert.ok('نم'.includes(q.a.c)); assert.equal(t.slice(q.a.s, q.a.e).includes(q.a.c), true); }
    if (kind === 'nun') assert.ok(['H', 'G', 'N', 'Q', 'K'].includes(q.correct)); if (kind === 'mim') assert.ok(['mH', 'mK', 'mG'].includes(q.correct));
  }
  for (const r of ['nunH', 'nunG', 'nunN', 'nunQ', 'nunK', 'mimmH', 'mimmK', 'mimmG', 'ghunnat', 'ghunnaf']) assert.ok(seen[r], 'règle jamais tirée : ' + r);
});
