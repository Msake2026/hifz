-- Tests du rôle « enseignant » sur un vrai PostgreSQL (voir .github/workflows/sql-tests.yml). Tout est annulé à la fin (rollback).
-- Peuvent aussi être lancés dans Supabase → SQL Editor après teacher.sql (ils ne laissent rien : « rollback »), en retirant la partie « stub ».
\set ON_ERROR_STOP on
begin;
create schema t;
create function t.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); execute 'set local role authenticated'; end $$;
create function t.as_super() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;
create function t.fails(q text, st text default null) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin execute q; exception when others then
    ok := true; if st is not null and sqlstate <> st then raise exception 'mauvais code % (attendu %) pour : %', sqlstate, st, q; end if;
  end;
  if not ok then raise exception 'aurait dû échouer : %', q; end if;
end $$;
grant usage on schema t to authenticated; grant execute on all functions in schema t to authenticated;

-- jeu d'essai : élève A, élève B, enseignant T1, enseignant T2, simple utilisateur U, administrateur ADM
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'eleve.a@x.fr'), ('00000000-0000-0000-0000-00000000000b', 'eleve.b@x.fr'),
  ('00000000-0000-0000-0000-0000000000f1', 'prof1@x.fr'),   ('00000000-0000-0000-0000-0000000000f2', 'prof2@x.fr'),
  ('00000000-0000-0000-0000-0000000000c1', 'user@x.fr'),    ('00000000-0000-0000-0000-0000000000ad', 'adm@x.fr');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
update public.profiles set role = 'admin'   where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.user_data (user_id, data) values
  ('00000000-0000-0000-0000-00000000000a', '{"stats":{"2:5":[3,1],"3:9":[0,2]},"days":{"2026-10-20":12},"cfg":{"secret":"réglage"},"custom":[{"t":"texte perso"}],
     "errors":[{"t":1000,"k":"2:5","m":"cloze","sc":0,"ans":"réponse tapée","bad":["x"]},{"t":2000,"k":"3:9","m":"next","sc":0.5,"ans":"autre"}]}'),
  ('00000000-0000-0000-0000-00000000000b', '{"stats":{"1:1":[9,0]},"days":{},"errors":[]}');

do $$ declare a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b'; f1 uuid := '00000000-0000-0000-0000-0000000000f1';
  f2 uuid := '00000000-0000-0000-0000-0000000000f2'; c1 uuid := '00000000-0000-0000-0000-0000000000c1'; ad uuid := '00000000-0000-0000-0000-0000000000ad';
  code text; code2 text; n int; r jsonb; exp timestamptz;
begin
  -- 1. invitation : code de 8 caractères (alphabet sans ambiguïtés), 7 jours, visible seulement de son auteur ; 5 en cours au plus
  perform t.as_user(a);
  select i.code, i.expires_at into code, exp from public.invite_create() i;
  assert code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$', 'format du code : ' || code;
  assert exp > now() + interval '6 days 23 hours' and exp < now() + interval '7 days 1 hour', 'durée de validité';
  assert (select count(*) from public.teacher_invites) = 1, 'élève A voit son invitation';
  perform t.as_user(b); assert (select count(*) from public.teacher_invites) = 0, 'élève B ne voit pas l''invitation de A';
  perform t.as_user(a); for n in 1..4 loop perform public.invite_create(); end loop;
  perform t.fails('select public.invite_create()', 'P0001');                 -- 6e invitation en cours : refusée
  perform t.as_user(c1); perform t.fails('select public.invite_accept(''' || code || ''')', '42501');   -- pas enseignant
  perform t.as_super(); perform t.fails('select public.invite_create()', '42501');                      -- non connecté

  -- 2. écritures directes interdites pour tous les rôles
  perform t.as_user(a);
  perform t.fails('insert into public.teacher_links (teacher_id, student_id) values (''' || f1 || ''', ''' || a || ''')');
  perform t.fails('insert into public.teacher_invites (code, student_id, expires_at) values (''ZZZZZZZZ'', ''' || a || ''', now())');
  perform t.fails('delete from public.teacher_invites');
  perform t.fails('update public.profiles set role = ''teacher'' where id = ''' || a || '''');
  perform t.as_user(f1);
  perform t.fails('insert into public.teacher_links (teacher_id, student_id) values (''' || f1 || ''', ''' || a || ''')');

  -- 3. l'enseignant accepte le code : lien créé, code à usage unique
  perform t.as_user(f1);
  assert (select count(*) from public.invite_accept(code)) = 1, 'acceptation';
  perform t.fails('select public.invite_accept(''' || code || ''')', 'P0001');            -- déjà utilisé
  perform t.fails('select public.invite_accept(''abcd1234'')', 'P0001');                  -- inconnu
  assert (select email from public.links_mine() where as_role = 'student') = 'eleve.a@x.fr', 'l''enseignant voit son élève';
  perform t.as_user(a); assert (select email from public.links_mine() where as_role = 'teacher') = 'prof1@x.fr', 'l''élève voit son enseignant';
  assert (select count(*) from public.teacher_links) = 1;
  perform t.as_user(f2); assert (select count(*) from public.teacher_links) = 0, 'un autre enseignant ne voit pas ce lien';
  perform t.as_user(b); assert (select count(*) from public.teacher_links) = 0, 'un autre élève ne voit pas ce lien';
  -- code expiré / son propre code
  perform t.as_super(); insert into public.teacher_invites (code, student_id, expires_at) values ('EXPIRE22', a, now() - interval '1 minute'), ('MONCODE2', f1, now() + interval '1 day');
  perform t.as_user(f2); perform t.fails('select public.invite_accept(''EXPIRE22'')', 'P0001');
  perform t.as_user(f1); perform t.fails('select public.invite_accept(''MONCODE2'')', 'P0001');       -- on ne peut pas être son propre enseignant

  -- 4. données : seulement un résumé, seulement pour un élève lié ; jamais d'accès direct aux tables
  perform t.as_user(f1);
  r := public.teacher_student_data(a);
  assert r->>'email' = 'eleve.a@x.fr' and (r->'stats'->'2:5'->>0) = '3', 'statistiques';
  assert jsonb_array_length(r->'errors') = 2 and (r->'errors'->0->>'t') = '2000', 'erreurs, les plus récentes d''abord';
  assert not (r->'errors'->0 ? 'ans') and not (r->'errors'->1 ? 'ans'), 'les réponses tapées ne sont pas transmises';
  assert not (r ? 'cfg') and not (r ? 'custom') and not (r::text like '%réglage%') and not (r::text like '%texte perso%'), 'ni réglages ni textes ajoutés';
  assert (select count(*) from public.user_data) = 0, 'aucun accès direct à user_data';
  assert (select count(*) from public.profiles where id <> f1) = 0, 'aucun accès direct aux profils des autres';
  perform t.fails('select public.teacher_student_data(''' || b || ''')', '42501');          -- élève non lié
  perform t.as_user(f2); perform t.fails('select public.teacher_student_data(''' || a || ''')', '42501');   -- autre enseignant
  perform t.as_user(c1); perform t.fails('select public.teacher_student_data(''' || a || ''')', '42501');   -- simple utilisateur
  perform t.fails('select * from public.teacher_students()', '42501');
  perform t.as_user(ad); perform t.fails('select public.teacher_student_data(''' || a || ''')', '42501');   -- même un admin doit être enseignant ET lié
  perform t.as_user(f1); assert (select count(*) from public.teacher_students()) = 1 and (select answers from public.teacher_students()) = 6, 'liste des élèves (total des réponses)';

  -- 5. journal : une ligne par heure et par élève, lisible par l'élève seulement
  perform t.as_user(f1); perform public.teacher_student_data(a); perform public.teacher_student_data(a);
  perform t.as_user(a); assert (select count(*) from public.access_log_mine()) = 1, 'une seule ligne de journal par heure';
  assert (select teacher_email from public.access_log_mine()) = 'prof1@x.fr';
  perform t.as_user(b); assert (select count(*) from public.access_log_mine()) = 0 and (select count(*) from public.teacher_access_log) = 0;
  perform t.as_user(f1); assert (select count(*) from public.teacher_access_log) = 0, 'l''enseignant ne lit pas le journal';

  -- 6. retrait : par l'élève, l'accès disparaît tout de suite
  perform t.as_user(f2); perform public.link_revoke(a); perform t.as_user(f1); assert (select count(*) from public.teacher_students()) = 1, 'un tiers ne peut pas retirer un lien';
  perform t.as_user(a); perform public.link_revoke(f1);
  perform t.as_user(f1); perform t.fails('select public.teacher_student_data(''' || a || ''')', '42501'); assert (select count(*) from public.teacher_students()) = 0;
  -- retrait par l'enseignant (nouveau lien)
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform t.as_user(f1); perform public.invite_accept(code2);
  assert (select count(*) from public.teacher_students()) = 1; perform public.link_revoke(b); assert (select count(*) from public.teacher_students()) = 0, 'l''enseignant peut se retirer';
  -- annulation d'une invitation
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform public.invite_cancel(code2);
  perform t.as_user(f1); perform t.fails('select public.invite_accept(''' || code2 || ''')', 'P0001');

  -- 7. rôles : seul un admin nomme un enseignant ; retirer le rôle ou bloquer coupe l'accès
  perform t.as_user(a); perform t.fails('select public.admin_set_role(''' || a || ''', ''teacher'')', '42501');
  perform t.as_user(ad); perform public.admin_set_role(c1, 'teacher'); assert (select role from public.profiles where id = c1) = 'teacher'; perform t.fails('select public.admin_set_role(''' || c1 || ''', ''roi'')');
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform t.as_user(f1); perform public.invite_accept(code2);
  perform t.as_super(); update public.profiles set role = 'user' where id = f1;
  perform t.as_user(f1); perform t.fails('select public.teacher_student_data(''' || b || ''')', '42501'); perform t.as_user(b); assert (select count(*) from public.links_mine() where as_role = 'teacher') = 0, 'enseignant sans rôle : plus visible';
  perform t.as_super(); update public.profiles set role = 'teacher' where id = f1; update public.profiles set blocked = true where id = b;
  perform t.as_user(f1); perform t.fails('select public.teacher_student_data(''' || b || ''')', '42501'); assert (select count(*) from public.teacher_students()) = 0, 'élève bloqué : invisible';
  perform t.as_super(); update public.profiles set blocked = false where id = b; update public.profiles set blocked = true where id = f1;
  perform t.as_user(f1); perform t.fails('select public.teacher_student_data(''' || b || ''')', '42501');

  -- 8. suppression d'un compte élève : le lien et le journal partent avec lui
  perform t.as_super(); update public.profiles set blocked = false where id = f1; delete from auth.users where id = a;
  assert (select count(*) from public.teacher_access_log where student_id = a) = 0 and (select count(*) from public.teacher_links where student_id = a) = 0, 'cascade à la suppression';
  raise notice 'tous les tests du rôle enseignant sont passés';
end $$;
rollback;
