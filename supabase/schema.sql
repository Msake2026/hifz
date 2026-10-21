-- Hifz : comptes, synchronisation de la progression et espace admin (Supabase)
-- À coller dans Supabase → SQL Editor → New query → Run. Peut être relancé sans risque.
--
-- Sécurité : toutes les règles sont appliquées PAR LA BASE (RLS + fonctions), pas par le site.
-- L'interface admin n'est qu'un affichage : sans le rôle admin en base, les appels sont refusés.

-- 0. E-mail de l'administrateur initial : le compte qui CONFIRME cet e-mail devient admin.
--    (À changer ici si besoin. Garde « Confirm email » activé dans Authentication → Providers → Email.)
create or replace function public.bootstrap_admin_email() returns text
language sql immutable as $$ select 'hifz.app.contact@gmail.com'::text $$;

-- 1. Tables
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'user' check (role in ('user', 'admin')),
  blocked    boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen  timestamptz
);
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles  enable row level security;
alter table public.user_data enable row level security;

-- 2. Fonctions d'appartenance (utilisées par les règles RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not blocked)
$$;
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not blocked)
$$;

-- 3. Règles RLS : chacun ne voit/écrit que ses données ; l'admin voit tout ; personne n'écrit les rôles directement
drop policy if exists "profil : lecture" on public.profiles;
create policy "profil : lecture" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "donnees : lecture" on public.user_data;
create policy "donnees : lecture" on public.user_data for select to authenticated
  using ((user_id = auth.uid() and public.is_active()) or public.is_admin());
drop policy if exists "donnees : insertion" on public.user_data;
create policy "donnees : insertion" on public.user_data for insert to authenticated
  with check (user_id = auth.uid() and public.is_active());
drop policy if exists "donnees : mise a jour" on public.user_data;
create policy "donnees : mise a jour" on public.user_data for update to authenticated
  using (user_id = auth.uid() and public.is_active())
  with check (user_id = auth.uid() and public.is_active());

-- 4. Création automatique du profil, et promotion de l'admin initial à la CONFIRMATION de son e-mail
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when lower(new.email) = public.bootstrap_admin_email() and new.email_confirmed_at is not null
               then 'admin' else 'user' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null
     and lower(new.email) = public.bootstrap_admin_email() then
    update public.profiles set role = 'admin' where id = new.id;
  end if;
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email_confirmed_at, email on auth.users
  for each row execute function public.handle_user_updated();

-- Comptes déjà existants (rattrapage)
insert into public.profiles (id, email, role)
select id, email, case when lower(email) = public.bootstrap_admin_email() and email_confirmed_at is not null then 'admin' else 'user' end
from auth.users on conflict (id) do nothing;

-- 5. Fonctions appelées par l'application
create or replace function public.touch() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid()
$$;

create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '42501'; end if;
  if (select role from public.profiles where id = auth.uid()) = 'admin'
     and (select count(*) from public.profiles where role = 'admin' and not blocked) <= 1 then
    raise exception 'Tu es le dernier administrateur : nomme-en un autre avant de supprimer ton compte.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- 6. Fonctions admin (refusées si l'appelant n'est pas admin en base)
create or replace function public.admin_users() returns table (
  id uuid, email text, role text, blocked boolean, created_at timestamptz, last_seen timestamptz,
  answers numeric, ok numeric, errors integer, synced_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  return query
  select p.id, p.email, p.role, p.blocked, p.created_at, p.last_seen,
    coalesce((select sum((e.value->>0)::numeric + (e.value->>1)::numeric)
              from jsonb_each(case when jsonb_typeof(d.data->'stats') = 'object' then d.data->'stats' else '{}'::jsonb end) e), 0),
    coalesce((select sum((e.value->>0)::numeric)
              from jsonb_each(case when jsonb_typeof(d.data->'stats') = 'object' then d.data->'stats' else '{}'::jsonb end) e), 0),
    case when jsonb_typeof(d.data->'errors') = 'array' then jsonb_array_length(d.data->'errors') else 0 end,
    d.updated_at
  from public.profiles p left join public.user_data d on d.user_id = p.id
  order by p.created_at desc;
end $$;

create or replace function public.admin_user_data(target uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  return (select data from public.user_data where user_id = target);
end $$;

create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if new_role not in ('user', 'admin') then raise exception 'rôle inconnu'; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'Tu ne peux pas retirer ton propre rôle admin.'; end if;
  update public.profiles set role = new_role where id = target;
end $$;

create or replace function public.admin_set_blocked(target uuid, b boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Tu ne peux pas bloquer ton propre compte.'; end if;
  update public.profiles set blocked = b where id = target;
  update auth.users set banned_until = case when b then now() + interval '100 years' else null end where id = target;
end $$;

create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'accès refusé' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Tu ne peux pas supprimer ton propre compte ici.'; end if;
  delete from auth.users where id = target;
end $$;

-- 7. Droits d'exécution : seulement les utilisateurs connectés (jamais anonymes)
revoke all on function public.touch(), public.delete_me(), public.admin_users(), public.admin_user_data(uuid),
  public.admin_set_role(uuid, text), public.admin_set_blocked(uuid, boolean), public.admin_delete_user(uuid),
  public.is_admin(), public.is_active() from public, anon;
grant execute on function public.touch(), public.delete_me(), public.admin_users(), public.admin_user_data(uuid),
  public.admin_set_role(uuid, text), public.admin_set_blocked(uuid, boolean), public.admin_delete_user(uuid),
  public.is_admin(), public.is_active() to authenticated;
