-- Hifz : rôle « enseignant » (à lancer APRÈS schema.sql, dans Supabase → SQL Editor). Peut être relancé sans risque.
--
-- Principe : l'ÉLÈVE décide. Il crée un code d'invitation (valable 7 jours, à usage unique) et le donne à son enseignant ; l'enseignant
-- (compte auquel un admin a donné le rôle « teacher ») saisit le code : le lien existe alors, jusqu'à ce que l'élève (ou l'enseignant)
-- le retire. L'enseignant ne lit JAMAIS les tables : il passe par des fonctions qui vérifient le lien à chaque appel et ne renvoient
-- qu'un résumé (statistiques, jours d'activité, erreurs sans les réponses tapées). Chaque consultation d'un détail est journalisée et
-- visible par l'élève. Aucune règle d'accès direct n'est donnée à l'enseignant : tout passe par ces fonctions.

-- 1. Nouveau rôle
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'teacher'));

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher' and not blocked)
$$;

-- Demandes pour devenir enseignant (l'utilisateur demande, l'administrateur accepte ou refuse)
create table if not exists public.teacher_requests (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.teacher_requests add column if not exists notified_at timestamptz;   -- renseigné quand les administrateurs ont été prévenus (fonction send-reminders)
alter table public.teacher_requests enable row level security;
drop policy if exists "demande : lecture" on public.teacher_requests;
create policy "demande : lecture" on public.teacher_requests for select to authenticated using (user_id = auth.uid());
revoke all on public.teacher_requests from anon, authenticated;
grant select on public.teacher_requests to authenticated;

create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if new_role not in ('user', 'admin', 'teacher') then raise exception 'rôle inconnu'; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'Tu ne peux pas retirer ton propre rôle admin.'; end if;
  update public.profiles set role = new_role where id = target;
  delete from public.teacher_requests where user_id = target;       -- la demande est traitée
end $$;

-- 2. Tables (lecture seule pour les utilisateurs connectés, et seulement leurs propres lignes ; écritures par les fonctions)
create table if not exists public.teacher_invites (
  code       text primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.teacher_links (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id),
  check (teacher_id <> student_id)
);
create table if not exists public.teacher_access_log (
  id         bigint generated always as identity primary key,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  at         timestamptz not null default now()
);
alter table public.teacher_invites    enable row level security;
alter table public.teacher_links      enable row level security;
alter table public.teacher_access_log enable row level security;

drop policy if exists "invitation : lecture" on public.teacher_invites;
create policy "invitation : lecture" on public.teacher_invites for select to authenticated using (student_id = auth.uid());
drop policy if exists "lien : lecture" on public.teacher_links;
create policy "lien : lecture" on public.teacher_links for select to authenticated using (student_id = auth.uid() or teacher_id = auth.uid());
drop policy if exists "journal : lecture par l'élève" on public.teacher_access_log;
create policy "journal : lecture par l'élève" on public.teacher_access_log for select to authenticated using (student_id = auth.uid());

revoke all on public.teacher_invites, public.teacher_links, public.teacher_access_log from anon, authenticated;
grant select on public.teacher_invites, public.teacher_links, public.teacher_access_log to authenticated;

-- 3. Élève : inviter, annuler, retirer l'accès, voir qui a consulté
create or replace function public.invite_create() returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v text; c text := ''; i int;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if (select count(*) from public.teacher_invites t where t.student_id = auth.uid() and t.used_by is null and t.expires_at > now()) >= 5 then
    raise exception 'Trop d''invitations en cours : annule-en une avant d''en créer une autre.' using errcode = 'P0001';
  end if;
  v := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');            -- aléa cryptographique (uuid v4)
  for i in 0..7 loop c := c || substr(alpha, 1 + (('x' || substr(v, 1 + i * 4, 4))::bit(16)::int % 32), 1); end loop;
  insert into public.teacher_invites (code, student_id, expires_at) values (c, auth.uid(), now() + interval '7 days');
  return query select c, now() + interval '7 days';
end $$;

create or replace function public.invite_cancel(p_code text) returns void
language sql security definer set search_path = public as $$
  delete from public.teacher_invites where code = upper(trim(p_code)) and student_id = auth.uid() and used_by is null
$$;

create or replace function public.link_revoke(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.teacher_links
  where (teacher_id = auth.uid() and student_id = other) or (student_id = auth.uid() and teacher_id = other)
$$;

create or replace function public.links_mine() returns table (as_role text, other_id uuid, email text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select 'teacher'::text, l.teacher_id, p.email, l.created_at from public.teacher_links l join public.profiles p on p.id = l.teacher_id
   where l.student_id = auth.uid() and p.role = 'teacher' and not p.blocked
  union all
  select 'student'::text, l.student_id, p.email, l.created_at from public.teacher_links l join public.profiles p on p.id = l.student_id
   where l.teacher_id = auth.uid() and not p.blocked and public.is_teacher()
  order by 4 desc
$$;

create or replace function public.access_log_mine() returns table (teacher_email text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.email, g.at from public.teacher_access_log g join public.profiles p on p.id = g.teacher_id
   where g.student_id = auth.uid() order by g.at desc limit 50
$$;

-- 4. Enseignant : accepter un code, lister ses élèves, lire le résumé d'un élève
create or replace function public.invite_accept(p_code text) returns table (student_id uuid, email text)
language plpgsql security definer set search_path = public as $$
declare inv public.teacher_invites; v_email text;
begin
  if not public.is_teacher() then raise exception 'accès refusé' using errcode = '42501'; end if;
  select * into inv from public.teacher_invites t where t.code = upper(trim(p_code)) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then raise exception 'Code invalide ou expiré.' using errcode = 'P0001'; end if;
  if inv.student_id = auth.uid() then raise exception 'Tu ne peux pas être ton propre enseignant.' using errcode = 'P0001'; end if;
  select p.email into v_email from public.profiles p where p.id = inv.student_id and not p.blocked;
  if not found then raise exception 'Code invalide ou expiré.' using errcode = 'P0001'; end if;
  insert into public.teacher_links (teacher_id, student_id) values (auth.uid(), inv.student_id) on conflict do nothing;
  update public.teacher_invites t set used_by = auth.uid() where t.code = inv.code;
  return query select inv.student_id, v_email;
end $$;

create or replace function public.teacher_students() returns table (
  id uuid, email text, since timestamptz, last_seen timestamptz, answers numeric, ok numeric, errors integer, synced_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'accès refusé' using errcode = '42501'; end if;
  return query
  select p.id, p.email, l.created_at, p.last_seen,
    coalesce((select sum((e.value->>0)::numeric + (e.value->>1)::numeric)
              from jsonb_each(case when jsonb_typeof(d.data->'stats') = 'object' then d.data->'stats' else '{}'::jsonb end) e), 0),
    coalesce((select sum((e.value->>0)::numeric)
              from jsonb_each(case when jsonb_typeof(d.data->'stats') = 'object' then d.data->'stats' else '{}'::jsonb end) e), 0),
    case when jsonb_typeof(d.data->'errors') = 'array' then jsonb_array_length(d.data->'errors') else 0 end,
    d.updated_at
  from public.teacher_links l join public.profiles p on p.id = l.student_id left join public.user_data d on d.user_id = p.id
  where l.teacher_id = auth.uid() and not p.blocked
  order by p.email;
end $$;

create or replace function public.teacher_student_data(target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d jsonb; u timestamptz;
begin
  if not public.is_teacher() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if not exists (select 1 from public.teacher_links l join public.profiles p on p.id = l.student_id
                  where l.teacher_id = auth.uid() and l.student_id = target and not p.blocked) then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  insert into public.teacher_access_log (teacher_id, student_id)
  select auth.uid(), target where not exists (select 1 from public.teacher_access_log g
    where g.teacher_id = auth.uid() and g.student_id = target and g.at > now() - interval '1 hour');
  select x.data, x.updated_at into d, u from public.user_data x where x.user_id = target;
  d := coalesce(d, '{}'::jsonb);
  return jsonb_build_object(
    'email', (select p.email from public.profiles p where p.id = target), 'updated_at', u,
    'stats', case when jsonb_typeof(d->'stats') = 'object' then d->'stats' else '{}'::jsonb end,
    'days',  case when jsonb_typeof(d->'days')  = 'object' then d->'days'  else '{}'::jsonb end,
    'errors', coalesce((select jsonb_agg(x.e - 'ans') from (
        select e from jsonb_array_elements(case when jsonb_typeof(d->'errors') = 'array' then d->'errors' else '[]'::jsonb end) e
        order by coalesce((e->>'t')::numeric, 0) desc limit 300) x), '[]'::jsonb));          -- sans les réponses tapées, sans les textes ajoutés ni les réglages
end $$;

revoke all on function public.is_teacher(), public.invite_create(), public.invite_cancel(text), public.link_revoke(uuid), public.links_mine(),
  public.access_log_mine(), public.invite_accept(text), public.teacher_students(), public.teacher_student_data(uuid),
  public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.is_teacher(), public.invite_create(), public.invite_cancel(text), public.link_revoke(uuid), public.links_mine(),
  public.access_log_mine(), public.invite_accept(text), public.teacher_students(), public.teacher_student_data(uuid),
  public.admin_set_role(uuid, text) to authenticated;

-- 9. Demande pour devenir enseignant
create or replace function public.teacher_request() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin')) then raise exception 'Tu as déjà ce rôle.'; end if;
  insert into public.teacher_requests (user_id) values (auth.uid()) on conflict do nothing;
end $$;

create or replace function public.teacher_request_cancel() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'accès refusé' using errcode = '42501'; end if;
  delete from public.teacher_requests where user_id = auth.uid();
end $$;

create or replace function public.admin_teacher_requests() returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  return query select r.user_id, p.email, r.created_at from public.teacher_requests r join public.profiles p on p.id = r.user_id
    where not p.blocked order by r.created_at;
end $$;

create or replace function public.admin_teacher_decline(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  delete from public.teacher_requests where user_id = target;
end $$;

revoke all on function public.teacher_request(), public.teacher_request_cancel(), public.admin_teacher_requests(), public.admin_teacher_decline(uuid) from public, anon;
grant execute on function public.teacher_request(), public.teacher_request_cancel(), public.admin_teacher_requests(), public.admin_teacher_decline(uuid) to authenticated;
