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
  update public.profiles set role = 'teacher' where id = a; get diagnostics n = row_count; assert n = 0, 'un utilisateur ne peut pas se donner un rôle (aucune ligne modifiée)';
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

  -- 6. retrait : seul l'enseignant met fin au suivi (l'élève ne le peut pas), l'accès disparaît tout de suite
  perform t.as_user(f2); perform public.link_revoke(a); perform t.as_user(f1); assert (select count(*) from public.teacher_students()) = 1, 'un tiers ne peut pas retirer un lien';
  perform t.as_user(a); perform public.link_revoke(f1); perform t.as_user(f1); assert (select count(*) from public.teacher_students()) = 1, 'l''élève ne peut pas retirer son enseignant';
  perform public.link_revoke(a);
  perform t.fails('select public.teacher_student_data(''' || a || ''')', '42501'); assert (select count(*) from public.teacher_students()) = 0;
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

  -- 7 bis. demande pour devenir enseignant
  perform t.as_super(); update public.profiles set blocked = false, role = 'user' where id in (f1, c1);
  perform t.as_user(f1); perform public.teacher_request(); perform public.teacher_request(); assert (select count(*) from public.teacher_requests) = 1, 'une seule demande par personne, et visible par elle seule';
  perform t.as_user(c1); assert (select count(*) from public.teacher_requests) = 0, 'les demandes des autres sont invisibles'; perform public.teacher_request();
  perform t.fails('select count(*) from public.admin_teacher_requests()', '42501'); perform t.fails('select public.admin_teacher_decline(''' || f1 || ''')', '42501');
  perform t.fails('insert into public.teacher_requests (user_id) values (''' || a || ''')'); perform t.fails('select public.admin_set_role(''' || c1 || ''', ''teacher'')', '42501');
  perform t.as_user(ad); assert (select count(*) from public.admin_teacher_requests()) = 2, 'l''admin voit les demandes';
  perform public.admin_set_role(f1, 'teacher'); assert (select count(*) from public.admin_teacher_requests()) = 1 and (select role from public.profiles where id = f1) = 'teacher', 'accepter = rôle donné, demande effacée';
  perform public.admin_teacher_decline(c1); assert (select count(*) from public.admin_teacher_requests()) = 0, 'refuser efface la demande';
  perform t.as_user(f1); perform t.fails('select public.teacher_request()');   -- déjà enseignant
  perform t.as_user(c1); perform public.teacher_request(); perform public.teacher_request_cancel(); assert (select count(*) from public.teacher_requests) = 0, 'annulation par l''utilisateur';
  perform t.as_super(); update public.profiles set blocked = true where id = c1; perform t.as_user(c1); perform t.fails('select public.teacher_request()', '42501');
  perform t.as_super(); update public.profiles set blocked = false where id = c1;

  -- 7 ter. messages, objectifs (l'enseignant décide, sans acceptation) et groupe de classe
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform t.as_user(f1); perform public.invite_accept(code2);
  perform public.teacher_message_send(b, '  Courage, relis la sourate 78 !  ');
  perform t.fails('select public.teacher_message_send(''' || a || ''', ''hors lien'')', '42501'); perform t.fails('select public.teacher_message_send(''' || b || ''', '''')', 'P0001'); perform t.fails('select public.teacher_message_send(''' || b || ''', ''' || repeat('x', 281) || ''')', 'P0001');
  perform t.as_user(c1); perform t.fails('select public.teacher_message_send(''' || b || ''', ''intrus'')', '42501');
  assert (select count(*) from public.messages_mine()) = 0 and (select count(*) from public.teacher_messages) = 0, 'les messages des autres sont invisibles';
  perform t.as_user(b); assert (select count(*) from public.messages_mine()) = 1 and (select body from public.messages_mine()) = 'Courage, relis la sourate 78 !', 'l''élève lit le message';
  perform t.fails('insert into public.teacher_messages (teacher_id, student_id, body) values (''' || f1 || ''', ''' || b || ''', ''x'')');
  perform t.as_user(f1); for i in 1..9 loop perform public.teacher_message_send(b, 'm' || i); end loop; perform t.fails('select public.teacher_message_send(''' || b || ''', ''trop'')', 'P0001');
  perform t.as_user(b); perform public.message_delete((select id from public.messages_mine() limit 1)); assert (select count(*) from public.messages_mine()) = 9, 'l''élève supprime un message';
  perform t.as_user(f1); perform public.teacher_goal_set(b, 78, current_date + 7, 'avant dimanche');
  perform t.fails('select public.teacher_goal_set(''' || a || ''', 78, current_date + 7)', '42501'); perform t.fails('select public.teacher_goal_set(''' || b || ''', 115, current_date + 7)', 'P0001'); perform t.fails('select public.teacher_goal_set(''' || b || ''', 78, current_date - 1)', 'P0001');
  for i in 1..4 loop perform public.teacher_goal_set(b, i, current_date + i); end loop; perform t.fails('select public.teacher_goal_set(''' || b || ''', 9, current_date + 9)', 'P0001');
  assert (select count(*) from public.goals_for(b)) = 5, 'l''enseignant voit ses objectifs'; perform t.fails('select * from public.goals_for(''' || a || ''')', '42501');
  perform t.as_user(b); assert (select count(*) from public.goals_for()) = 5 and (select surah from public.goals_for() order by due, id limit 1) = 1, 'l''élève voit ses objectifs sans rien accepter'; 
  perform public.goal_delete((select id from public.goals_for() limit 1)); assert (select count(*) from public.goals_for()) = 5, 'l''élève ne supprime pas un objectif';
  perform t.as_user(f1); perform public.goal_delete((select id from public.goals_for(b) limit 1)); assert (select count(*) from public.goals_for(b)) = 4, 'l''enseignant supprime un objectif';
  perform t.as_super(); update public.teacher_goals set due = current_date - 31 where id = (select min(id) from public.teacher_goals);
  perform t.as_user(f1); assert (select count(*) from public.goals_for(b)) = 3, 'un objectif échu depuis plus de 30 jours disparaît';
  perform t.as_user(b); perform public.link_revoke(f1); assert (select count(*) from public.links_mine() where as_role = 'teacher') = 1, 'toujours lié après une tentative de l''élève';
  perform t.as_user(f1); perform public.link_revoke(b); perform t.as_user(b); assert (select count(*) from public.messages_mine()) = 0 and (select count(*) from public.goals_for()) = 0, 'lien coupé : messages et objectifs ne s''affichent plus';
  perform t.as_user(f1); perform t.fails('select public.teacher_message_send(''' || b || ''', ''après'')', '42501');
  -- groupe de classe
  perform t.as_user(f1); select c.code into code2 from public.class_create() c; assert length(code2) = 8 and (select count(*) from public.class_mine()) = 1;
  perform t.as_user(c1); perform t.fails('select public.class_create()', '42501'); assert (select count(*) from public.class_mine()) = 0 and (select count(*) from public.teacher_classes) = 0, 'le code de classe n''est lisible que de l''enseignant';
  perform t.as_user(b); perform public.class_join(lower(code2)); perform t.as_user(a); perform public.class_join(code2); perform t.as_user(b); perform public.class_join(code2);
  perform t.as_user(f1); assert (select uses from public.class_mine()) = 2, 'deux élèves, pas de double comptage'; assert (select count(*) from public.teacher_students()) = 2, 'le code de classe crée les liens';
  perform t.as_user(f1); perform t.fails('select public.class_join(''' || code2 || ''')', 'P0001');       -- son propre code
  perform t.as_user(c1); perform t.fails('select public.class_join(''ZZZZZZZZ'')', 'P0001');
  perform t.as_super(); update public.teacher_classes set max_uses = 2 where teacher_classes.code = code2; perform t.as_user(c1); perform t.fails('select public.class_join(''' || code2 || ''')', 'P0001');
  perform t.as_super(); update public.teacher_classes set max_uses = 40, expires_at = now() - interval '1 minute' where teacher_classes.code = code2; perform t.as_user(c1); perform t.fails('select public.class_join(''' || code2 || ''')', 'P0001');
  perform t.as_super(); update public.teacher_classes set expires_at = now() + interval '1 day' where teacher_classes.code = code2; update public.profiles set role = 'user' where id = f1; perform t.as_user(c1); perform t.fails('select public.class_join(''' || code2 || ''')', 'P0001');
  perform t.as_super(); update public.profiles set role = 'teacher' where id = f1; perform t.as_user(f1); perform public.class_close(code2); assert (select count(*) from public.class_mine()) = 0, 'code fermé';
  perform t.as_user(f1); for i in 1..3 loop perform public.class_create(); end loop; perform t.fails('select public.class_create()', 'P0001');
  perform t.as_super(); delete from public.teacher_links where teacher_id = f1;

  -- 7 quater. résumé hebdomadaire : chacun règle le sien, personne ne lit celui des autres
  perform t.as_user(c1); perform public.weekly_set(true, 'en'); perform public.weekly_set(true, 'xx');
  assert (select count(*) from public.mail_prefs) = 1 and (select lang from public.mail_prefs) = 'fr', 'langue inconnue : français';
  perform t.as_user(b); assert (select count(*) from public.mail_prefs) = 0, 'préférences des autres invisibles'; perform t.fails('insert into public.mail_prefs (user_id, weekly) values (''' || b || ''', true)');
  perform public.weekly_set(false); assert (select weekly from public.mail_prefs) = false;
  perform t.as_super(); update public.profiles set blocked = true where id = c1; perform t.as_user(c1); perform t.fails('select public.weekly_set(true)', '42501'); perform t.as_super(); update public.profiles set blocked = false where id = c1;

  -- 7 quinquies. réponses de l'élève, accusés de lecture, messages non lus ; l'administrateur n'est ni élève ni enseignant
  perform t.as_super(); update public.profiles set role = 'teacher', blocked = false where id = f1; delete from public.teacher_messages; delete from public.teacher_links where teacher_id = f1;
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform t.as_user(f1); perform public.invite_accept(code2);
  perform t.as_user(b); perform t.fails('select public.student_message_send(''' || f1 || ''', ''je parle en premier'')', 'P0001');       -- il faut que l'enseignant ait écrit d'abord
  perform t.as_user(f1); perform public.teacher_message_send(b, 'Bonjour');
  perform t.as_user(b); assert (select count(*) from public.messages_mine() where not from_student and read_at is null) = 1, 'message non lu';
  perform public.student_message_send(f1, '  Merci !  '); perform t.fails('select public.student_message_send(''' || f1 || ''', '''')', 'P0001'); perform t.fails('select public.student_message_send(''' || a || ''', ''x'')', '42501');
  perform public.messages_mark_read(); assert (select count(*) from public.messages_mine() where not from_student and read_at is not null) = 1, 'accusé de lecture par l''élève';
  perform t.as_user(f1); assert (select u.n from public.teacher_unread() u where u.student_id = b) = 1, 'réponse non lue chez l''enseignant';
  assert (select count(*) from public.teacher_thread(b)) = 2, 'la conversation compte les deux messages';
  assert (select count(*) from public.teacher_unread()) = 0, 'ouvrir la conversation marque les réponses lues';
  assert (select read_at is not null from public.teacher_thread(b) where not from_student), 'l''enseignant voit « lu »';
  perform t.fails('select * from public.teacher_thread(''' || a || ''')', '42501'); perform t.as_user(c1); perform t.fails('select * from public.teacher_thread(''' || b || ''')', '42501'); assert (select count(*) from public.teacher_unread()) = 0;
  perform t.as_user(b); for i in 1..9 loop perform public.student_message_send(f1, 'r' || i); end loop; perform t.fails('select public.student_message_send(''' || f1 || ''', ''trop'')', 'P0001');
  perform t.as_user(c1); perform t.fails('select public.student_message_send(''' || f1 || ''', ''hors lien'')', '42501');
  perform t.as_user(f1); perform public.link_revoke(b); perform t.as_user(b); perform t.fails('select public.student_message_send(''' || f1 || ''', ''après'')', '42501');
  perform t.as_user(ad); perform t.fails('select public.invite_create()', 'P0001'); perform t.fails('select public.class_join(''ZZZZZZZZ'')', 'P0001'); perform t.fails('select public.teacher_request()'); perform t.fails('select public.admin_set_role(''' || ad || ''', ''teacher'')');
  perform t.fails('select public.student_message_send(''' || f1 || ''', ''x'')', '42501');
  perform t.as_super(); delete from public.teacher_messages; delete from public.teacher_links where teacher_id = f1;

  -- 7 sexies. notifications (la cloche) et message à toute la classe
  perform t.as_super(); delete from public.notifications; delete from public.teacher_messages; delete from public.teacher_requests; delete from public.teacher_links where teacher_id in (f1, c1);
  update public.profiles set role = 'teacher', blocked = false where id = f1; update public.profiles set role = 'user', blocked = false where id in (b, c1, a);
  perform t.as_user(b); select i.code into code2 from public.invite_create() i; perform t.as_user(f1); perform public.invite_accept(code2);
  perform t.as_user(b); assert (select count(*) from public.notifs_mine() where kind = 'linked' and read_at is null and actor = 'prof1@x.fr') = 1, 'l''élève est prévenu du lien';
  perform t.as_user(f1); perform public.teacher_message_send(b, 'un'); perform public.teacher_message_send(b, 'deux');
  perform t.as_user(b); assert (select count(*) from public.notifs_mine() where kind = 'message') = 1 and (select n from public.notifs_mine() where kind = 'message') = 2, 'les messages se regroupent';
  perform t.as_user(c1); assert (select count(*) from public.notifs_mine()) = 0, 'les notifications des autres sont invisibles'; assert (select count(*) from public.notifications) = 0;
  perform t.fails('insert into public.notifications (user_id, kind) values (''' || c1 || ''', ''x'')'); perform t.fails('select public.notify(''' || c1 || ''', ''x'')');
  perform t.as_user(b); perform public.messages_mark_read(); assert (select read_at is not null from public.notifs_mine() where kind = 'message'), 'lire la conversation traite la notification';
  perform t.as_user(f1); perform public.teacher_message_send(b, 'trois'); perform t.as_user(b);
  assert (select count(*) from public.notifs_mine() where kind = 'message') = 2 and (select count(*) from public.notifs_mine() where kind = 'message' and read_at is null) = 1, 'un nouveau message crée une nouvelle notification non lue';
  perform public.student_message_send(f1, 'ok'); perform t.as_user(f1); assert (select n from public.notifs_mine() where kind = 'reply' and read_at is null) = 1, 'l''enseignant est prévenu d''une réponse';
  perform public.teacher_thread(b); assert (select count(*) from public.notifs_mine() where kind = 'reply' and read_at is null) = 0, 'ouvrir la conversation traite la réponse';
  perform public.teacher_goal_set(b, 78, current_date + 3); perform t.as_user(b); assert (select count(*) from public.notifs_mine() where kind = 'goal' and ref = '78') = 1, 'nouvel objectif';
  perform public.notif_read((select id from public.notifs_mine() where kind = 'goal')); assert (select read_at is not null from public.notifs_mine() where kind = 'goal'), 'marquer traitée';
  perform public.notifs_read_all(); assert (select count(*) from public.notifs_mine() where read_at is null) = 0, 'tout marquer comme lu';
  perform t.as_user(c1); perform public.teacher_request(); perform t.as_user(ad); assert (select count(*) from public.notifs_mine() where kind = 'request' and read_at is null and actor = 'user@x.fr') = 1, 'l''admin est prévenu d''une demande';
  perform public.admin_set_role(c1, 'teacher'); assert (select count(*) from public.notifs_mine() where kind = 'request' and read_at is null) = 0, 'accepter traite la demande';
  perform t.as_user(c1); assert (select count(*) from public.notifs_mine() where kind = 'role_teacher') = 1, 'le nouvel enseignant est prévenu';
  perform t.as_user(b); perform public.teacher_request(); perform t.as_user(ad); perform public.admin_teacher_decline(b); perform t.as_user(b); assert (select count(*) from public.notifs_mine() where kind = 'request_declined') = 1, 'refus notifié';
  perform t.as_user(f1); select c.code into code2 from public.class_create() c; perform t.as_user(a); perform public.class_join(code2); perform t.as_user(f1);
  assert (select count(*) from public.notifs_mine() where kind = 'student_joined' and actor = 'eleve.a@x.fr') = 1, 'l''enseignant est prévenu d''une arrivée en classe';
  -- message à toute la classe : b et a sont liés à f1
  perform t.as_user(f1); assert public.teacher_message_all('  Bonjour la classe  ') = 2, 'envoyé aux 2 élèves';
  perform t.as_user(a); assert (select count(*) from public.messages_mine() where body = 'Bonjour la classe') = 1 and (select count(*) from public.notifs_mine() where kind = 'message') = 1, 'chaque élève reçoit le message et une notification';
  perform t.as_user(f1); perform t.fails('select public.teacher_message_all('''')', 'P0001'); perform t.fails('select public.teacher_message_all(''' || repeat('x', 281) || ''')', 'P0001');
  perform t.as_user(c1); perform t.fails('select public.teacher_message_all(''x'')', 'P0001');                  -- enseignant sans élève
  perform t.as_user(ad); perform t.fails('select public.teacher_message_all(''x'')', '42501');
  perform t.as_user(f1); perform public.link_revoke(b); perform t.as_user(b); assert (select count(*) from public.notifs_mine() where kind = 'unlinked') = 1, 'fin du suivi notifiée';
  perform t.as_user(f1); assert public.teacher_message_all('encore') = 1, 'seuls les élèves encore liés';
  perform t.as_super(); delete from public.notifications; delete from public.teacher_messages; delete from public.teacher_links where teacher_id in (f1, c1); update public.profiles set role = 'user' where id = c1;

  -- 8. suppression d'un compte élève : le lien et le journal partent avec lui
  perform t.as_super(); update public.profiles set blocked = false where id = f1; delete from auth.users where id = a;
  assert (select count(*) from public.teacher_access_log where student_id = a) = 0 and (select count(*) from public.teacher_links where student_id = a) = 0, 'cascade à la suppression';
  raise notice 'tous les tests du rôle enseignant sont passés';
end $$;
rollback;
