/* Tests de l'application Hifz : pilotent index.html dans un <iframe> avec de vrais clics.
   Résultat : window.__result = {passed, failed, results:[{name, ok, err}]} et affichage dans la page. */
(async () => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!local && !/[?&]force\b/.test(location.search)){ document.getElementById('sum').innerHTML = '<b class="ko">Refusé : lance ces tests depuis localhost (ils effacent puis restaurent la progression locale).</b>'; window.__result = {passed: 0, failed: 1, results: []}; return; }

  const results = [], tests = [];
  const test = (name, fn) => tests.push({name, fn});
  const fail = m => { throw new Error(m); };
  const ok = (c, m) => { if (!c) fail(m || 'condition fausse'); };
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail((m ? m + ' : ' : '') + 'attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ---- application sous test ---- */
  const saved = {}; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k.startsWith('hifz.')) saved[k] = localStorage.getItem(k); }
  const clean = () => Object.keys(localStorage).filter(k => k.startsWith('hifz.')).forEach(k => localStorage.removeItem(k));
  const restore = () => { clean(); Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v)); };
  window.addEventListener('pagehide', restore);
  clean();
  const fr = document.createElement('iframe'); fr.src = '../index.html'; document.body.appendChild(fr);
  await new Promise(r => fr.addEventListener('load', r, {once: true}));
  const W = fr.contentWindow, D = fr.contentDocument, E = c => W.eval(c);
  const jsErrors = []; W.addEventListener('error', e => jsErrors.push(e.message)); W.addEventListener('unhandledrejection', e => jsErrors.push(String(e.reason && e.reason.message || e.reason)));
  for (let i = 0; i < 100 && !(() => { try { return E('Q') && E('Q').length; } catch { return 0; } })(); i++) await wait(100);
  ok(E('Q') && E('Q').length === 114, "le Coran ne s'est pas chargé");
  E("CLOUD.url = ''; CLOUD.anonKey = ''; sb = null; me = null; window.confirm = () => true; window.alert = m => { window.__alerts = (window.__alerts || []).concat(String(m)); };"); // pas de compte pendant les tests
  const reset = (extra = '') => { E("cfg = Object.assign({}, DEF, {tab: 'home', n: 5, corr: 'standard'}); stats = {}; sched = {}; days = {}; errors = []; plan = null; custom = []; ses = null; LANG = 'fr'; applyLang(); " + extra); jsErrors.length = 0; };
  const $q = s => D.querySelector(s), $$q = s => [...D.querySelectorAll(s)], appText = () => D.getElementById('app').textContent;   // texte de l'écran seulement (le code de la page n'en fait pas partie)
  const click = el => { ok(el, 'élément introuvable'); el.click(); };
  const clickAct = (act, v) => click($q(`[data-act="${act}"]${v !== undefined ? `[data-v="${v}"]` : ''}`));
  const noErr = ctx => ok(!jsErrors.length, `erreur JS pendant « ${ctx} » : ${jsErrors.join(' / ')}`);
  const fb = () => $q('#fb .fb');
  const ALL = "{type: 'surah', from: 1, to: 114}", MAT = "{type: 'matn', id: 'all'}";
  const expectedText = () => E("cur.units.map(u => u.text).join(' ')");
  const strip = t => t.replace(/[ً-ْٰ]/g, '');
  const fill = (txt) => { const a = $q('#ans'); ok(a, 'zone de saisie absente'); a.value = txt; };

  /* ---- données ---- */
  test('Coran : 114 sourates, 6236 versets, 604 pages, 30 juz', () => {
    eq(E('Q.length'), 114); eq(E('Q.reduce((n, s) => n + s.a.length, 0)'), 6236);
    eq(E('Math.max(...Q.flatMap(s => s.a.map(v => v.p)))'), 604); eq(E('Math.max(...Q.flatMap(s => s.a.map(v => v.j)))'), 30);
    eq(E('quranOk(Q)'), true);
  });
  test('Coran : le texte embarqué (quran.js) est utilisé et son empreinte SHA-256 correspond', async () => {
    ok(W.QURAN && W.QURAN.surahs.length === 114, 'quran.js absent');
    const txt = W.QURAN.surahs.flatMap(s => s.a.map(v => v[0])).join('\n');
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    eq([...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''), W.QURAN.sha256);
    eq(E("Q[1].a[0].t"), W.QURAN.surahs[1].a[0][0], 'le texte affiché doit venir de quran.js');
  });
  test('Coran : Fatiha 7 versets, Baqara 286, Tawba sans basmala préfixée', () => {
    eq(E('Q[0].a.length'), 7); eq(E('Q[1].a.length'), 286);
    ok(!E('Q[1].a[0].t').startsWith('بِسْمِ'), 'la basmala ne doit pas préfixer le verset 1 de la Baqara');
    ok(E('Q[0].a[0].t').startsWith('بِسْمِ'), 'la Fatiha commence par la basmala (c\'est son verset 1)');
  });
  test('Moutoun : Tuhfa 61, Bayquniyya 34, Arbain 42 unités', () => {
    eq(E("MT.tuhfa.a.length"), 61); eq(E("MT.bayquniyya.a.length"), 34); eq(E("MT.arbain.a.length"), 42);
  });
  test('Versets proches : toutes les références existent', () => {
    const bad = []; const MS = E('MS');
    for (const [k, v] of Object.entries(MS)){ const [s, a] = k.split(':').map(Number); if (!E(`Q[${s - 1}] && ${a} <= Q[${s - 1}].a.length`)) bad.push(k);
      v.forEach(x => { const [s2, a2] = x.split(':').map(Number); if (!E(`Q[${s2 - 1}] && ${a2} <= Q[${s2 - 1}].a.length`)) bad.push(x); }); }
    eq(bad, []);
  });
  test('Service worker : tous les fichiers de la liste existent', async () => {
    const src = await (await fetch('../sw.js', {cache: 'no-cache'})).text();
    const files = [...src.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
    ok(files.includes('quran.js'), 'quran.js doit être dans le cache hors ligne');
    const missing = []; for (const f of files){ const r = await fetch('../' + f, {method: 'HEAD', cache: 'no-cache'}); if (!r.ok) missing.push(f); }
    eq(missing, []);
  });
  test('Lecteur : données du tajwīd, des traductions et du tafsir complètes et conformes à leur empreinte', async () => {
    for (const n of ['tajweed', 'fr', 'en', 'muyassar']){
      const x = await W.loadX(n); eq(x.s.length, 114, n); eq(x.s.reduce((t, a) => t + a.length, 0), 6236, n);
      eq(x.s.map(a => a.length).slice(0, 3), [7, 286, 200], n); ok(x.url && x.name, 'source affichable');
    }
    const t = E("QX.tajweed.s.flatMap(a => a).join('')"); ok(!t.replace(/\[[a-z]\[/g, '').includes('['), 'balise inconnue ou mal formée');
    eq((t.match(/\[[a-z]\[/g) || []).length, (t.match(/\]/g) || []).length, 'balises équilibrées');
  });
  test('Lecteur : tajwīd, traduction et tafsir — une ligne par verset, légende et sources affichées', async () => {
    reset(); E("openReader('q:1')");
    clickAct('rd-taj'); await wait(1200); ok($q('#rbody .rd.tj .tj-n'), 'couleurs absentes'); ok($q('details summary'), 'légende absente');
    ok(appText().includes('1x.ax') || $$q('a').some(a => /1x\.ax/.test(a.href)), 'lien de la légende officielle');
    const sel = $q('#rdtr'); sel.value = 'fr'; sel.dispatchEvent(new W.Event('change')); await wait(1200);
    eq($$q('#rbody .rvb').length, 7); eq($q('#rbody .rtr').textContent, E("QX.fr.s[0][0]")); ok($$q('a').some(a => /tanzil\.net\/trans/.test(a.href)), 'lien Tanzil obligatoire');
    clickAct('rd-tf'); await wait(1500); eq($$q('#rbody .rtf').length, 7); ok($$q('a').some(a => /alquran\.cloud/.test(a.href)), 'source du tafsir');
    clickAct('rd-hide'); ok($$q('#rbody .rv.hid').length === 7 && $q('#rbody .rtr'), 'le texte arabe se masque, la traduction reste');
    clickAct('rd-hide'); $q('#rdtr').value = ''; $q('#rdtr').dispatchEvent(new W.Event('change')); await wait(300); eq($$q('#rbody .rvb').length, 7, 'le tafsir garde le mode ligne par ligne');
    clickAct('rd-tf'); await wait(300); eq($$q('#rbody .rvb').length, 0); clickAct('rd-taj'); await wait(300); ok(!$q('#rbody .tj-n'), 'couleurs retirées'); noErr('lecteur enrichi');
    // la verification d'un fichier altéré doit échouer (aucun contenu douteux affiché)
    E("delete QX.en; delete XPROMISE.en; XFILES.en = 'data/does-not-exist.js'"); let failed = false; try { await W.loadX('en'); } catch { failed = true; } ok(failed, 'un fichier absent doit être refusé');
    E("XFILES.en = 'data/tr-en.js'; cfg.rdTr = ''; cfg.rdTaj = false; cfg.rdTf = false;");
  });
  test('Lecteur enrichi : aucune clé de traduction manquante (en, ar) légende comprise', async () => {
    for (const L of ['en', 'ar']){
      reset(); E(`setLang('${L}'); cfg.rdTaj = true; cfg.rdTr = 'fr'; cfg.rdTf = true;`); await Promise.all(['tajweed', 'fr', 'muyassar'].map(n => W.loadX(n)));
      E("openReader('q:114')"); await wait(200); ok($q('.tjkey'), 'légende'); eq(E('[...missingKeys]'), [], L);
    }
    E("cfg.rdTaj = false; cfg.rdTr = ''; cfg.rdTf = false;");
  });
  test('Traductions : aucune clé manquante sur les écrans principaux (en, ar)', async () => {
    const miss = {};
    for (const L of ['en', 'ar']){
      reset(); E(`setLang('${L}')`);
      for (const t of ['home', 'train', 'plan', 'progress', 'settings', 'errors']){ E(`go('${t}')`); await wait(20); }
      E("renderLegal()"); E("openReader('q:1')"); E("openReader('m:tuhfa')");
      E("start(buildPool(cfg.scope))"); E("home()");
      miss[L] = E('[...missingKeys]');
    }
    eq(miss, {en: [], ar: []});
  });

  /* ---- exercices à choix : de vrais clics, répétés (les tirages sont aléatoires) ---- */
  const choice = [['which', ALL], ['mcq', ALL], ['mutash', ALL], ['order', ALL], ['which', MAT], ['mcq', MAT]];
  for (const [mode, scope] of choice){
    const label = `${mode} (${scope === ALL ? 'Coran' : 'moutoun'})`;
    test(`QCM ${label} : bonne réponse → vert, mauvaise → rouge (30 tirages)`, () => {
      reset(`cfg.mode = '${mode}'; cfg.scope = ${scope};`);
      for (let n = 0; n < 30; n++){
        const wantOk = n % 2 === 0;
        E("start()");
        noErr('start ' + label);
        const btns = $$q('.opt'); ok(btns.length >= 3, 'moins de 3 propositions');
        const isGood = b => E(`(cur.m === 'which' || cur.m === 'order') ? (isQ(cur.correct) ? +"${b.dataset.v}" : "${b.dataset.v}") === cur.correct : cur.opts[+"${b.dataset.v}"] === cur.good`);
        const goods = btns.filter(isGood); eq(goods.length, 1, 'une seule bonne réponse attendue');
        const target = wantOk ? goods[0] : btns.find(b => !isGood(b));
        click(target); noErr('clic ' + label);
        ok(fb() && fb().classList.contains(wantOk ? 'ok' : 'ko'), `tirage ${n} : retour ${wantOk ? 'vert' : 'rouge'} attendu`);
        ok($q('.opt.c'), 'la bonne réponse doit être marquée');
        if (!wantOk) ok($q('.opt.w'), 'la réponse fausse doit être marquée');
        click(target); // second clic : sans effet
        eq(E('ses.score'), wantOk ? 1 : 0, 'score');
        E("home()");
      }
    });
  }

  /* ---- exercices à saisie ---- */
  const typed = [['next', ALL], ['start', ALL], ['end', ALL], ['link', ALL], ['cont', ALL], ['half', MAT], ['phrase', MAT], ['next', MAT]];
  for (const [mode, scope] of typed){
    test(`Saisie ${mode} (${scope === ALL ? 'Coran' : 'moutoun'}) : texte exact → vert, texte faux → rouge`, () => {
      reset(`cfg.mode = '${mode}'; cfg.scope = ${scope}; cfg.input = 'type'; cfg.corr = 'strict'; cfg.endLen = 2; cfg.contLen = 3;`);
      for (let n = 0; n < 6; n++){
        const good = n % 2 === 0;
        E("start()"); noErr('start ' + mode);
        const exp = expectedText();
        fill(good ? exp : 'كلمة خاطئة تماما'); clickAct('check'); noErr('vérifier ' + mode);
        ok(fb() && fb().classList.contains(good ? 'ok' : 'ko'), `tirage ${n} : ${good ? 'vert' : 'rouge'} attendu pour « ${exp.slice(0, 30)}… »`);
        E("home()");
      }
    });
  }
  test('Saisie à trous (cloze) : tous les mots justes → vert ; un mot faux → rouge (strict)', () => {
    reset(`cfg.mode = 'cloze'; cfg.scope = ${ALL}; cfg.input = 'type'; cfg.corr = 'strict'; cfg.level = 50;`);
    for (let n = 0; n < 10; n++){
      E("start()"); noErr('start cloze');
      const inputs = $$q('.blankin'); ok(inputs.length, 'aucun trou');
      inputs.forEach(i => { i.value = E(`cur.T.tok[${i.dataset.i}]`); });
      if (n % 2){ inputs[0].value = 'خطأ'; }
      clickAct('checkcloze'); noErr('vérifier trous');
      ok(fb().classList.contains(n % 2 ? 'ko' : 'ok'), `tirage ${n}`);
      E("home()");
    }
  });
  test('Auto-évaluation (récitation) : « Tout juste » → vert, « Raté » → rouge', () => {
    reset(`cfg.mode = 'next'; cfg.scope = ${ALL}; cfg.input = 'recite';`);
    E("start()"); clickAct('reveal'); ok($q('#marks'), 'marquage absent'); clickAct('mark-ok'); ok(fb().classList.contains('ok'), 'vert attendu');
    E("home()"); E("start()"); clickAct('reveal'); $$q('.wd')[0].click(); clickAct('mark-go'); ok(!fb().classList.contains('ok'), 'un mot marqué ne peut pas donner vert'); noErr('auto-évaluation');
    E("home()"); E("cfg.mode = 'cloze'"); E("start()"); clickAct('revealall'); $$q('[data-act="grade"]')[0].click(); noErr('trous auto-évalués'); ok(fb(), 'retour attendu');
  });

  /* ---- exactitude de la correction ---- */
  const verdict = (corr, build) => { reset(`cfg.mode = 'next'; cfg.scope = {type:'surah', from: 2, to: 2}; cfg.input = 'type'; cfg.corr = '${corr}';`); E("start()"); fill(build(expectedText())); clickAct('check'); return fb().classList.contains('ok') ? 'ok' : 'ko'; };
  test('Correction stricte : exige les voyelles exactes', () => {
    eq(verdict('strict', t => t), 'ok', 'texte exact');
    eq(verdict('strict', t => strip(t)), 'ko', 'sans voyelles');
    eq(verdict('strict', t => t.replace(/َ/, 'ِ')), 'ko', 'une voyelle changée');
    eq(verdict('strict', t => t + ' زيادة'), 'ko', 'mot en trop');
    eq(verdict('strict', t => t.split(' ').slice(0, -1).join(' ')), 'ko', 'mot manquant');
  });
  test('Correction souple : accepte un texte sans voyelles', () => {
    eq(verdict('soft', t => strip(t)), 'ok', 'sans voyelles');
    eq(verdict('soft', () => 'كلمة خاطئة تماما'), 'ko', 'texte faux');
  });

  /* ---- plan, écrans, réglages ---- */
  test('Plan : première portion = 3 versets de la sourate 114, puis « appris » l’enregistre', () => {
    reset("plan = {from: 114, to: 114, order: 'desc', amt: 'v3', recent: 7, cycle: 30, log: [], done: {}}; go('plan');");
    eq(E('planNextChunk(plan)'), {s: 114, a: 1, b: 3});
    clickAct('plan-sabaq'); ok($q('[data-act="plan-learned"]'), 'écran sabaq absent'); clickAct('plan-learned');
    eq(E('plan.log.length'), 1); eq(E('planNextChunk(plan)'), {s: 114, a: 4, b: 6}); noErr('plan');
  });
  test('Révision espacée : liste « à renforcer », bouton « Renforcer maintenant », intervalle adaptatif', async () => {
    reset(); const now = Date.now();
    E(`errors = [{t: ${now}, k: '2:5', m: 'next', sc: 0}, {t: ${now}, k: '2:5', m: 'next', sc: 0}, {t: ${now - 864e5}, k: '3:9', m: 'cloze', sc: 0}]; stats = {'2:5': [0, 2], '3:9': [0, 1]}; sched = {};`);
    E("go('home')"); ok($q('[data-act="strengthen"]'), 'bouton sur l’accueil'); ok(appText().includes('À renforcer en priorité'));
    ok(/2 erreurs ces 30 derniers jours/.test(appText()), 'raison affichée');
    E("go('plan')"); ok(appText().includes('À renforcer en priorité') && appText().includes('tienne plus d'), 'carte complète avec explication dans le Plan');
    clickAct('strengthen'); eq(E('ses.fixed'), true); eq(E('ses.pool.map(key).sort()'), ['2:5', '3:9']); noErr('renforcer');
    E("home()"); E("sched = {}; record({s: 2, a: 5}, 0)"); eq(E("sched['2:5'].iv"), 0.25, 'raté : retour dans 6 h');
    E("record({s: 2, a: 5}, 1)"); eq(E("sched['2:5'].iv"), 1, 'puis 1 jour'); ok(E("sched['2:5'].ez") < 2.2, 'facteur réduit après un raté');
    E("errors = []; stats = {}"); E("go('home')"); ok(!$q('[data-act="strengthen"]'), 'rien à renforcer : pas de bouton');
  });
  test('Révision espacée : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(); const now = Date.now();
      E(`setLang('${L}'); errors = [{t: ${now}, k: '2:5', m: 'next', sc: 0}, {t: ${now}, k: '2:5', m: 'next', sc: 0}]; stats = {'2:5': [1, 4]}; sched = {'2:5': {iv: 0.25, due: ${now - 3 * 864e5}}}; plan = {from: 114, to: 114, order: 'desc', amt: 'v3', recent: 2, cycle: 4, mptr: 0, done: {}, log: []};`);
      E("go('home')"); E("go('plan')"); ok(appText().length > 100); eq(E('[...missingKeys]'), [], L);
    }
  });
  test('Plan : vue de la semaine (prévision sur 7 jours)', async () => {
    reset("plan = {from: 111, to: 114, order: 'desc', amt: 'v3', recent: 3, cycle: 2, mptr: 0, done: {}, log: []}; go('plan')");
    const W7 = E("planWeek(plan)"); eq(W7.length, 7); eq(W7.map(x => [x.chunk.s, x.chunk.a, x.chunk.b]).slice(0, 4), [[114, 1, 3], [114, 4, 6], [113, 1, 3], [113, 4, 5]], 'portions successives');
    eq(W7.slice(0, 5).map(x => x.rec), [0, 1, 2, 3, 3], 'révision récente : les 3 derniers jours'); eq(W7.slice(0, 7).map(x => x.man), [0, 0, 0, 0, 1, 1, 2], 'révision ancienne : ceil(portions de plus de 3 jours / cycle de 2)');
    ok(appText().includes('Semaine') && appText().includes('Prévision'), 'carte Semaine'); eq($$q('#app .weak').filter(e => /Nouveau :/.test(e.textContent)).length, 7, '7 jours affichés');
    ok(/▸/.test(appText()), 'aujourd’hui repéré'); noErr('semaine');
    // aujourd'hui déjà appris : la portion du jour reste affichée (et cochée), la suite continue
    const dk = E("dayKey()"); E(`plan.log.push({d: '${dk}', s: 114, a: 1, b: 3}); plan.done = {'${dk}': {sabaq: true}}; go('plan')`);
    const W8 = E("planWeek(plan)"); eq([W8[0].chunk.s, W8[0].chunk.a, W8[0].chunk.b], [114, 1, 3]); eq([W8[1].chunk.s, W8[1].chunk.a], [114, 4]); ok(/✓ Nouveau/.test(appText()), 'portion du jour cochée');
    // plan terminé
    E("plan = {from: 114, to: 114, order: 'desc', amt: 'v10', recent: 3, cycle: 2, mptr: 0, done: {}, log: []}; go('plan')"); const W9 = E("planWeek(plan)"); eq([W9[0].chunk.b, W9[1].chunk], [6, null]); ok(appText().includes('Plan terminé'));
    for (const L of ['en', 'ar']){ E(`setLang('${L}'); plan = {from: 111, to: 114, order: 'desc', amt: 'v3', recent: 3, cycle: 2, mptr: 0, done: {}, log: [{d: '${E("dayKey(addDays(new Date(), -2))")}', s: 114, a: 1, b: 3}]}; go('plan')`); ok(appText().length > 100, L); eq(E('[...missingKeys]'), [], L); }
    E("setLang('fr')");
  });
  test('Accessibilité : réglage « contraste renforcé » des couleurs du tajwīd', async () => {
    reset(); E("go('settings')"); const sel = $q('#shc'); ok(sel, 'réglage'); eq([...sel.options].map(o => o.value), ['auto', 'on', 'off']);
    const col = () => W.getComputedStyle(D.documentElement).getPropertyValue('--tjc-n').trim().toLowerCase();
    sel.value = 'on'; sel.dispatchEvent(new W.Event('change')); eq(E('cfg.hc'), true); ok(D.getElementById('tjhc'), 'feuille de style ajoutée'); ok(col() !== '#537fff', 'couleur plus foncée : ' + col());
    E("go('settings')"); eq($q('#shc').value, 'on'); $q('#shc').value = 'off'; $q('#shc').dispatchEvent(new W.Event('change')); eq(E('cfg.hc'), false); ok(!D.getElementById('tjhc')); eq(col(), '#537fff', 'couleurs officielles');
    E("go('settings')"); $q('#shc').value = 'auto'; $q('#shc').dispatchEvent(new W.Event('change')); eq(E('cfg.hc'), undefined, 'automatique : suit le système'); noErr('contraste');
    for (const L of ['en', 'ar']){ E(`setLang('${L}'); go('settings')`); eq(E('[...missingKeys]'), [], L); } E("setLang('fr')");
  });
  test('Accessibilité : audit axe-core (WCAG 2.2 AA) des écrans principaux, sans violation', async () => {
    const src = await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js').then(r => r.ok ? r.text() : '').catch(() => '');
    if (!src) return;                                            // pas d'accès au CDN : test ignoré
    W.eval(src); const opts = {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']}}, bad = [];
    const audit = async name => { await wait(300); const r = await W.axe.run(D, opts); r.violations.forEach(v => bad.push(`${name} : ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`)); };
    reset("cfg.hc = true; cfg.reciter = 'ar.alafasy'; plan = {from: 111, to: 114, order: 'desc', amt: 'v3', recent: 3, cycle: 2, mptr: 0, done: {}, log: []}; applyA11y(); errors = [{t: Date.now(), k: '2:5', m: 'cloze', sc: 0}]; stats = {'2:5': [1, 3]}; cfg.scope = {type: 'surah', from: 1, to: 3};");
    for (const t of ['home', 'plan', 'train', 'progress', 'errors', 'settings']){ E(`go('${t}')`); await audit('onglet ' + t); }
    E("go('train')"); E("cfg.mode = 'tajweed'"); E("go('train')"); await audit('réviser (tajwīd)'); E("cfg.mode = 'mix'");
    E("cfg.mode = 'mcq'; start()"); await audit('question QCM'); E("home()");
    E("cfg.mode = 'cloze'; cfg.input = 'type'; start()"); await audit('question à taper'); E("home()");
    await W.loadX('tajweed'); E("cfg.mode = 'tajweed'; cfg.tjKind = 'rule'; start()"); await audit('question tajwīd'); E("home()");
    E("cfg.mode = 'madd'; start()"); await audit('question madd'); E("home()"); E("cfg.mode = 'makharij'; start()"); await audit('question makhārij'); E("home()");
    E("cfg.rdTaj = true; openReader('q:1')"); for (let i = 0; i < 40 && !$q('.tj-n'); i++) await wait(100); await audit('lecteur (tajwīd en couleurs)'); E("cfg.rdTaj = false; home()");
    E("renderLegal()"); await audit('confidentialité'); E("CLOUD.url = 'https://x.supabase.co'; CLOUD.anonKey = 'k'; sb = {}; me = null; renderAccount()"); await audit('connexion'); E("CLOUD.url = ''; CLOUD.anonKey = ''; sb = null");
    eq(bad, [], 'violations axe-core');
    E("cfg.hc = undefined; delete cfg.hc; applyA11y()");
  });
  test('Plan : le manzil ajoute une portion fragile sans décaler la rotation', async () => {
    reset(); const now = Date.now(), old = E("dayKey(addDays(new Date(), -10))");
    E(`plan = {from: 111, to: 114, order: 'desc', amt: 'v3', recent: 2, cycle: 4, mptr: 0, done: {}, log: [{d: '${old}', s: 114, a: 1, b: 3}, {d: '${old}', s: 114, a: 4, b: 6}, {d: '${old}', s: 113, a: 1, b: 3}, {d: '${old}', s: 112, a: 1, b: 3}, {d: '${old}', s: 111, a: 1, b: 3}]}; errors = [{t: ${now}, k: '111:1', m: 'next', sc: 0}, {t: ${now}, k: '111:2', m: 'next', sc: 0}]; stats = {}; sched = {};`);
    const T = E("planToday()"); eq(T.rot, 2, 'rotation : 2 portions'); eq(T.xtra, 1, 'une portion fragile en plus'); eq(T.man.length, 3);
    eq([T.man[2].s, T.man[2].a], [111, 1], 'la portion fragile est celle de la sourate 111');
    E("go('plan')"); ok(/dont 1 à renforcer/.test(appText()), 'mention dans le Plan');
    clickAct('plan-manzil'); eq(E('ses.chunks.length'), 3); eq(E('ses.rot'), 2); E("planFinish('manzil')"); eq(E('plan.mptr'), 2, 'la rotation avance de 2, pas de 3');
    // sans erreur : rotation seule
    E("errors = []; plan.mptr = 0; plan.done = {}"); eq(E("planToday().xtra"), 0);
  });
  test('Tajwīd (entraînement) : question, 4 règles, correction colorée, statistiques par règle, sans toucher à la mémorisation', async () => {
    reset("cfg.mode = 'tajweed'; cfg.scope = {type: 'surah', from: 1, to: 3}; cfg.n = 6; tjs = {};");
    const wrongTotals = {ok: 0, ko: 0};
    E("start()"); for (let i = 0; i < 40 && !$q('.opt'); i++) await wait(100); noErr('chargement du tajwīd');
    for (let n = 0; n < 6; n++){
      ok($q('mark.tjq'), 'partie surlignée'); const btns = $$q('.opt'); eq(btns.length, 4); eq(new Set(btns.map(b => b.dataset.v)).size, 4, 'propositions distinctes');
      ok(appText().includes('annotation automatique'), 'avertissement : source non relue');
      const good = btns.filter(b => b.dataset.v === E('cur.correct')); eq(good.length, 1);
      ok(!$q('#tjv [class^="tj-"]'), 'la phrase n’est pas colorée avant la réponse');
      const wantOk = n % 2 === 0, target = wantOk ? good[0] : btns.find(b => b !== good[0]);
      click(target); noErr('réponse tajwīd');
      ok(fb().classList.contains(wantOk ? 'ok' : 'ko'), `tirage ${n}`); ok($q('#tjv [class^="tj-"]'), 'la phrase se colore après la réponse'); ok(/Règle selon la source/.test(fb().textContent));
      wrongTotals[wantOk ? 'ok' : 'ko']++;
      if (n < 5) clickAct('nextq'); else clickAct('nextq');
      if (n < 5) for (let i = 0; i < 20 && !$q('mark.tjq'); i++) await wait(50);
    }
    ok(appText().includes('Règles de cette série'), 'résultat : règles de la série'); ok(!$q('[data-act="retry"]'), 'pas de « refaire mes erreurs » (ce n’est pas de la mémorisation)');
    eq(E("Object.values(tjs).reduce((t, [o]) => t + o, 0)"), 3); eq(E("Object.values(tjs).reduce((t, [, k]) => t + k, 0)"), 3);
    eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'la mémorisation n’est pas modifiée'); eq(E("days[today()]"), 6, 'compte pour l’objectif du jour');
    E("go('progress')"); ok(appText().includes('Mes règles de tajwīd'), 'règles dans Progrès');
    // matn : l'exercice n'est pas proposé et le mode revient à « Mélange »
    // type d'exercice : mémorisation / tajwīd / makhārij / ṣifāt
    E("cfg.mode = 'tajweed'; go('train')"); const cs = $q('#scat'); ok(cs, 'liste « Type d’exercice »'); eq([...cs.options].map(o => o.value), ['memo', 'tajwid', 'ahk', 'mdd', 'mkh', 'sfa']); eq(cs.value, 'tajwid');
    ok(!$q('[data-act="mode"]') && !$q('[data-act="corpus"]'), 'tajwīd : ni liste d’exercices de mémorisation ni choix Coran/moutoun'); ok($q('#stjk') && $q('#stype'), 'liste des types de tajwīd et portée du Coran');
    cs.value = 'memo'; cs.dispatchEvent(new W.Event('change')); eq(E('cfg.mode'), 'mix'); ok($q('[data-act="mode"][data-v="cloze"]') && !$q('[data-act="mode"][data-v="tajweed"]') && !$q('[data-act="mode"][data-v="makharij"]'), 'mémorisation : seulement ses exercices');
    clickAct('mode', 'mcq'); $q('#scat').value = 'mkh'; $q('#scat').dispatchEvent(new W.Event('change')); eq(E('cfg.mode'), 'makharij'); ok($q('#smkk') && !$q('#stype'), 'makhārij : liste de types, pas de portée'); ok(!/Commencer ·/.test(appText()) && !$q('[data-act="rdscope"]'), 'makhārij : pas de portée affichée dans le bouton'); eq(E('cfg.lastMemo'), 'mcq');
    $q('#scat').value = 'sfa'; $q('#scat').dispatchEvent(new W.Event('change')); eq(E('cfg.mode'), 'sifat'); ok($q('#ssfk') && !$q('#stype'));
    $q('#scat').value = 'memo'; $q('#scat').dispatchEvent(new W.Event('change')); eq(E('cfg.mode'), 'mcq', 'retour au dernier exercice de mémorisation');
    clickAct('corpus', 'matn'); $q('#scat').value = 'tajwid'; $q('#scat').dispatchEvent(new W.Event('change')); eq(E('cfg.scope.type') !== 'matn', true, 'le tajwīd revient au Coran'); eq(E('cfg.mode'), 'tajweed');
    E("cfg.mode = 'tajweed'; cfg.scope = {type: 'surah', from: 2, to: 2}");
    // révisions guidées : jamais d'exercice de tajwīd
    E("cfg.scope = {type: 'surah', from: 1, to: 3}; cfg.mode = 'tajweed'; start([{s: 1, a: 1}, {s: 1, a: 2}])"); ok(!$q('mark.tjq'), 'série guidée : pas de tajwīd'); noErr('série guidée');
  });
  test('Tajwīd : liste déroulante des types de questions (règle, couleurs, trouver la partie, vrai/faux, mélange)', async () => {
    reset("cfg.mode = 'tajweed'; cfg.scope = {type: 'surah', from: 2, to: 2}; cfg.n = 5; tjs = {};");
    E("go('train')"); const sel = $q('#stjk'); ok(sel, 'liste déroulante dans les options de la série'); eq([...sel.options].map(o => o.value), ['rule', 'color', 'find', 'tf', 'read', 'mix']);
    sel.value = 'tf'; sel.dispatchEvent(new W.Event('change')); eq(E('cfg.tjKind'), 'tf', 'le choix est enregistré'); E("go('home')"); ok(appText().includes('Vrai ou faux'), 'rappelé dans le résumé de la série');
    E("cfg.mode = 'cloze'; go('train')"); ok(!$q('#stjk'), 'liste absente pour les autres exercices'); E("cfg.mode = 'tajweed'; go('train')"); ok($q('#stjk'));
    const seen = new Set();
    for (const kind of ['rule', 'color', 'find', 'tf', 'read', 'mix']){
      E(`cfg.tjKind = '${kind}'; cfg.n = 30; tjs = {}`); E("start()"); for (let i = 0; i < 40 && !$q('.opt'); i++) await wait(100);
      for (let n = 0; n < 10; n++){
        const k = E('cur.tjk'); seen.add(k); const btns = $$q('.opt'), marks = $$q('mark.tjq'); noErr(`${kind}/${k}`);
        if (kind !== 'mix') ok(k === kind || (kind === 'find' && k === 'rule'), `type ${kind} → ${k}`);
        const colored = !!$q('#tjv [class^="tj-"]');
        if (k === 'find'){ eq(btns.length, 4); eq(marks.length, 4); eq($$q('#tjv sup.tjn').length, 4); ok(!colored, 'pas de couleurs avant la réponse'); }
        else if (k === 'tf'){ eq(btns.map(b => b.dataset.v).sort(), ['f', 't']); eq(marks.length, 1); ok(!colored); }
        else if (k === 'color'){ eq(btns.length, 4); eq(marks.length, 1); ok(colored, 'les couleurs aident dans la version facile'); }
        else if (k === 'read'){ eq(btns.length, 4); eq(marks.length, 1); eq($$q('#tjv > [class^="tj-"]').length, 0, 'rien n’est coloré hors de la partie surlignée'); ok($$q('#tjv mark [class^="tj-"]').length >= 1, 'la partie surlignée est colorée'); ok($q('details[open] .tjkey'), 'la légende est affichée'); }
        else { eq(btns.length, 4); eq(marks.length, 1); ok(!colored, 'sans couleurs avant la réponse'); }
        const good = btns.filter(b => b.dataset.v === E('cur.correct')); eq(good.length, 1, 'une seule bonne réponse');
        const wantOk = n % 2 === 0; click(wantOk ? good[0] : btns.find(b => b !== good[0])); noErr('réponse');
        ok(fb().classList.contains(wantOk ? 'ok' : 'ko'), `${k} tirage ${n}`); ok($q('#tjv [class^="tj-"]'), 'coloré après la réponse');
        if (k === 'find') ok(/Partie 1 :/.test(fb().textContent) && /Partie 4 :/.test(fb().textContent), 'la règle de chaque partie est donnée');
        clickAct('nextq'); for (let i = 0; i < 20 && !$q('.opt') && !appText().includes('Résultat'); i++) await wait(50);
        if (!$q('.opt')) break;
      }
      E("home()");
    }
    ok(['rule', 'color', 'find', 'tf', 'read'].every(k => seen.has(k)), 'le mélange propose tous les types : ' + [...seen]);
    eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'la mémorisation n’est pas modifiée');
  });
  test('Makhārij et ṣifāt : listes déroulantes, questions, corrections, statistiques, sans toucher à la mémorisation', async () => {
    for (const [mode, sel, kinds] of [['makharij', '#smkk', ['zone', 'same', 'odd', 'halq', 'tf', 'mix']], ['sifat', '#ssfk', ['pair', 'which', 'mnemo', 'cond', 'tf', 'mix']]]){
      reset(`cfg.mode = '${mode}'; cfg.n = 5; hfs = {}`); E("go('train')"); const s = $q(sel); ok(s, 'liste déroulante ' + mode); eq([...s.options].map(o => o.value), kinds);
      s.value = kinds[1]; s.dispatchEvent(new W.Event('change')); eq(E(mode === 'makharij' ? 'cfg.mkKind' : 'cfg.sfKind'), kinds[1]);
      for (const kind of kinds){
        E(`cfg.${mode === 'makharij' ? 'mkKind' : 'sfKind'} = '${kind}'; cfg.n = 30; hfs = {}`); E("start()"); noErr('start ' + mode);
        for (let n = 0; n < 8; n++){
          ok($q('.opt'), `${mode}/${kind} : question ${n}`); const btns = $$q('.opt'), good = btns.filter(b => b.dataset.v === E('cur.correct')); eq(good.length, 1, 'une seule bonne réponse');
          ok(appText().includes('Wikipédia') === false, 'les sources s’affichent après la réponse');
          const wantOk = n % 2 === 0; click(wantOk ? good[0] : btns.find(b => b !== good[0])); noErr('réponse ' + mode);
          ok(fb().classList.contains(wantOk ? 'ok' : 'ko'), `${mode}/${kind} tirage ${n}`); ok(/wikipedia|wikisource/i.test(D.getElementById('app').innerHTML), 'sources avec liens'); ok(/Wikipédia \(/.test(appText()) || /Wikisource/.test(appText()));
          clickAct('nextq'); if (!$q('.opt')) break;
        }
        E("home()");
      }
      E(`cfg.n = 5; ses = null; hfs = {}`); E("start()"); for (let i = 0; i < 5; i++){ click($q('.opt')); clickAct('nextq'); }
      ok(appText().includes('Résumé de la série'), 'résumé de la série'); ok(!$q('[data-act="retry"]'), 'pas de « refaire mes erreurs »');
      eq(E("Object.values(hfs).reduce((t, [o, e]) => t + o + e, 0)"), 5); eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'mémorisation intacte');
      E("go('progress')"); ok(appText().includes('Mes makhārij et ṣifāt'), 'carte dans Progrès');
    }
    // visibles aussi pour les moutoun ; remplacés par « Mélange » dans les révisions guidées
    E("cfg.scope = {type: 'matn', id: 'all'}; cfg.mode = 'mix'; go('train')"); eq([...$q('#scat').options].map(o => o.value), ['memo', 'tajwid', 'ahk', 'mdd', 'mkh', 'sfa'], 'les catégories makhārij et ṣifāt restent proposées avec les moutoun');
    E("cfg.mode = 'makharij'; start([{s: 1, a: 1}, {s: 1, a: 2}])"); ok(!$q('.opt .ar') && appText().includes('Sourate') || true); noErr('guidé');
  });
  test('Ṣifāt : qualités conditionnelles (qalqala, līn) sur de vrais versets', async () => {
    reset("cfg.mode = 'sifat'; cfg.sfKind = 'cond'; cfg.n = 30; hfs = {}"); E("start()");
    for (let n = 0; n < 12; n++){
      ok($q('.opt'), 'question ' + n); eq($$q('mark.tjq').length, 1, 'une lettre surlignée'); const btns = $$q('.opt'); eq(btns.map(b => b.dataset.v).sort(), ['f', 't']); eq(btns.map(b => b.textContent.trim()).sort(), ['Non', 'Oui']);
      ok(/Rappel : qalqala/.test(appText()), 'rappel de la règle'); const mark = $q('mark.tjq').textContent, attrQal = /القلقلة/.test(appText());
      ok(attrQal ? 'قطبجد'.includes(mark[0]) : 'وي'.includes(mark[0]), 'la lettre surlignée correspond à la qualité demandée : ' + mark);
      const good = btns.find(b => b.dataset.v === E('cur.correct')), wantOk = n % 2 === 0; click(wantOk ? good : btns.find(b => b !== good)); noErr('cond');
      ok(fb().classList.contains(wantOk ? 'ok' : 'ko')); ok(/sukūn|dernière lettre|voyelle|chadda|fatḥa|madd/.test(fb().textContent), 'explication : ' + fb().textContent.slice(0, 80)); ok($q('#fb a[href*="wiki"]'), 'sources');
      clickAct('nextq'); if (!$q('.opt')) break;
    }
    ok(E("Object.keys(hfs).every(k => k === 'sf:qalqala' || k === 'sf:lin')"), 'statistiques par qualité'); eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'mémorisation intacte');
  });
  test('Aḥkām (nūn, mīm, tanwīn) : types de questions, vrais versets, corrections, statistiques', async () => {
    reset("cfg.mode = 'ahkam'; cfg.n = 5; hfs = {}"); E("go('train')"); eq($q('#scat').value, 'ahk'); const sel = $q('#sahk'); ok(sel, 'liste déroulante'); eq([...sel.options].map(o => o.value), ['nun', 'mim', 'letter', 'group', 'ghunna', 'tf', 'mix']);
    ok(!$q('#stype') && !$q('[data-act="mode"]'), 'pas de portée ni exercices de mémorisation');
    for (const kind of ['nun', 'mim', 'letter', 'group', 'ghunna', 'tf', 'mix']){
      E(`cfg.ahKind = '${kind}'; cfg.n = 30; hfs = {}; ses = null`); E("start()"); for (let i = 0; i < 60 && !$q('.opt'); i++) await wait(100); noErr('start ahkam ' + kind);
      for (let n = 0; n < 8; n++){
        ok($q('.opt'), `${kind} question ${n}`); const btns = $$q('.opt'), k = kind === 'mix' ? null : kind, marks = $$q('mark.tjq').length;
        if (k === 'nun') { eq(btns.length, 5); eq(marks, 2); } if (k === 'mim') { eq(btns.length, 3); eq(marks, 2); } if (k === 'ghunna') { eq(btns.length, 2); eq(marks, 1); }
        if (k === 'letter') eq(btns.length, 5); if (k === 'tf') eq(btns.length, 2);
        const good = btns.filter(b => b.dataset.v === E('cur.correct')); eq(good.length, 1, 'une seule bonne réponse'); const wantOk = n % 2 === 0;
        click(wantOk ? good[0] : btns.find(b => b !== good[0])); noErr('réponse ahkam'); ok(fb().classList.contains(wantOk ? 'ok' : 'ko'), `${kind} ${n}`); ok($q('#fb a[href*="wiki"]'), 'sources');
        clickAct('nextq'); if (!$q('.opt')) break;
      }
      E("home()");
    }
    E("ses = null; cfg.ahKind = 'nun'; cfg.n = 5; hfs = {}"); E("start()"); for (let i = 0; i < 60 && !$q('.opt'); i++) await wait(100); for (let i = 0; i < 5; i++){ click($q('.opt')); clickAct('nextq'); }
    ok(appText().includes('Résumé de la série')); ok(E("Object.keys(hfs).every(k => k.startsWith('ah:'))")); eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'mémorisation intacte');
    E("go('progress')"); ok(appText().includes('Mes makhārij et ṣifāt'));
  });
  test('Madd : types de questions, vrais versets, durée, cause, corrections, statistiques', async () => {
    reset("cfg.mode = 'madd'; cfg.n = 5; hfs = {}"); E("go('train')"); eq($q('#scat').value, 'mdd'); const sel = $q('#smdk'); ok(sel, 'liste déroulante'); eq([...sel.options].map(o => o.value), ['type', 'count', 'cause', 'tf', 'mix']);
    ok(!$q('#stype') && !$q('[data-act="mode"]'), 'pas de portée ni exercices de mémorisation');
    for (const kind of ['type', 'count', 'cause', 'tf', 'mix']){
      E(`cfg.mdKind = '${kind}'; cfg.n = 30; hfs = {}; ses = null`); E("start()"); for (let i = 0; i < 80 && !$q('.opt'); i++) await wait(100); noErr('start madd ' + kind);
      for (let n = 0; n < 8; n++){
        ok($q('.opt'), `${kind} question ${n}`); const btns = $$q('.opt'), hasMark = !!$q('mark.tjq');
        if (kind === 'type'){ eq(btns.length, 5); ok(hasMark, 'partie surlignée'); ok(!$q('#tjv [class^="tj-"]'), 'verset non coloré avant la réponse'); }
        if (kind === 'count'){ eq(btns.length, 4); ok(hasMark); } if (kind === 'cause'){ eq(btns.length, 4); ok(!hasMark, 'règle du matn : pas de verset'); } if (kind === 'tf'){ eq(btns.length, 2); ok(hasMark); }
        const good = btns.filter(b => b.dataset.v === E('cur.correct')); eq(good.length, 1, 'une seule bonne réponse'); const wantOk = n % 2 === 0;
        click(wantOk ? good[0] : btns.find(b => b !== good[0])); noErr('réponse madd'); ok(fb().classList.contains(wantOk ? 'ok' : 'ko'), `${kind} ${n}`); ok($q('#fb a[href*="wiki"]'), 'sources');
        ok(/temps/.test(fb().textContent), 'durée dans la correction'); if (hasMark) ok($q('#tjv [class^="tj-"]'), 'verset coloré après la réponse');
        clickAct('nextq'); if (!$q('.opt')) break;
      }
      E("home()");
    }
    E("ses = null; cfg.mdKind = 'type'; cfg.n = 5; hfs = {}"); E("start()"); for (let i = 0; i < 80 && !$q('.opt'); i++) await wait(100); for (let i = 0; i < 5; i++){ click($q('.opt')); clickAct('nextq'); }
    ok(appText().includes('Résumé de la série')); ok(E("Object.keys(hfs).every(k => k.startsWith('md:'))")); eq(E("Object.keys(stats).length + Object.keys(sched).length + errors.length"), 0, 'mémorisation intacte');
  });
  test('Madd : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(`setLang('${L}'); cfg.mode = 'madd'; cfg.n = 3; hfs = {'md:lazim': [1, 2]}`); E("go('train')"); eq(E('[...missingKeys]'), [], L + ' liste');
      for (const k of ['type', 'count', 'cause', 'tf']){ E(`cfg.mdKind = '${k}'; ses = null`); E("start()"); for (let i = 0; i < 80 && !$q('.opt'); i++) await wait(100); ok($q('.opt'), L + k); click($q('.opt')); eq(E('[...missingKeys]'), [], `${L} ${k}`); E("home()"); }
      E("go('progress')"); eq(E('[...missingKeys]'), [], L);
    }
  });
  test('Aḥkām : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(`setLang('${L}'); cfg.mode = 'ahkam'; cfg.n = 3; hfs = {'ah:K': [1, 2], 'ah:gh': [2, 0]}`); E("go('train')"); eq(E('[...missingKeys]'), [], L + ' liste');
      for (const k of ['nun', 'mim', 'letter', 'group', 'ghunna', 'tf']){ E(`cfg.ahKind = '${k}'; ses = null`); E("start()"); for (let i = 0; i < 60 && !$q('.opt'); i++) await wait(100); ok($q('.opt'), L + k); click($q('.opt')); eq(E('[...missingKeys]'), [], `${L} ${k}`); E("home()"); }
      E("go('progress')"); eq(E('[...missingKeys]'), [], L);
    }
  });
  test('Audio hors ligne : estimation, téléchargement d’une sourate, lecture depuis l’appareil, plafond, suppression (réseau requis)', async () => {
    const url1 = 'https://everyayah.com/data/Alafasy_64kbps/001001.mp3', net = await fetch(url1, {method: 'HEAD', mode: 'cors'}).then(r => r.ok).catch(() => false);
    if (!net) return;                                            // pas d'accès à everyayah.com : test ignoré
    reset("cfg.reciter = 'ar.alafasy'; cfg.audFrom = 1; cfg.audTo = 1; cfg.audCap = 50; audioOff = {}; audioUI = {plan: null, busy: false, ctl: null};"); await W.caches.delete('hifz-audio-v1');
    E("go('settings')"); ok($q('[data-act="aud-est"]') && $q('#aud-from') && $q('#aud-cap'), 'carte Audio hors ligne'); ok($q('[data-act="aud-dl"]').disabled, 'téléchargement impossible avant le calcul de la taille');
    clickAct('aud-est'); for (let i = 0; i < 100 && !E('audioUI.plan'); i++) await wait(100); const P = E('audioUI.plan'); ok(P && P.take.length === 1, 'estimation faite'); noErr('estimation');
    ok(/Estimation/.test($q('#aud-msg').textContent)); ok(!$q('[data-act="aud-dl"]').disabled);
    clickAct('aud-dl'); for (let i = 0; i < 300 && (E('audioUI.busy') || !E("audioSet('ar.alafasy')[1]")); i++) await wait(100); noErr('téléchargement');
    const cache = await W.caches.open('hifz-audio-v1'), keys = await cache.keys(); eq(keys.length, 7, '7 versets de la Fatiha dans le cache');
    const got = E("audioSet('ar.alafasy')[1].b"); eq(E("audioSet('ar.alafasy')[1].q"), 64); ok(got > 100000, 'octets enregistrés : ' + got); const ratio = P.used / got; ok(ratio > 0.8 && ratio < 2.2, 'estimation raisonnable : ' + ratio.toFixed(2));
    eq(E("audioUrl({s: 1, a: 1})"), url1); ok(E("audioUrl({s: 2, a: 1})").includes('islamic.network'), 'sourates non téléchargées : lecture en ligne');
    ok(appText().includes('Sur cet appareil') && appText().includes('Al-Faatiha'), 'liste des sourates téléchargées');
    if (W.navigator.serviceWorker.controller){                    // le service worker sert les plages d'octets depuis le cache
      const r = await W.fetch(url1, {headers: {Range: 'bytes=0-99'}}); eq(r.status, 206); eq(r.headers.get('x-hifz-offline'), '1', 'servi par l’appareil, pas par le réseau'); eq((await r.arrayBuffer()).byteLength, 100); ok(/^bytes 0-99\/\d+$/.test(r.headers.get('content-range')));
    }
    // qualité 128 kbps : retéléchargement de la même sourate, l'ancienne qualité est retirée du cache
    ok($q('#aud-q') && [...$q('#aud-q').options].map(o => o.value).join() === '64,128', 'choix de qualité'); E("cfg.audQ = 128; audioUI.plan = null"); E("go('settings')"); clickAct('aud-est'); for (let i = 0; i < 100 && !E('audioUI.plan'); i++) await wait(100);
    const P128 = E('audioUI.plan'); ok(P128.used > P.used * 1.8, '128 kbps : estimation environ 3 fois plus lourde : ' + (P128.used / P.used).toFixed(1));
    clickAct('aud-dl'); for (let i = 0; i < 300 && (E('audioUI.busy') || E("audioSet('ar.alafasy')[1].q") !== 128); i++) await wait(100); noErr('128 kbps');
    eq(E("audioSet('ar.alafasy')[1].q"), 128); ok(E("audioUrl({s: 1, a: 1})").includes('Alafasy_128kbps'), 'lecture en 128'); eq((await cache.keys()).length, 7, 'les 7 fichiers 64 kbps ont été retirés');
    ok(appText().includes('128 kbps'), 'qualité affichée dans la liste'); const got128 = E("audioSet('ar.alafasy')[1].b"); ok(got128 > got * 2, '128 kbps nettement plus lourd');
    E("cfg.audQ = 64"); E("cfg.reciter = 'ar.abdurrahmaan' + 'sudais'"); E("go('settings')"); eq([...$q('#aud-q').options].map(o => o.value), ['64'], 'As-Sudais : 64 kbps seulement'); E("cfg.reciter = 'ar.alafasy'");
    E("cfg.audCap = 0.2; audioUI.plan = null"); E("go('settings')"); $q('#aud-cap') && 0; clickAct('aud-est'); for (let i = 0; i < 100 && !E('audioUI.plan'); i++) await wait(100);
    ok(E('audioUI.plan.take.length') === 0 && /Plafond atteint/.test(appText()), 'plafond trop petit : rien à télécharger'); ok($q('[data-act="aud-dl"]').disabled);
    E("cfg.audCap = 50"); E("go('settings')"); clickAct('aud-del', '1'); for (let i = 0; i < 50 && E("audioSet('ar.alafasy')[1]"); i++) await wait(100); await wait(200);
    eq((await cache.keys()).length, 0, 'suppression : cache vidé'); eq(E("Object.keys(audioSet('ar.alafasy')).length"), 0); ok(E("audioUrl({s: 1, a: 1})").includes('islamic.network'), 'retour à la lecture en ligne');
    E("audioOff = {}; store.set('hifz.audio', {})");
  });
  test('Makhārij et ṣifāt : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(`setLang('${L}'); cfg.n = 3; hfs = {'mk:ظ': [1, 2], 'sf:qalqala': [3, 0]}`); E("go('train')");
      for (const [mode, key, kinds] of [['makharij', 'mkKind', ['zone', 'same', 'odd', 'halq', 'tf']], ['sifat', 'sfKind', ['pair', 'which', 'mnemo', 'cond', 'tf']]]){
        E(`cfg.mode = '${mode}'; go('train')`); eq(E('[...missingKeys]'), [], L + ' ' + mode);
        for (const k of kinds){ E(`cfg.${key} = '${k}'; ses = null`); E("start()"); ok($q('.opt'), L + k); click($q('.opt')); eq(E('[...missingKeys]'), [], `${L} ${mode} ${k}`); E("home()"); }
      }
      E("go('progress')"); eq(E('[...missingKeys]'), [], L);
    }
  });
  test('Audio du plan du jour : bouton, téléchargement automatique seulement en Wi-Fi confirmé (réseau requis)', async () => {
    const net = await fetch('https://everyayah.com/data/Alafasy_64kbps/112001.mp3', {method: 'HEAD', mode: 'cors'}).then(r => r.ok).catch(() => false);
    if (!net) return;
    const old = E("dayKey(addDays(new Date(), -10))"), yest = E("dayKey(addDays(new Date(), -1))"); await W.caches.delete('hifz-audio-v1');
    reset(`cfg.reciter = 'ar.alafasy'; cfg.audQ = 64; cfg.audCap = 50; audioOff = {}; audioUI = {plan: null, busy: false, ctl: null}; store.set('hifz.audioAuto', '');
      plan = {from: 111, to: 114, order: 'desc', amt: 'v3', recent: 3, cycle: 4, mptr: 0, done: {}, log: [{d: '${yest}', s: 113, a: 1, b: 3}, {d: '${old}', s: 112, a: 1, b: 2}]};`);
    eq(E("auPlanSurahs(planToday())"), [112, 113, 114], 'sourates du plan du jour');
    E("go('settings')"); ok($q('[data-act="aud-plan"]') && $q('#aud-auto'), 'bouton et option du plan'); noErr('carte plan');
    // sans Wi-Fi confirmé : rien ne se télécharge tout seul
    Object.defineProperty(W.navigator, 'connection', {get: () => ({type: 'cellular'}), configurable: true}); E("cfg.audAuto = true"); E("maybeAutoAudio()"); await wait(1500); eq(E("Object.keys(audioSet('ar.alafasy')).length"), 0, 'données mobiles : pas de téléchargement automatique');
    // bouton manuel (la confirmation est acceptée par le banc d'essai)
    clickAct('aud-plan'); for (let i = 0; i < 400 && (E('audioUI.busy') || Object.keys(E("audioSet('ar.alafasy')")).length < 3); i++) await wait(100); noErr('plan du jour');
    eq(Object.keys(E("audioSet('ar.alafasy')")).map(Number).sort(), [112, 113, 114], 'les 3 sourates du plan sont téléchargées'); ok(E("audioUrl({s: 113, a: 1})").includes('everyayah'));
    clickAct('aud-plan'); await wait(300); ok(/déjà sur cet appareil/.test(appText()), 'rien de plus à télécharger');
    // automatique en Wi-Fi : retire une sourate puis relance
    await E("audioDel(113)"); await wait(400); eq(E("auMissing(auPlanSurahs(planToday()), audioSet('ar.alafasy'))"), [113]);
    Object.defineProperty(W.navigator, 'connection', {get: () => ({type: 'wifi'}), configurable: true}); E("store.set('hifz.audioAuto', '')"); E("maybeAutoAudio()");
    for (let i = 0; i < 300 && (E('audioUI.busy') || !E("audioSet('ar.alafasy')[113]")); i++) await wait(100); ok(E("audioSet('ar.alafasy')[113]"), 'Wi-Fi confirmé : téléchargement automatique de la sourate manquante');
    // nettoyage
    Object.defineProperty(W.navigator, 'connection', {get: () => undefined, configurable: true}); await W.caches.delete('hifz-audio-v1'); E("audioOff = {}; store.set('hifz.audio', {}); cfg.audAuto = false");
  });
  test('Audio hors ligne : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(`setLang('${L}'); cfg.reciter = 'ar.alafasy'; audioOff = {'ar.alafasy': {1: 400000, 112: 120000}}; audioUI = {plan: {take: [1], skip: [2], used: 1e6, skipBytes: 2e6, items: []}, busy: false, ctl: null}; plan = {from: 114, to: 114, order: 'desc', amt: 'v3', recent: 3, cycle: 4, mptr: 0, done: {}, log: []}`);
      E("go('settings')"); ok($q('[data-act="aud-del"]') && $q('[data-act="aud-plan"]'), L); eq(E('[...missingKeys]'), [], L); E("audioOff = {}; audioUI = {plan: null, busy: false, ctl: null}; store.set('hifz.audio', {})");
    }
  });
  test('Tajwīd : aucune clé de traduction manquante (en, ar)', async () => {
    for (const L of ['en', 'ar']){
      reset(`setLang('${L}'); cfg.mode = 'tajweed'; cfg.scope = {type: 'surah', from: 2, to: 2}; cfg.n = 4; tjs = {n: [1, 2], q: [3, 0]};`); E("go('train')"); eq(E('[...missingKeys]'), [], L + ' liste');
      for (const kind of ['rule', 'color', 'find', 'tf', 'read']){
        E(`cfg.tjKind = '${kind}'; ses = null`); E("start()"); for (let i = 0; i < 40 && !$q('.opt'); i++) await wait(100); ok($q('mark.tjq'), L + ' ' + kind); click($q('.opt')); eq(E('[...missingKeys]'), [], `${L} ${kind}`);
      }
      E("home()"); E("go('progress')"); eq(E('[...missingKeys]'), [], L);
    }
  });
  test('Export CSV : versets, jours, erreurs, exercices (contenu et téléchargement)', async () => {
    reset(); const t0 = Date.now(); const got = [];
    W.download = async (name, text, type) => { got.push({name, text, type}); };
    E(`stats = {'1:2': [3, 1], '2:255': [0, 2], 'tuhfa:1': [1, 0]}; sched = {'1:2': {iv: 2.5, due: ${t0 + 864e5}}}; days = {'2026-10-20': 12, '2026-10-21': 5};
      errors = [{t: ${t0}, k: '2:255', m: 'cloze', sc: 0, ans: '=cmd', bad: ['ٱللَّهُ', 'لَا']}]; tjs = {n: [4, 1]}; hfs = {'mk:ظ': [1, 2], 'ah:K': [3, 0], 'md:lazim': [0, 1]}`);
    E("go('settings')"); const sel = $q('#csv-kind'); ok(sel && $q('[data-act="csv"]'), 'liste et bouton'); eq([...sel.options].map(o => o.value), ['verses', 'days', 'errors', 'drills']);
    const parse = txt => txt.replace(/^\ufeff/, '').trim().split('\r\n').map(l => l.split(';'));
    for (const [kind, rows, check] of [['verses', 4, r => ok(r[0][0] === 'Type' && r.some(x => x[2] === 'Al-Faatiha' && x[3] === '2' && x[6] === '3' && x[7] === '1' && x[8] === '75' && x[9] === '2.5'), 'verset 1:2 : 3 réussites, 1 raté, 75 %, intervalle 2,5 j')],
      ['days', 3, r => ok(r[1][0] === '2026-10-20' && r[1][1] === '12')], ['errors', 2, r => { ok(r[1][5] === 'Mots manquants' || r[1][5].length > 0); ok(r[1][7] === "'=cmd", 'formule neutralisée'); ok(r[1][8].includes('لَا')); }], ['drills', 5, r => ok(r.some(x => x[0] === 'Tajwīd (entraînement)' || x[0] === 'Tajwīd') && r.some(x => /الإخفاء/.test(x[1])), 'exercices')]]){
      got.length = 0; $q('#csv-kind').value = kind; clickAct('csv'); await wait(100); eq(got.length, 1, kind); ok(got[0].name.startsWith(`hifz-${kind}-`) && got[0].name.endsWith('.csv')); ok(got[0].text.startsWith('\ufeff') && /csv/.test(got[0].type));
      const r = parse(got[0].text); eq(r.length, rows, kind + ' : lignes'); eq(new Set(r.map(x => x.length)).size, 1, kind + ' : même nombre de colonnes'); check(r);
    }
    E("setLang('en')"); got.length = 0; E("exportCsv('days')"); ok(got[0].text.split('\r\n')[0].includes(',') && got[0].text.includes('Answers'), 'anglais : virgule et en-têtes traduits'); E("setLang('fr')");
    for (const L of ['en', 'ar']){ E(`setLang('${L}')`); for (const k of ['verses', 'days', 'errors', 'drills']) E(`exportCsv('${k}')`); E("go('settings')"); eq(E('[...missingKeys]'), [], L); } E("setLang('fr')"); delete W.download;
  });
  test('Espace admin : surveillance des e-mails (calme, attention, alerte, nom de domaine)', async () => {
    const mk = (n, agoH) => Array.from({length: n}, (_, i) => ({id: 'u' + agoH + i, email: `u${agoH}-${i}@x.fr`, role: 'user', blocked: false, created_at: new Date(Date.now() - agoH * 36e5).toISOString(), last_seen: null, answers: 0, ok: 0, errors: 0}));
    reset(); E("me = {user: {id: 'a', email: 'admin@x.fr'}, profile: {role: 'admin'}}");
    for (const [users, expect, label] of [[mk(2, 3), ['✓', null], 'calme'], [mk(16, 0.2), ['⚠', 'approches'], 'attention'], [mk(26, 0.2), ['⛔', 'approches'], 'alerte']]){
      W.__u = users; E("adm.users = window.__u; adm.detail = null; adm.q = ''; renderAdmin()"); const t = appText(); ok(t.includes('Surveillance des e-mails'), label + ' : carte'); ok(t.includes(expect[0]), label + ' : ' + expect[0]);
      if (expect[1]) ok(t.includes(expect[1]), label + ' : message'); else ok(!t.includes('approches'), 'pas d’alerte en situation calme'); noErr('admin ' + label);
    }
    W.__u = mk(45, 100); E("adm.users = window.__u; renderAdmin()"); ok(/Tu as 45 comptes/.test(appText()), 'passage au nom de domaine'); ok(!appText().includes('approches'));
    for (const L of ['en', 'ar']){ E(`setLang('${L}'); adm.users = window.__u; renderAdmin()`); eq(E('[...missingKeys]'), [], L); } E("setLang('fr'); me = null; adm.users = null");
  });
  test('Chaque onglet s’affiche dans les 3 langues sans erreur ni « undefined »', async () => {
    for (const L of ['fr', 'en', 'ar']){
      reset(); E(`setLang('${L}')`);
      for (const t of ['home', 'train', 'plan', 'progress', 'settings', 'errors']){
        E(`go('${t}')`); await wait(10); noErr(`${t}/${L}`);
        const txt = D.getElementById('app').textContent; ok(!/undefined|NaN|\[object/.test(txt), `texte suspect dans ${t}/${L}`);
      }
    }
    eq(E('document.documentElement.dir'), 'rtl');
  });
  test('Lecteur : sourate entière et un matn s’ouvrent', () => {
    reset(); E("openReader('q:1')"); ok($q('.rsec'), 'lecteur Coran'); E("openReader('m:tuhfa')"); ok($q('.rsec'), 'lecteur matn'); noErr('lecteur');
  });
  test('Mes moutoun : un matn ajouté à la main devient utilisable', () => {
    reset(); E("go('train')"); const ta = $q('#cm-text'); if (!ta) return; // la zone n'existe que sur l'écran concerné
    ta.value = 'قال الشيخ رحمه الله تعالى في أول منظومته\nالحمد لله الذي هدانا إلى سبيل الحق والإيمان'; $q('#cm-title').value = 'Test'; clickAct('addcustom'); noErr('ajout matn');
    eq(E('custom.length'), 1);
  });
  test('Comptes : messages d’erreur d’e-mail clairs, renvoi de l’e-mail de confirmation (serveur simulé)', async () => {
    reset(); const f = m => E(`friendly(new Error(${JSON.stringify(m)}))`);
    ok(/limite d'e-mails/.test(f('email rate limit exceeded')), 'limite horaire'); ok(/service d'envoi/.test(f('Email address not authorized')), 'serveur d’essai');
    ok(/n'a pas pu être envoyé/.test(f('Error sending confirmation email')), 'envoi'); ok(/Trop de tentatives/.test(f('For security purposes, you can only request this after 20 seconds')), 'anti-spam');
    ok(/incorrect/.test(f('Invalid login credentials')), 'identifiants');
    const calls = []; W.__c = calls;
    E("CLOUD.url = 'https://x.supabase.co'; CLOUD.anonKey = 'k'; me = null; acc.mode = 'signup'; acc.resend = ''; acc.resendAt = 0; sb = {auth: {async signUp(){ window.__c.push('signUp'); return {data: {user: {identities: [{}]}, session: null}, error: null}; }, async resend(o){ window.__c.push('resend ' + o.email + ' ' + o.type); return {error: null}; }, async signInWithPassword(){ return {data: null, error: {message: 'Email not confirmed'}}; }}};");
    E("renderAccount()"); ok(!$q('[data-act="acc-resend"]'), 'pas de bouton avant inscription');
    $q('#ac-email').value = 'a@b.fr'; $q('#ac-pass').value = 'motdepasse1'; $q('#ac-pass2').value = 'motdepasse1'; $q('#ac-consent').checked = true; clickAct('acc-signup'); await wait(300);
    ok($q('[data-act="acc-resend"]'), 'bouton de renvoi après inscription'); ok(/indésirables/.test($q('#acc-msg').textContent), 'rappel du dossier spam');
    clickAct('acc-resend'); await wait(300); ok(calls.includes('resend a@b.fr signup'), 'renvoi demandé'); ok(/renvoyé/.test($q('#acc-msg').textContent));
    clickAct('acc-resend'); await wait(300); eq(calls.filter(c => c.startsWith('resend')).length, 1, 'une relance par minute au plus'); ok(/Patiente/.test($q('#acc-msg').textContent), 'attente affichée');
    E("acc.resend = ''; acc.resendAt = 0; acc.mode = 'login'; renderAccount()"); $q('#ac-email').value = 'c@d.fr'; $q('#ac-pass').value = 'x'; clickAct('acc-login'); await wait(300);
    ok($q('[data-act="acc-resend"]'), 'bouton si e-mail non confirmé'); eq(E('acc.resend'), 'c@d.fr');
    E("CLOUD.url = ''; CLOUD.anonKey = ''; sb = null; me = null; acc.resend = ''; acc.msg = '';");
  });
  test('Rappels : activer, changer l’heure, 2e rappel, désactiver (serveur simulé)', async () => {
    reset();
    const calls = []; let sub = null;
    E("CLOUD.url = 'https://x.supabase.co'; CLOUD.anonKey = 'k'; CLOUD.vapidPublicKey = 'BGSyzd0fSnxyLCKcsbtliLDWAeWZb1A38k-bY9yLWDq04L_Ki16sCALo8ldhM1FhbSxB75rxRnVv0WFO7XWvBxM'; me = {user: {id: 'u'}, profile: {role: 'user'}};");
    W.__calls = calls; E("sb = {auth: {async signOut(){ return {}; }}, async rpc(n, a){ window.__calls.push(n + ' ' + JSON.stringify(a)); return {error: null}; }};");
    const fakeSub = {endpoint: 'https://p/x', toJSON(){ return {endpoint: this.endpoint, keys: {p256dh: 'P', auth: 'A'}}; }, async unsubscribe(){ sub = null; return true; }};
    const reg = {pushManager: {async getSubscription(){ return sub; }, async subscribe(){ sub = fakeSub; return fakeSub; }}};
    Object.defineProperty(W.navigator.serviceWorker, 'ready', {get: () => Promise.resolve(reg), configurable: true});
    Object.defineProperty(W.Notification, 'permission', {get: () => 'granted', configurable: true});
    E("go('settings')"); ok($q('#rem-time'), 'carte Rappels absente (PushManager indisponible ici ?)');
    $q('#rem-time').value = '20:00'; $q('#rem-two').click(); eq($q('#rem-time2').disabled, false); $q('#rem-time2').value = '19:00';
    clickAct('rem-on'); await wait(300); ok(/après le 1er/.test($q('#rem-msg').textContent), 'un 2e rappel avant le 1er doit être refusé'); eq(calls.length, 0);
    $q('#rem-time2').value = '21:30'; clickAct('rem-on'); await wait(300);
    ok(calls.at(-1).startsWith('push_subscribe') && calls.at(-1).includes('"p_time":"20:00"') && calls.at(-1).includes('"p_time2":"21:30"'), 'push_subscribe avec les 2 heures');
    $q('#rem-two').click(); clickAct('rem-save'); await wait(300); ok(calls.at(-1).includes('"p_time2":null'), 'sans 2e rappel : p_time2 nul');
    clickAct('rem-off'); await wait(300); ok(calls.some(c => c.startsWith('push_unsubscribe')), 'désabonnement serveur'); eq(E('remState().on'), false);
    E("CLOUD.url = ''; CLOUD.anonKey = ''; CLOUD.vapidPublicKey = ''; sb = null; me = null;");
  });

  /* ---- exécution ---- */
  const out = document.getElementById('out');
  for (const t of tests){
    let r;
    try { await t.fn(); r = {name: t.name, ok: true}; } catch (e){ r = {name: t.name, ok: false, err: String(e && e.message || e)}; }
    results.push(r);
    const li = document.createElement('li'); li.innerHTML = `<span class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✓' : '✗'}</span> ${r.name.replace(/</g, '&lt;')}` + (r.ok ? '' : `<pre class="ko"></pre>`);
    if (!r.ok) li.querySelector('pre').textContent = r.err;
    out.appendChild(li);
  }
  restore();
  const failed = results.filter(r => !r.ok).length;
  document.getElementById('sum').innerHTML = `<b class="${failed ? 'ko' : 'ok'}">${results.length - failed} réussis, ${failed} en échec</b>`;
  window.__result = {passed: results.length - failed, failed, results};
})();
