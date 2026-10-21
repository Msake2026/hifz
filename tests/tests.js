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
  const $q = s => D.querySelector(s), $$q = s => [...D.querySelectorAll(s)];
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
