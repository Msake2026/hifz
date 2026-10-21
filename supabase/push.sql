-- Hifz : rappels par notification (à lancer APRÈS schema.sql, dans Supabase → SQL Editor). Peut être relancé sans risque.

create table if not exists public.push_subs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,                 -- adresse technique de l'appareil (fournie par Apple, Google ou Mozilla)
  p256dh      text not null,
  auth        text not null,
  remind_time text not null default '20:00' check (remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tz          text not null default 'UTC',          -- fuseau de l'appareil (ex. Europe/Paris)
  lang        text not null default 'fr' check (lang in ('fr', 'en', 'ar')),
  last_sent   date,                                 -- dernier jour (local) où un rappel a été traité
  created_at  timestamptz not null default now()
);
-- 2e rappel facultatif (même jour, plus tard, seulement si toujours pas révisé)
alter table public.push_subs add column if not exists remind_time2 text check (remind_time2 ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.push_subs add column if not exists last_sent2 date;
alter table public.push_subs enable row level security;

-- chacun ne voit que ses propres abonnements ; les écritures passent par les fonctions ci-dessous
drop policy if exists "abonnement : lecture" on public.push_subs;
create policy "abonnement : lecture" on public.push_subs for select to authenticated using (user_id = auth.uid());

drop function if exists public.push_subscribe(text, text, text, text, text, text);
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_time text, p_tz text, p_lang text, p_time2 text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'accès refusé' using errcode = '42501'; end if;
  insert into public.push_subs (user_id, endpoint, p256dh, auth, remind_time, remind_time2, tz, lang)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_time, nullif(p_time2, ''), coalesce(nullif(p_tz, ''), 'UTC'), p_lang)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        remind_time = excluded.remind_time, remind_time2 = excluded.remind_time2, tz = excluded.tz, lang = excluded.lang,
        last_sent  = case when public.push_subs.remind_time  <> excluded.remind_time  then null else public.push_subs.last_sent end,
        last_sent2 = case when public.push_subs.remind_time2 is distinct from excluded.remind_time2 then null else public.push_subs.last_sent2 end;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid()
$$;

revoke all on function public.push_subscribe(text, text, text, text, text, text, text), public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text, text, text, text), public.push_unsubscribe(text) to authenticated;
