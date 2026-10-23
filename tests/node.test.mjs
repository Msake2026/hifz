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

test('moutoun.js : 61 + 34 + 315 + 42 unités, chaque unité non vide, texte arabe seul (ni chiffre ni signe parasite)', () => {
  const M = loadGlobal('moutoun.js', 'MOUTOUN');
  const n = Object.fromEntries(M.texts.map(t => [t.id, t.a.length]));
  assert.deepEqual(n, { tuhfa: 61, bayquniyya: 34, ibnachir: 315, arbain: 42 });
  M.texts.forEach(t => t.a.forEach(u => assert.ok(u.t && u.t.trim(), t.id)));
  const ib = M.texts.find(t => t.id === 'ibnachir');
  ib.a.forEach((u, i) => {
    assert.ok(/^[\u0621-\u063A\u0641-\u065F\u0670 ]+$/.test(u.t), 'ibnachir vers ' + (i + 1) + ' : caractère parasite');
    assert.ok(u.m >= 2 && u.m < u.t.split(' ').length, 'ibnachir vers ' + (i + 1) + ' : coupure');
  });
  assert.ok(ib.source.url && ib.source.note, 'source et mise en garde affichées');
  assert.ok(ib.a[214].t.split(' ')[1].startsWith('\u062d\u0650'), 'vers 215 : ḥijja (kasra sur le ḥāʾ), correction de relecture');
  const I = loadGlobal('i18n.js', 'I18N');
  M.texts.filter(t => t.sec).forEach(t => {
    assert.equal(t.sec[0].from, 1, t.id + ' : le 1er bloc commence au vers 1');
    t.sec.forEach((b, k) => {
      assert.ok(b.ar && b.fr && b.from <= t.a.length && (!k || b.from > t.sec[k - 1].from), t.id + ' bloc ' + k);
      assert.ok(I.en[b.fr] && I.ar[b.fr], t.id + ' : titre « ' + b.fr + ' » traduit en anglais et en arabe');
    });
  });
  assert.deepEqual(M.texts.filter(t => t.sec).map(t => [t.id, t.sec.length]), [['tuhfa', 10], ['ibnachir', 27]]);
  M.texts.forEach(t => assert.ok(I.en[t.topic] && I.ar[t.topic], 'thème « ' + t.topic + ' » traduit'));
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
  const code = ts.slice(ts.indexOf('function localParts'), ts.indexOf('const REQ'))
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

test('madd : type déduit du texte coïncide avec la marque de la source (n, p, m, o) et questions valides', () => {
  const html = read('index.html'); const code = ['/* TJ:begin', '/* HF:begin', '/* MD:begin'].map(m => html.slice(html.indexOf(m), html.indexOf(m.replace(':begin', ':end') + ' */'))).join('\n');
  const esc = t => String(t);
  const { tjSegs, tjMulti, tjParts, mdKind, mdBuild, MD_CODE } = new Function('esc', code + '; return {tjSegs, tjMulti, tjParts, mdKind, mdBuild, MD_CODE};')(esc);
  const w = {}; new Function('window', read('data/tajweed.js'))(w); const T = w.QX.tajweed.s;
  let spans = 0, ok = 0; const types = {};
  T.forEach(sur => sur.forEach(raw => { const segs = tjSegs(raw); segs.forEach((x, i) => { if (x.c && 'npmo'.includes(x.c)) { spans++; const r = mdKind(x.c, segs.slice(i + 1).map(y => y.t).join('')); if (r) { ok++; types[r.type] = (types[r.type] || 0) + 1; } } }); }));
  assert.ok(ok / spans > 0.99, 'part des parties dont le type concorde avec la source : ' + ok / spans);
  for (const t of ['tabii', 'muttasil', 'munfasil', 'lazim', 'arid']) assert.ok(types[t] > 50, 'type présent : ' + t + ' ' + types[t]);
  // la durée / le code de chaque type correspond à la légende : n=2, o=4-5, m=6, p=2-4-6
  assert.deepEqual(MD_CODE, { tabii: 'n', muttasil: 'o', munfasil: 'o', lazim: 'm', arid: 'p' });
  // cas connus : 2:5 « ٱلْمُفْلِحُونَ » etc. : madd muttaṣil dans « جَآءَ », munfaṣil dans « قَالُوٓا۟ إِنَّمَا », lāzim dans « ٱلضَّآلِّينَ », ʿāriḍ en fin de verset
  const kinds = (c, after) => (mdKind(c, after) || {}).type;
  assert.equal(kinds('o', 'ءَ ٱلْحَقُّ'), 'muttasil'); assert.equal(kinds('o', 'ا۟ إِنَّمَا'), 'munfasil'); assert.equal(kinds('m', 'لِّينَ'), 'lazim'); assert.equal(kinds('p', 'نِ'), 'arid'); assert.equal(kinds('n', 'لِمِينَ وَ'), 'tabii');
  assert.equal(mdKind('o', 'لِمِينَ وَ'), null, 'incohérent avec la source : jamais posé'); assert.equal(mdKind('m', ''), null, 'mukaṭṭaʿāt : non tranché');
  let seed = 9; const rnd = n => (seed = (seed * 16807) % 2147483647) % n, shuf = a => a.slice().sort(() => rnd(3) - 1), seen = {};
  for (let i = 0; i < 600; i++) {
    const q = mdBuild('type', T, rnd, shuf); assert.ok(q); seen[q.type] = 1;
    const x = q.segs[q.pick]; assert.equal(MD_CODE[q.type], x.c); const r = mdKind(x.c, q.segs.slice(q.pick + 1).map(y => y.t).join('')); assert.equal(r.type, q.type);
    const pieces = tjMulti(q.segs, [q.pick]); assert.equal(pieces.map(p => p.t).join(''), q.segs.map(p => p.t).join('')); assert.equal(pieces.filter(p => p.k).length >= 1, true);
    assert.ok(tjParts(pieces).includes('<mark'));
  }
  assert.deepEqual(Object.keys(seen).sort(), ['arid', 'lazim', 'munfasil', 'muttasil', 'tabii']);
});

test('audio hors ligne : adresses, estimation, plafond et plages d\'octets du service worker', () => {
  const html = read('index.html'), au = html.slice(html.indexOf('/* AU:begin'), html.indexOf('/* AU:end */'));
  const { AU_EA, AU_EA128, auQ, auEntry, auUrl, auPad, auChars, auEstimate, auPlan, auMo } = new Function(au + '; return {AU_EA, AU_EA128, auQ, auEntry, auUrl, auPad, auChars, auEstimate, auPlan, auMo};')();
  const ids = [...html.matchAll(/\['(ar\.[a-z]+)', '[^']+', \d+\]/g)].map(m => m[1]); assert.equal(ids.length, 8);
  for (const id of ids) assert.ok(AU_EA[id] && /_64kbps$/.test(AU_EA[id]), 'dossier everyayah pour ' + id);
  assert.equal(auUrl('ar.alafasy', 1, 1), 'https://everyayah.com/data/Alafasy_64kbps/001001.mp3'); assert.equal(auUrl('ar.husary', 114, 6), 'https://everyayah.com/data/Husary_64kbps/114006.mp3'); assert.equal(auPad(7), '007');
  // 128 kbps : disponible pour 7 récitateurs sur 8 (pas As-Sudais) ; sinon retour automatique au 64
  assert.equal(Object.keys(AU_EA128).length, 7); assert.ok(!AU_EA128['ar.abdurrahmaansudais']); assert.ok(ids.filter(i => i !== 'ar.abdurrahmaansudais').every(i => /128/.test(AU_EA128[i])));
  assert.equal(auUrl('ar.alafasy', 1, 1, 128), 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3'); assert.equal(auUrl('ar.husarymujawwad', 2, 3, 128), 'https://everyayah.com/data/Husary_128kbps_Mujawwad/002003.mp3');
  assert.equal(auUrl('ar.abdurrahmaansudais', 1, 1, 128), 'https://everyayah.com/data/Abdurrahmaan_As-Sudais_64kbps/001001.mp3'); assert.equal(auQ('ar.abdurrahmaansudais', 128), 64); assert.equal(auQ('ar.alafasy', 128), 128); assert.equal(auQ('ar.alafasy', 64), 64);
  assert.deepEqual(auEntry(1234), { b: 1234, q: 64 }); assert.deepEqual(auEntry({ b: 5, q: 128 }), { b: 5, q: 128 });
  assert.equal(auChars('بِسْمِ ٱللَّهِ'), 7);
  const est = auEstimate([{ bytes: 1000, chars: 100 }, { bytes: 3000, chars: 200 }], 1000); assert.equal(est, Math.round(4000 / 300 * 1000 * 1.15)); assert.equal(auEstimate([], 500), 0);
  const P = auPlan([{ s: 1, bytes: 40 }, { s: 2, bytes: 70 }, { s: 3, bytes: 50 }, { s: 4, bytes: 10 }], 100);
  assert.deepEqual(P.take, [1, 3, 4]); assert.deepEqual(P.skip, [2]); assert.equal(P.used, 100); assert.deepEqual(auPlan([{ s: 1, bytes: 500 }], 100).take, []);
  assert.equal(auMo(40e6), '40 Mo'); assert.equal(auMo(1.5e9), '1.5 Go'); assert.equal(auMo(10), '1 Mo');
  // service worker : les caches ne sont pas effacés, plages d'octets
  const sw = read('sw.js'); assert.match(sw, /\[SHELL, RUNTIME, AUDIO\]/); assert.match(sw, /hostname === 'everyayah\.com'/);
  const rangeOf = new Function(sw.slice(sw.indexOf('function rangeOf'), sw.indexOf('async function audioResponse')) + '; return rangeOf;')();
  assert.deepEqual(rangeOf('bytes=0-99', 1000), [0, 99]); assert.deepEqual(rangeOf('bytes=900-', 1000), [900, 999]); assert.deepEqual(rangeOf('bytes=-100', 1000), [900, 999]); assert.deepEqual(rangeOf('bytes=0-5000', 1000), [0, 999]);
  assert.equal(rangeOf('bytes=1000-', 1000), null); assert.equal(rangeOf('bytes=5-2', 1000), null); assert.equal(rangeOf('abc', 1000), null); assert.equal(rangeOf('bytes=-', 1000), null); assert.equal(rangeOf(null, 10), null);
});

test('audio du plan du jour : sourates concernées, déjà téléchargées, détection du Wi-Fi', () => {
  const html = read('index.html'), au = html.slice(html.indexOf('/* AU:begin'), html.indexOf('/* AU:end */'));
  const { auWifi, auPlanSurahs, auMissing } = new Function(au + '; return {auWifi, auPlanSurahs, auMissing};')();
  assert.deepEqual(auPlanSurahs({ next: { s: 114, a: 1, b: 3 }, rec: [{ s: 113, a: 1, b: 3 }, { s: 113, a: 4, b: 5 }], man: [{ s: 112, a: 1, b: 2 }, { s: 114, a: 4, b: 6 }] }), [112, 113, 114]);
  assert.deepEqual(auPlanSurahs({ next: null, rec: [], man: [] }), []); assert.deepEqual(auPlanSurahs({ next: { s: 2, a: 1, b: 5 } }), [2]);
  assert.deepEqual(auMissing([1, 2, 3], { 2: { b: 5, q: 64 } }), [1, 3]); assert.deepEqual(auMissing([1], { 1: 100 }), []);
  assert.equal(auWifi({ type: 'wifi' }), true); assert.equal(auWifi({ type: 'ethernet' }), true); assert.equal(auWifi({ type: 'cellular' }), false);
  assert.equal(auWifi({ type: 'wifi', saveData: true }), false, 'mode économie de données'); assert.equal(auWifi({ effectiveType: '4g' }), false, 'type inconnu : jamais automatique'); assert.equal(auWifi(undefined), false);
});

test('surveillance des e-mails : seuils d\'alerte et passage au nom de domaine', () => {
  const html = read('index.html'), wa = html.slice(html.indexOf('/* WA:begin'), html.indexOf('/* WA:end */'));
  const { WA, admWatch } = new Function(wa + '; return {WA, admWatch};')(); const now = Date.UTC(2026, 9, 21, 12);
  const mk = (n, agoH) => Array.from({ length: n }, () => ({ created_at: new Date(now - agoH * 36e5).toISOString() }));
  let w = admWatch([], now); assert.deepEqual([w.h1, w.h24, w.total, w.level, w.domain], [0, 0, 0, 0, false]);
  w = admWatch(mk(3, 0.5).concat(mk(5, 5), mk(10, 100)), now); assert.deepEqual([w.h1, w.h24, w.total, w.level], [3, 8, 18, 0]);
  w = admWatch(mk(WA.HOUR_LIMIT * WA.WARN, 0.2), now); assert.equal(w.hourLevel, 1); assert.equal(w.level, 1);
  w = admWatch(mk(WA.HOUR_LIMIT * WA.ALERT, 0.2), now); assert.equal(w.hourLevel, 2);
  w = admWatch(mk(WA.DAY_LIMIT * WA.ALERT, 10), now); assert.equal(w.hourLevel, 0); assert.equal(w.dayLevel, 2); assert.equal(w.level, 2);
  assert.equal(admWatch(mk(WA.DOMAIN_USERS, 500), now).domain, true); assert.equal(admWatch(mk(WA.DOMAIN_USERS - 1, 500), now).domain, false);
  assert.equal(admWatch([{ created_at: null }], now).h24, 0, 'date absente');
});

test('confidentialité : chaque service contacté automatiquement est cité dans la page, tout nouveau service fait échouer ce test', () => {
  const html = read('index.html'), sw = read('sw.js'), cfg = read('config.js');
  const legal = html.slice(html.indexOf('function renderLegal'), html.indexOf('function summarize') > 0 ? html.indexOf('function summarize') : undefined);
  // services contactés par l'application sans clic de l'utilisateur -> mot attendu dans la page de confidentialité
  const auto = { 'supabase.co': 'Supabase', 'cdn.jsdelivr.net': 'jsDelivr', 'api.alquran.cloud': 'AlQuran Cloud', 'cdn.islamic.network': 'AlQuran Cloud', 'everyayah.com': 'everyayah.com', 'github.io': 'GitHub' };
  for (const [host, word] of Object.entries(auto)) assert.ok(legal.includes(word), `la page de confidentialité doit citer « ${word} » (${host})`);
  // liens que l'utilisateur ouvre lui-même (aucune donnée envoyée) : seuls ces autres hôtes sont admis dans le code
  const linkOnly = ['www.cnil.fr', 'tanzil.net', 'alquran.cloud', '1x.ax', 'www.w3.org', 'schemas.openxmlformats.org', 'ar.wikipedia.org', 'ar.wikisource.org', 'github.com', 'resend.com', 'supabase.com', 'api.alquran.cloud'];
  const hosts = new Set([...(html + sw + cfg).matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map(m => m[1].toLowerCase()));
  const unknown = [...hosts].filter(h => !Object.keys(auto).some(a => h === a || h.endsWith('.' + a)) && !linkOnly.includes(h) && !/^localhost|^127\./.test(h));
  assert.deepEqual(unknown, [], 'nouveau service dans le code : ajoute-le à la page de confidentialité (renderLegal) puis à ce test');
  // données collectées : la page doit les décrire
  for (const w of ['adresse e-mail', 'progression', 'Rappels', 'notifications', 'région', 'audio']) assert.ok(new RegExp(w, 'i').test(legal) || new RegExp(w, 'i').test(html.slice(html.indexOf('Stockage sur ton appareil'), html.indexOf('Stockage sur ton appareil') + 900)), 'à décrire dans la page : ' + w);
  assert.match(cfg, /contact:\s*'[^']+@[^']+'/); assert.doesNotMatch(cfg, /region:\s*''/, 'région Supabase renseignée');
});

test('export CSV : échappement, séparateurs, protection contre les formules, UTF-8 avec BOM', () => {
  const html = read('index.html'), c = html.slice(html.indexOf('/* CSV:begin'), html.indexOf('/* CSV:end */'));
  const { csvCell, toCsv } = new Function(c + '; return {csvCell, toCsv};')();
  assert.equal(csvCell('simple', ';'), 'simple'); assert.equal(csvCell('a;b', ';'), '"a;b"'); assert.equal(csvCell('a;b', ','), 'a;b'); assert.equal(csvCell('a,b', ','), '"a,b"');
  assert.equal(csvCell('il a dit "oui"', ';'), '"il a dit ""oui"""'); assert.equal(csvCell('ligne1\nligne2', ';'), '"ligne1\nligne2"');
  assert.equal(csvCell(null, ';'), ''); assert.equal(csvCell(undefined, ';'), ''); assert.equal(csvCell(0, ';'), '0'); assert.equal(csvCell(12.5, ';'), '12.5');
  assert.equal(csvCell('=1+1', ';'), "'=1+1"); assert.equal(csvCell('+cmd|x', ';'), "'+cmd|x"); assert.equal(csvCell('@SUM(A1)', ';'), "'@SUM(A1)"); assert.equal(csvCell('-2+3', ';'), "'-2+3"); assert.equal(csvCell('-3', ';'), '-3'); assert.equal(csvCell('بِسْمِ', ';'), 'بِسْمِ');
  const out = toCsv([['a', 'b;c'], [1, 'ء']], ';'); assert.ok(out.startsWith('\ufeff')); assert.equal(out.slice(1), 'a;"b;c"\r\n1;ء\r\n');
});

test('accessibilité : contrastes WCAG des couleurs du thème et du tajwīd (mode contraste renforcé)', () => {
  const html = read('index.html'), a = html.slice(html.indexOf('/* A11Y:begin'), html.indexOf('/* A11Y:end */'));
  const { a11yContrast, a11yDarken, a11yLum } = new Function(a + '; return {a11yContrast, a11yDarken, a11yLum};')();
  assert.ok(Math.abs(a11yContrast('#000000', '#ffffff') - 21) < 0.01); assert.ok(Math.abs(a11yContrast('#777777', '#ffffff') - 4.48) < 0.02, 'valeur de référence WCAG');
  // couleurs du thème : texte courant >= 4,5:1 (clair et sombre)
  const css = html.slice(html.indexOf(':root{'), html.indexOf('*{box-sizing'));
  const light = Object.fromEntries([...css.slice(0, css.indexOf('@media')).matchAll(/--([a-z-]+):(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
  const dark = { ...light, ...Object.fromEntries([...css.slice(css.indexOf('@media')).matchAll(/--([a-z-]+):(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]])) };
  for (const [name, t] of [['clair', light], ['sombre', dark]]) {
    for (const [fg, bg] of [['ink', 'bg'], ['ink', 'card'], ['muted', 'bg'], ['muted', 'card'], ['accent', 'card'], ['accent-ink', 'accent'], ['ok', 'okbg'], ['ko', 'kobg'], ['mid', 'midbg'], ['ko', 'card'], ['ok', 'card']])
      assert.ok(a11yContrast(t[fg], t[bg]) >= 4.5, `thème ${name} : ${fg} sur ${bg} = ${a11yContrast(t[fg], t[bg]).toFixed(2)}`);
  }
  // couleurs officielles du tajwīd sur la page claire : lesquelles sont sous 4,5:1 ; la version renforcée les corrige toutes
  const leg = [...html.matchAll(/\['([a-z])', '(#[0-9A-F]{6})', '/g)].map(m => [m[1], m[2]]); assert.equal(leg.length, 15);
  const bg = '#fbf6e8', low = leg.filter(([, c]) => a11yContrast(c, bg) < 4.5), hc = leg.map(([k, c]) => [k, a11yDarken(c, bg)]);
  assert.equal(leg.filter(([k]) => k !== 's' && k !== 'b').length, 15); assert.equal(low.length, 10, 'le texte du réglage annonce 10 règles sur 15 : ' + low.map(x => x.join('=')));
  for (const [k, c] of hc) assert.ok(a11yContrast(c, bg) >= 4.5, `${k} ${c} : ${a11yContrast(c, bg).toFixed(2)}`);
  assert.ok(hc.every(([k, c], i) => c === leg[i][1] || a11yContrast(leg[i][1], bg) < 4.5), 'seules les couleurs trop pâles sont modifiées');
  const hex = new Set(hc.map(([, c]) => c)); assert.ok(hex.size >= 12, 'les couleurs restent distinctes : ' + hex.size);
  assert.equal(a11yDarken('#000EBC', bg), '#000EBC');
});

test('suivi par un enseignant : régularité, progression par sourate, erreurs fréquentes (fonctions pures)', () => {
  const html = read('index.html'), tc = html.slice(html.indexOf('/* TC:begin'), html.indexOf('/* TC:end */'));
  const { tcRegularity, tcPerSurah, tcFrequent, tcGoal, tcRemaining, tcRanges, tcPace, tcGoalR } = new Function(tc + '; return {tcRegularity, tcPerSurah, tcFrequent, tcGoal, tcRemaining, tcRanges, tcPace, tcGoalR};')();
  { const len = n => ({ 1: 7, 2: 286, 3: 200 })[n]; const R = tcGoalR({ '1:1': [1, 0], '1:2': [0, 1], '2:1': [2, 0], '2:2': [1, 0] }, 1, 3, len);
    assert.equal(R.total, 493); assert.equal(R.seen, 3); assert.equal(R.left, 490); assert.deepEqual(R.parts.map(p => [p.s, p.rest.length]), [[1, 6], [2, 284], [3, 200]]); assert.equal(R.pct, 1);
    assert.deepEqual(tcGoalR({}, 1, 1, len), { seen: 0, total: 7, left: 7, pct: 0, parts: [{ s: 1, total: 7, rest: [1, 2, 3, 4, 5, 6, 7] }] }); assert.equal(tcGoalR({}, 2, undefined, len).total, 286); }
  assert.deepEqual(tcRemaining({ '1:1': [1, 0], '1:2': [0, 2], '1:4': [3, 1] }, 1, 7), [2, 3, 5, 6, 7]);
  assert.equal(tcRanges([1, 2, 3, 5, 7, 8]), '1–3, 5, 7, 8'.replace('7, 8', '7, 8')); assert.equal(tcRanges([2, 3, 5, 6, 7]), '2, 3, 5–7'); assert.equal(tcRanges([]), ''); assert.equal(tcRanges(Array.from({ length: 40 }, (_, i) => i * 2 + 1), 3), '1, 3, 5 …');
  const noon = Date.parse('2026-10-22T12:00:00'); assert.deepEqual(tcPace(6, '2026-10-24', noon), { days: 3, perDay: 2 }); assert.deepEqual(tcPace(5, '2026-10-22', noon), { days: 1, perDay: 5 }); assert.deepEqual(tcPace(5, '2026-10-20', noon), { days: -1, perDay: 0 }); assert.deepEqual(tcPace(0, '2026-10-24', noon), { days: 3, perDay: 0 });
  // objectif : un verset compte quand il est réussi au moins une fois ; une tentative ratée seule ne fait pas avancer
  assert.deepEqual(tcGoal({ '1:1': [1, 0], '1:2': [0, 3], '1:3': [2, 5], '2:1': [9, 0] }, 1, 7), { seen: 2, total: 7, pct: 29 });
  assert.deepEqual(tcGoal({ '1:1': [1, 0], '1:2': [1, 0], '1:3': [1, 0], '1:4': [1, 0], '1:5': [1, 0], '1:6': [1, 0], '1:7': [1, 0] }, 1, 7), { seen: 7, total: 7, pct: 100 });
  assert.deepEqual(tcGoal({}, 1, 7), { seen: 0, total: 7, pct: 0 });
  const now = new Date(2026, 9, 21, 12).getTime(), key = i => { const d = new Date(now - i * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let R = tcRegularity({ [key(0)]: 5, [key(1)]: 3, [key(2)]: 8, [key(4)]: 1, [key(20)]: 2 }, now);
  assert.equal(R.bars.length, 14); assert.equal(R.bars[13].d, key(0)); assert.equal(R.bars[13].n, 5); assert.equal(R.bars[0].d, key(13));
  assert.equal(R.active7, 4); assert.equal(R.active30, 5); assert.equal(R.streak, 3, 'série : aujourd\'hui, hier, avant-hier'); assert.equal(R.total14, 17);
  R = tcRegularity({ [key(1)]: 3, [key(2)]: 4 }, now); assert.equal(R.streak, 2, 'rien aujourd\'hui : la série part d\'hier'); assert.equal(tcRegularity({}, now).streak, 0); assert.equal(tcRegularity(null, now).active30, 0);
  assert.equal(tcRegularity({ [key(3)]: 2 }, now).streak, 0, 'jour manqué : série à 0');
  const P = tcPerSurah({ '2:5': [1, 3], '2:6': [2, 0], '3:9': [0, 2], '114:1': [10, 0], 'tuhfa:1': [1, 1] });
  assert.deepEqual(P.map(x => x.s), ['3', '2', 'tuhfa', '114']); assert.deepEqual(P[1], { s: '2', ok: 3, ko: 3, seen: 2, rate: 0.5 }); assert.deepEqual(tcPerSurah(undefined), []);
  const F = tcFrequent([{ k: '2:5', t: 10 }, { k: '2:5', t: 30 }, { k: '3:9', t: 20 }, { k: '3:9', t: 25 }, { k: '1:1', t: 99 }, { k: '2:5', t: 5 }], 2);
  assert.deepEqual(F.map(x => [x.k, x.n]), [['2:5', 3], ['3:9', 2]]); assert.equal(F[0].last, 30); assert.deepEqual(tcFrequent([], 5), []);
});

test('rôle enseignant : le code du client n\'appelle que des fonctions SQL existantes dans teacher.sql, avec les bons arguments', () => {
  const html = read('index.html'), sql = read('supabase/teacher.sql') + read('supabase/schema.sql');
  const calls = [...html.matchAll(/sb\.rpc\('([a-z_]+)'(?:, \{([^}]*)\})?/g)].map(m => [m[1], (m[2] || '').split(',').map(x => x.split(':')[0].trim()).filter(Boolean)]);
  const mine = ['invite_create', 'invite_cancel', 'invite_accept', 'link_revoke', 'links_mine', 'access_log_mine', 'teacher_students', 'teacher_student_data'];
  for (const [n, args] of calls.filter(([n]) => mine.includes(n))) {
    const m = new RegExp(`function public\\.${n}\\(([^)]*)\\)`).exec(sql); assert.ok(m, 'fonction SQL absente : ' + n);
    const params = m[1].split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean); assert.deepEqual([...args].sort(), [...params].sort(), `arguments de ${n}`);
  }
  assert.ok(mine.every(n => calls.some(([c]) => c === n)), 'chaque fonction est utilisée par l\'application');
  assert.match(sql, /revoke all on function[\s\S]*teacher_student_data\(uuid\)[\s\S]*from public, anon/); assert.match(read('supabase/teacher.sql'), /grant select on public\.teacher_invites, public\.teacher_links, public\.teacher_access_log to authenticated/);
  assert.doesNotMatch(read('supabase/teacher.sql'), /create policy[^;]*teacher[^;]*on public\.user_data/i, 'aucune règle ne donne accès direct à user_data');
});

test('résumé hebdomadaire : total, jours actifs et série sur 7 jours (send-reminders)', () => {
  const ts = read('supabase/functions/send-reminders/index.ts');
  const code = ts.slice(ts.indexOf('function weekSummary'), ts.indexOf('const WK'))
    .replace('days: Record<string, number>, now: Date', 'days, now');
  const { weekSummary } = new Function(code + '; return {weekSummary};')();
  const now = new Date(Date.UTC(2026, 9, 25, 17, 0)), d = n => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);
  assert.deepEqual(weekSummary({}, now), { total: 0, active: 0, streak: 0 });
  assert.deepEqual(weekSummary({ [d(0)]: 5, [d(1)]: 3, [d(3)]: 2, [d(9)]: 99 }, now), { total: 10, active: 3, streak: 2 });   // le 9e jour est hors fenêtre
  assert.deepEqual(weekSummary({ [d(1)]: 4 }, now), { total: 4, active: 1, streak: 1 });   // aujourd'hui pas encore révisé : la série d'hier compte encore
  assert.ok(ts.includes("getUTCDay() !== 0"), 'seulement le dimanche');
});

test('contenus rédigés par l’IA : la mention « pas une source officielle » accompagne les explications de règles et le détail est dans Réglages', () => {
  const html = read('index.html');
  assert.ok((html.match(/\$\{AI\(\)\}/g) || []).length >= 7, 'la mention doit figurer près des textes d’explication (plan, règles de tajwīd, madd, aḥkām, légende)');
  for (const f of ['CONDRULE', 'AHNOTE', 'TJNOTE']) { const i = html.indexOf('const ' + f + ' ='); assert.ok(html.slice(i, i + 1500).includes('${AI()}'), f + ' doit porter la mention'); }
  assert.ok(html.includes("D'où viennent les contenus ?") && html.includes('Rédigé par une IA, pas une source officielle'), 'carte « D’où viennent les contenus ? » dans Réglages');
});

test('PWA : écrans de lancement iPhone et captures du manifeste existent, avec les bonnes dimensions', () => {
  const html = read('index.html'), man = JSON.parse(read('manifest.webmanifest'));
  const dims = f => { const b = fs.readFileSync(f); if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)]; let i = 2; while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return null; };
  const links = [...html.matchAll(/<link rel="apple-touch-startup-image" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)" href="([^"]+)">/g)];
  assert.ok(links.length >= 28, 'iPhone (12 tailles) et iPad (9 tailles, portrait et paysage)');
  for (const [, w, h, d, ori, href] of links) assert.deepEqual(dims(href), ori === 'portrait' ? [w * d, h * d] : [h * d, w * d], href + ' : dimensions = largeur×densité (inversées en paysage)');
  assert.equal(new Set(links.map(l => l.slice(1, 5).join('x'))).size, links.length, 'une balise par appareil et par orientation');
  assert.ok(links.some(l => l[1] === '820' && l[2] === '1180' && l[4] === 'landscape') && links.some(l => l[1] === '1024' && l[2] === '1366'), 'iPad Air 11 pouces et 13 pouces');
  assert.ok(Array.isArray(man.screenshots) && man.screenshots.length >= 2, 'captures du manifeste');
  for (const s of man.screenshots) { assert.deepEqual(dims(s.src), s.sizes.split('x').map(Number), s.src); assert.equal(s.form_factor, 'narrow'); }
  assert.ok(man.id, 'identifiant de l’application');
});

test('notifications : chaque notification a sa propre étiquette (le 2e rappel ne remplace plus le 1er sans alerte)', () => {
  const sw = read('sw.js'), ts = read('supabase/functions/send-reminders/index.ts');
  assert.ok(!/tag: 'tathbit-reminder'/.test(sw) && /tag: d\.tag \|\| undefined/.test(sw), 'le service worker utilise l’étiquette envoyée par le serveur');
  assert.match(ts, /tag: 'rappel-' \+ d\.date \+ \(d\.second \? '-2' : '-1'\)/, 'rappel 1 et rappel 2 : étiquettes différentes');
  assert.match(ts, /tag: 'message-' \+ m\.id/); assert.match(ts, /tag: 'demande-' \+ r\.user_id/);
});

test('lien de confirmation reçu par e-mail : succès, lien expiré ou refusé sont reconnus (et expliqués à l’utilisateur)', () => {
  const html = read('index.html'), { authLinkNotice } = new Function(html.slice(html.indexOf('/* AL:begin'), html.indexOf('/* AL:end */')) + '; return {authLinkNotice};')();
  assert.deepEqual(authLinkNotice('#access_token=abc&refresh_token=x&type=signup', ''), { ok: 'signup' });
  assert.deepEqual(authLinkNotice('', '?code=123'), { ok: 'link' });
  assert.equal(authLinkNotice('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '').err, 'expired');
  assert.equal(authLinkNotice('#error=server_error&error_code=unexpected_failure&error_description=Oups', '').err, 'other');
  assert.equal(authLinkNotice('#error=server_error&error_description=Oups+ca+casse', '').detail, 'Oups ca casse');
  assert.equal(authLinkNotice('', ''), null); assert.equal(authLinkNotice('#/plan', '?r=3'), null);
  assert.ok(html.includes("LINK_NOTICE.err === 'expired'") && html.includes("history.replaceState(null, '', location.pathname)"), 'un lien inutilisable affiche une explication sur l’écran de connexion');
});

test('micro qui ne s’ouvre pas : chaque cause a un message d’aide précis, traduit, adapté à l’appareil', () => {
  const html = read('index.html'), { micHelp } = new Function(html.slice(html.indexOf('/* MH:begin'), html.indexOf('/* MH:end */')) + '; return {micHelp};')();
  const i18n = read('i18n.js');
  const all = []; for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported', 'no-speech']) for (const [pf, st] of [['ios', true], ['ios', false], ['android', false], ['desktop', false]]) { const h = micHelp(code, pf, st); assert.ok(h.text, code); all.push(h.text, h.how); }
  assert.match(micHelp('not-allowed', 'ios', false).how, /Réglages > Safari > Microphone.*dictée/); assert.match(micHelp('not-allowed', 'ios', true).how, /ouvre le site dans Safari/);
  assert.match(micHelp('not-allowed', 'android', false).how, /cadenas.*Microphone/); assert.match(micHelp('not-allowed', 'desktop', false).how, /cadenas.*recharge/);
  assert.equal(micHelp('weird', 'ios', false).text, '', 'code inconnu : message générique avec le code');
  for (const t of new Set(all.filter(Boolean))) assert.ok(i18n.includes(JSON.stringify(t).slice(1, -1).replace(/\\u2019/g, '’')), 'traduction manquante : ' + t);
});
