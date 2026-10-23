// Edge Function « send-reminders » : envoie les rappels de révision (notifications Web Push).
// Appelée toutes les 5 minutes par pg_cron (voir supabase/README.md). Secrets requis (Edge Functions → Secrets) :
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), CRON_SECRET. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
// Déployer avec « Verify JWT » désactivé : l'accès est protégé par CRON_SECRET.
// Même passage toutes les 5 minutes : prévient les administrateurs (notification + e-mail) d'une nouvelle demande pour devenir enseignant.
// Le dimanche en fin d'après-midi (UTC) : résumé de la semaine par e-mail aux personnes qui l'ont activé (Réglages → Compte).
// L'e-mail est facultatif : il demande les secrets SMTP_USER (adresse Gmail d'envoi) et SMTP_PASS (mot de passe d'application Google) ; sans eux, seule la notification part.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string; remind_time: string; remind_time2: string | null; tz: string; lang: string; last_sent: string | null; last_sent2: string | null };

const MSG: Record<string, { title: string; plain: string; due: (n: number) => string; late: string }> = {
  fr: { title: 'Tathbīt', plain: "C'est l'heure de ta révision 📖", due: (n) => `${n} verset${n > 1 ? 's' : ''} à revoir aujourd'hui 📖`, late: "Il n'est pas trop tard pour ta révision du jour 🌙" },
  en: { title: 'Tathbīt', plain: 'Time for your review 📖', due: (n) => `${n} verse${n !== 1 ? 's' : ''} to review today 📖`, late: "It's not too late for today's review 🌙" },
  ar: { title: 'تثبيت', plain: 'حان وقت مراجعتك 📖', due: (n) => `${n} ${n === 1 ? 'آية' : 'آيات'} للمراجعة اليوم 📖`, late: 'لم يفت الأوان بعد لمراجعة اليوم 🌙' },
};

// date (AAAA-MM-JJ) et minutes écoulées dans la journée, dans le fuseau de l'appareil
function localParts(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// chaque rappel (1er et 2e) part une seule fois par jour local, à partir de son heure (et jusqu'à 3 h plus tard si un passage a été manqué)
function decide(sub: Sub, now: Date) {
  let lp;
  try { lp = localParts(now, sub.tz); } catch { lp = localParts(now, 'UTC'); }
  const due = (t: string | null, last: string | null) => {
    if (!t) return false;
    const [h, m] = t.split(':').map(Number), target = h * 60 + m;
    return last !== lp.date && lp.minutes >= target && lp.minutes < target + 180;
  };
  // si les deux sont dans la fenêtre (passage manqué), seul le dernier compte
  const second = due(sub.remind_time2, sub.last_sent2);
  return { first: !second && due(sub.remind_time, sub.last_sent), second, date: lp.date };
}

const REQ = {
  fr: (e: string) => ({ title: 'Tathbīt · demande enseignant', body: `${e} demande à devenir enseignant.` }),
  en: (e: string) => ({ title: 'Tathbīt · teacher request', body: `${e} asks to become a teacher.` }),
  ar: (e: string) => ({ title: 'تثبيت · طلب معلّم', body: `${e} يطلب أن يصبح معلّماً.` }),
};

// demandes d'enseignant pas encore signalées : notification aux appareils des admins + e-mail aux admins (si SMTP configuré)
async function notifyRequests(db: ReturnType<typeof createClient>) {
  const { data: rows, error } = await db.from('teacher_requests').select('user_id').is('notified_at', null);
  if (error || !rows?.length) return 0;      // table ou colonne absente (teacher.sql pas relancé) : on ignore
  const { data: profs } = await db.from('profiles').select('id, email, blocked').in('id', rows.map((r: { user_id: string }) => r.user_id));
  const reqs = (profs ?? []).map((p: { id: string; email: string; blocked: boolean }) => ({ user_id: p.id, profiles: { email: p.email, blocked: p.blocked } }));
  const { data: admins } = await db.from('profiles').select('id, email').eq('role', 'admin').eq('blocked', false);
  const ids = (admins ?? []).map((a: { id: string }) => a.id);
  if (!ids.length) return 0;
  const { data: subs } = await db.from('push_subs').select('id, endpoint, p256dh, auth, lang').in('user_id', ids);
  const smtpUser = Deno.env.get('SMTP_USER'), smtpPass = Deno.env.get('SMTP_PASS');
  let done = 0;
  for (const r of reqs) {
    if (r.profiles.blocked) continue;
    const email = r.profiles.email;
    let ok = false;
    for (const sub of subs ?? []) {
      const m = (REQ[sub.lang as keyof typeof REQ] ?? REQ.fr)(email);
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...m, url: './' }), { TTL: 24 * 3600, urgency: 'normal' }); ok = true; }
      catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) await db.from('push_subs').delete().eq('id', sub.id); else console.error('push admin', c, (e as Error).message); }
    }
    if (smtpUser && smtpPass) {
      try {
        const c = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: smtpUser, password: smtpPass } } });
        await c.send({ from: smtpUser, to: (admins ?? []).map((a: { email: string }) => a.email), subject: 'Tathbīt : demande pour devenir enseignant',
          content: `${email} demande à devenir enseignant.\n\nPour accepter ou refuser : Tathbīt → Réglages → Compte → Espace admin → « Demandes d'enseignant ».` });
        await c.close(); ok = true;
      } catch (e) { console.error('mail admin', (e as Error).message); }
    }
    if (ok) { await db.from('teacher_requests').update({ notified_at: new Date().toISOString() }).eq('user_id', r.user_id); done++; }
  }
  return done;
}

// WK:begin — résumé de la semaine (fonction pure, testée en Node)
function weekSummary(days: Record<string, number>, now: Date) {
  let total = 0, active = 0, streak = 0, run = true;
  for (let i = 0; i < 7; i++) {
    const n = days[new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10)] ?? 0;
    total += n; if (n > 0) active++;
    if (run && n > 0) streak++; else if (i > 0) run = false;
  }
  return { total, active, streak };
}
const WK = {
  fr: { subject: 'Tathbīt : ta semaine', body: (w: { total: number; active: number; streak: number }) => `Cette semaine : ${w.total} réponse${w.total > 1 ? 's' : ''}, ${w.active} jour${w.active > 1 ? 's' : ''} actif${w.active > 1 ? 's' : ''} sur 7.\n${w.active === 0 ? "Une petite révision aujourd'hui relancera la régularité." : 'Continue comme ça, la régularité fait la mémorisation.'}\n\nPour ne plus recevoir ce résumé : Tathbīt → Réglages → Compte.` },
  en: { subject: 'Tathbīt: your week', body: (w: { total: number; active: number; streak: number }) => `This week: ${w.total} answer${w.total !== 1 ? 's' : ''}, ${w.active} active day${w.active !== 1 ? 's' : ''} out of 7.\n${w.active === 0 ? 'A short review today will restart your routine.' : 'Keep going: regularity builds memorisation.'}\n\nTo stop receiving this summary: Tathbīt → Settings → Account.` },
  ar: { subject: 'تثبيت: أسبوعك', body: (w: { total: number; active: number; streak: number }) => `هذا الأسبوع: ${w.total} إجابة، و${w.active} أيام نشطة من 7.\n${w.active === 0 ? 'مراجعة قصيرة اليوم تعيد لك انتظامك.' : 'واصل: الانتظام يصنع الحفظ.'}\n\nلإيقاف هذا الملخص: تثبيت ← الإعدادات ← الحساب.` },
};
// WK:end

async function sendWeekly(db: ReturnType<typeof createClient>, now: Date) {
  const smtpUser = Deno.env.get('SMTP_USER'), smtpPass = Deno.env.get('SMTP_PASS');
  if (!smtpUser || !smtpPass || now.getUTCDay() !== 0 || now.getUTCHours() < 16 || now.getUTCHours() > 18) return 0;
  const today = now.toISOString().slice(0, 10);
  const { data: prefs, error } = await db.from('mail_prefs').select('user_id, lang, last_sent').eq('weekly', true).limit(100);
  if (error || !prefs?.length) return 0;
  const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: smtpUser, password: smtpPass } } });
  let n = 0;
  try {
    for (const p of prefs as { user_id: string; lang: string; last_sent: string | null }[]) {
      if (p.last_sent === today) continue;
      const { data: prof } = await db.from('profiles').select('email, blocked').eq('id', p.user_id).maybeSingle();
      if (!prof || prof.blocked) continue;
      const { data: ud } = await db.from('user_data').select('data').eq('user_id', p.user_id).maybeSingle();
      const m = WK[p.lang as keyof typeof WK] ?? WK.fr, w = weekSummary((ud?.data?.days ?? {}) as Record<string, number>, now);
      try { await client.send({ from: smtpUser, to: prof.email, subject: m.subject, content: m.body(w) }); await db.from('mail_prefs').update({ last_sent: today }).eq('user_id', p.user_id); n++; }
      catch (e) { console.error('mail hebdo', (e as Error).message); }
    }
  } finally { await client.close().catch(() => {}); }
  return n;
}

const MSGN = {
  fr: (e: string) => ({ title: 'Tathbīt · nouveau message', body: `Message de ${e}` }),
  en: (e: string) => ({ title: 'Tathbīt · new message', body: `Message from ${e}` }),
  ar: (e: string) => ({ title: 'تثبيت · رسالة جديدة', body: `رسالة من ${e}` }),
};

// messages enseignant ↔ élève pas encore signalés : notification au destinataire (sans le texte du message)
async function notifyMessages(db: ReturnType<typeof createClient>) {
  const { data: msgs, error } = await db.from('teacher_messages').select('id, teacher_id, student_id, from_student').is('notified_at', null).limit(50);
  if (error || !msgs?.length) return 0;
  let n = 0;
  for (const m of msgs as { id: number; teacher_id: string; student_id: string; from_student: boolean }[]) {
    const to = m.from_student ? m.teacher_id : m.student_id, from = m.from_student ? m.student_id : m.teacher_id;
    const { data: prof } = await db.from('profiles').select('email').eq('id', from).maybeSingle();
    const { data: subs } = await db.from('push_subs').select('id, endpoint, p256dh, auth, lang').eq('user_id', to);
    for (const sub of subs ?? []) {
      const t = (MSGN[sub.lang as keyof typeof MSGN] ?? MSGN.fr)(prof?.email ?? '');
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...t, url: './' }), { TTL: 24 * 3600, urgency: 'normal' }); n++; }
      catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) await db.from('push_subs').delete().eq('id', sub.id); else console.error('push message', c, (e as Error).message); }
    }
    await db.from('teacher_messages').update({ notified_at: new Date().toISOString() }).eq('id', m.id);
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const now = new Date();
  const { data: subs, error } = await db.from('push_subs').select('*');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let messages = 0; try { messages = await notifyMessages(db); } catch (e) { console.error('messages', (e as Error).message); }
  let weekly = 0; try { weekly = await sendWeekly(db, new Date()); } catch (e) { console.error('hebdo', (e as Error).message); }
  let notified = 0; try { notified = await notifyRequests(db); } catch (e) { console.error('demandes', (e as Error).message); }
  let sent = 0, skipped = 0, removed = 0;
  for (const s of (subs ?? []) as Sub[]) {
    const d = decide(s, now);
    if (!d.first && !d.second) continue;
    const mark = d.second ? { last_sent: d.date, last_sent2: d.date } : { last_sent: d.date }; // le 2e rappel remplace le 1er s'il n'est pas encore parti
    const { data: ud } = await db.from('user_data').select('data').eq('user_id', s.user_id).maybeSingle();
    const days = (ud?.data?.days ?? {}) as Record<string, number>;
    if ((days[d.date] ?? 0) > 0) { // déjà révisé aujourd'hui : pas de rappel
      await db.from('push_subs').update(mark).eq('id', s.id); skipped++; continue;
    }
    const due = Object.values((ud?.data?.sched ?? {}) as Record<string, { due: number }>).filter((v) => v && v.due <= now.getTime()).length;
    const m = MSG[s.lang] ?? MSG.fr;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: m.title, body: d.second ? m.late : due > 0 ? m.due(due) : m.plain, url: './' }), { TTL: 6 * 3600, urgency: 'normal' });
      await db.from('push_subs').update(mark).eq('id', s.id); sent++;
      // même rappel dans la cloche de l'application, tant que la personne ne l'a pas traité (un seul rappel non traité à la fois)
      await db.from('notifications').delete().eq('user_id', s.user_id).eq('kind', 'reminder').is('read_at', null);
      await db.from('notifications').insert({ user_id: s.user_id, kind: 'reminder', ref: d.date, n: due });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from('push_subs').delete().eq('id', s.id); removed++; } // appareil désinscrit
      else console.error('push', s.id, code, (e as Error).message);
    }
  }
  return new Response(JSON.stringify({ sent, skipped, removed, notified, weekly, messages }), { headers: { 'Content-Type': 'application/json' } });
});
