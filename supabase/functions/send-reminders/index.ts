// Edge Function « send-reminders » : envoie les rappels de révision (notifications Web Push).
// Appelée toutes les 5 minutes par pg_cron (voir supabase/README.md). Secrets requis (Edge Functions → Secrets) :
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), CRON_SECRET. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
// Déployer avec « Verify JWT » désactivé : l'accès est protégé par CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string; remind_time: string; tz: string; lang: string; last_sent: string | null };

const MSG: Record<string, { title: string; plain: string; due: (n: number) => string }> = {
  fr: { title: 'Hifz', plain: "C'est l'heure de ta révision 📖", due: (n) => `${n} verset${n > 1 ? 's' : ''} à revoir aujourd'hui 📖` },
  en: { title: 'Hifz', plain: 'Time for your review 📖', due: (n) => `${n} verse${n !== 1 ? 's' : ''} to review today 📖` },
  ar: { title: 'حفظ', plain: 'حان وقت مراجعتك 📖', due: (n) => `${n} ${n === 1 ? 'آية' : 'آيات'} للمراجعة اليوم 📖` },
};

// date (AAAA-MM-JJ) et minutes écoulées dans la journée, dans le fuseau de l'appareil
function localParts(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// un rappel part une seule fois par jour local, à partir de l'heure choisie (et jusqu'à 3 h plus tard si un passage a été manqué)
function decide(sub: Sub, now: Date) {
  let lp;
  try { lp = localParts(now, sub.tz); } catch { lp = localParts(now, 'UTC'); }
  const [h, m] = sub.remind_time.split(':').map(Number), target = h * 60 + m;
  return { send: sub.last_sent !== lp.date && lp.minutes >= target && lp.minutes < target + 180, date: lp.date };
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const now = new Date();
  const { data: subs, error } = await db.from('push_subs').select('*');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let sent = 0, skipped = 0, removed = 0;
  for (const s of (subs ?? []) as Sub[]) {
    const d = decide(s, now);
    if (!d.send) continue;
    const { data: ud } = await db.from('user_data').select('data').eq('user_id', s.user_id).maybeSingle();
    const days = (ud?.data?.days ?? {}) as Record<string, number>;
    if ((days[d.date] ?? 0) > 0) { // déjà révisé aujourd'hui : pas de rappel
      await db.from('push_subs').update({ last_sent: d.date }).eq('id', s.id); skipped++; continue;
    }
    const due = Object.values((ud?.data?.sched ?? {}) as Record<string, { due: number }>).filter((v) => v && v.due <= now.getTime()).length;
    const m = MSG[s.lang] ?? MSG.fr;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: m.title, body: due > 0 ? m.due(due) : m.plain, url: './' }), { TTL: 6 * 3600, urgency: 'normal' });
      await db.from('push_subs').update({ last_sent: d.date }).eq('id', s.id); sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from('push_subs').delete().eq('id', s.id); removed++; } // appareil désinscrit
      else console.error('push', s.id, code, (e as Error).message);
    }
  }
  return new Response(JSON.stringify({ sent, skipped, removed }), { headers: { 'Content-Type': 'application/json' } });
});
