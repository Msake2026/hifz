-- Simule le strict nécessaire de Supabase (schéma « auth », rôles) pour exécuter les vrais fichiers SQL sur un PostgreSQL ordinaire (tests).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, banned_until timestamptz);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;       -- comme Supabase : les règles RLS font le tri
alter default privileges in schema public grant all on sequences to anon, authenticated;
