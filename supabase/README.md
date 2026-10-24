# Activer les comptes (Supabase) — à faire une seule fois

1. Crée un compte gratuit sur https://supabase.com puis **New project** (région Europe, mot de passe de base de données à garder).
2. **SQL Editor → New query** : colle tout le fichier `schema.sql` et clique **Run**.
3. **Authentication → Providers → Email** : laisse **Confirm email** activé (c'est ce qui protège le compte admin) et mets un mot de passe minimum de 8 caractères. Les règles de composition (minuscule, majuscule, chiffre, caractère spécial) se règlent au même endroit (*Password requirements*) : l'application lit le refus de Supabase et dit précisément ce qui manque.
4. **Authentication → URL Configuration** : *Site URL* = `https://msake2026.github.io/tathbit/` ; ajoute la même adresse dans *Redirect URLs*.
5. **Project Settings → API** : copie **Project URL** et la clé **anon / publishable** dans `config.js` (jamais la clé `service_role`), puis publie (git push).
6. Sur le site : **Réglages → Compte → Créer un compte** avec `tathbit.app.contact@gmail.com`, clique le lien reçu par e-mail : ce compte devient **admin** automatiquement (e-mail confirmé). Le menu « Espace admin » apparaît alors.

L'administrateur initial se change dans `schema.sql` (fonction `bootstrap_admin_email`). D'autres admins se nomment depuis l'espace admin.

## Rôle enseignant (facultatif)

1. Dans le SQL Editor, exécute `teacher.sql` (après `schema.sql` ; relançable sans risque).
2. Deux façons de nommer un enseignant : l'utilisateur clique **Compte → Devenir enseignant → Demander à devenir enseignant** et tu **Acceptes** ou **Refuses** dans l'Espace admin (carte « Demandes d'enseignant ») ; ou tu le fais toi-même : Espace admin → un compte → **Nommer enseignant**. (Après la mise à jour, relance `teacher.sql`.)

**Être prévenu d'une demande** : la fonction `send-reminders` (même passage toutes les 5 minutes que les rappels) envoie une notification à tes appareils admin (il faut avoir activé les rappels dessus) et un e-mail à tous les admins. Après mise à jour : 1) relance `teacher.sql` ; 2) *Edge Functions → send-reminders* : colle le nouveau `index.ts` et redéploie ; 3) pour l'e-mail, ajoute deux secrets (*Edge Functions → Secrets*) : `SMTP_USER` = l'adresse Gmail d'envoi, `SMTP_PASS` = son mot de passe d'application Google (celui déjà utilisé pour l'envoi des e-mails de compte). Sans ces deux secrets, seule la notification part.
3. L'élève ouvre l'onglet **Élève → Inviter un enseignant** et donne le code (8 caractères, valable 7 jours, usage unique). L'enseignant le saisit dans l'onglet **Enseignant**.
4. L'enseignant ne voit qu'un résumé (régularité, progression par sourate, erreurs fréquentes), jamais les réponses tapées ni les réglages ; chaque consultation est notée dans un journal que l'élève lit. Seul l'enseignant met fin au suivi (« Retirer » dans sa liste) ; l'élève ne peut pas retirer son enseignant, mais peut supprimer son compte. 5. L'enseignant décide ensuite, sans acceptation de l'élève : il fixe des **objectifs** (une sourate ou plusieurs, de … à …, + date limite, 5 en cours au plus par élève) et envoie des **messages** (280 caractères, 10 par jour et par élève ; l'élève peut les supprimer). Pour une classe, il crée un **code de classe** réutilisable (40 élèves, 30 jours) : chaque élève le saisit lui-même, ce qui crée son lien d'accès (consentement conservé, retirable à tout moment).
6. **Cloche** (en haut à droite pour tout compte connecté, administrateur compris) : liste ce qui n'est pas encore traité (nouveau message, réponse, objectif, demande d'enseignant à valider, élève arrivé en classe, fin de suivi…), avec « Ouvrir », « ✓ Traité » et « Tout marquer comme traité ». Les messages d'une même personne se regroupent ; lire la conversation ou accepter/refuser une demande traite la notification. Stockée dans la table `notifications` (écrite seulement par les fonctions SQL, lisible par son destinataire, effacée après 60 jours). L'enseignant peut aussi écrire **à toute sa classe** d'un coup (`teacher_message_all`).
   Les **rappels de révision** envoyés par `send-reminders` apparaissent aussi dans la cloche tant que la personne n'a pas révisé ce jour-là ou ouvert la notification (il faut redéployer `index.ts`).
7. **Résumé de la semaine** (facultatif, chacun pour soi) : Compte → « Résumé de la semaine ». La fonction `send-reminders` envoie un e-mail le dimanche (16 h à 19 h UTC) aux personnes qui l'ont activé ; il faut les secrets `SMTP_USER` et `SMTP_PASS` (voir ci-dessus). Tout est dans `teacher.sql` : relance-le, puis colle le nouveau `index.ts` de la fonction.
Les règles sont testées sur un vrai PostgreSQL (`tests/` + workflow `sql-tests`).

---

# Rappels par notification (facultatif) — à faire une seule fois

Les rappels envoient une notification chaque jour à l'heure choisie, **seulement si l'utilisateur n'a pas encore révisé ce jour-là**. Sur iPhone, ils ne marchent que pour l'application **installée sur l'écran d'accueil** (iOS 16.4 ou plus récent).

1. **SQL Editor** : colle et lance `supabase/push.sql` (table des abonnements et fonctions).
2. **Database → Extensions** : active **pg_cron** et **pg_net**.
3. **Edge Functions → Deploy a new function** : nom exact `send-reminders`, colle le contenu de `supabase/functions/send-reminders/index.ts`, désactive **Verify JWT**, puis déploie.
4. **Edge Functions → Secrets** : ajoute `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et `CRON_SECRET`. Leurs valeurs sont dans le fichier **`supabase/secrets.local.txt`** de ton ordinateur (ignoré par git : ne le publie jamais, la clé privée est secrète).
5. **SQL Editor** : colle et lance le fichier **`supabase/cron.local.sql`** (aussi ignoré par git) : il programme l'envoi toutes les 5 minutes.
6. Sur l'iPhone, dans l'application installée : Réglages → Rappels → Activer, choisis une heure dans 5 à 10 minutes et attends la notification.

La clé publique des notifications est dans `config.js` (`vapidPublicKey`). Pour changer de clés : génère-en d'autres, mets à jour `config.js` et les secrets, puis demande aux utilisateurs de réactiver les rappels.

**Mise à jour (2e rappel facultatif)** : si tu avais déjà lancé `push.sql`, relance-le (il ajoute les colonnes `remind_time2`/`last_sent2` et remplace `push_subscribe`), puis redéploie la fonction `send-reminders` avec le nouveau `index.ts`.

## Sauvegarde automatique de la base

Le plan gratuit de Supabase ne fait pas de sauvegarde que tu puisses restaurer toi-même. Le dépôt contient donc `.github/workflows/backup.yml` : chaque nuit (et sur demande), GitHub exporte les tables du site (`profiles`, `user_data`, `push_subs`…) et la correspondance id ↔ e-mail des comptes (sans mots de passe), puis **chiffre** le tout. Le dépôt étant public, une sauvegarde non chiffrée serait lisible par tous : ne retire jamais le chiffrement.

Mise en route (une fois) :
1. Supabase → **Connect** → onglet **Session pooler** (adresse compatible IPv4, nécessaire pour GitHub) : copie l'URI et remplace `[YOUR-PASSWORD]` par le mot de passe de la base (Project Settings → Database → Reset database password si tu l'as perdu).
2. GitHub → dépôt → **Settings → Secrets and variables → Actions → New repository secret** : crée `SUPABASE_DB_URL` (cette URI) et `BACKUP_PASSPHRASE` (phrase secrète d'au moins 20 caractères, garde-la aussi dans ton gestionnaire de mots de passe : sans elle la sauvegarde est illisible).
3. Onglet **Actions → Sauvegarde de la base → Run workflow** pour un premier essai. Un fichier `sauvegarde-chiffree` apparaît dans la page de l'exécution (conservé 30 jours ; télécharge-en un de temps en temps ailleurs).

Restaurer : `gpg -d tathbit-backup-….tar.gz.gpg | tar xz`, puis, dans un projet neuf, exécuter `public.sql` dans le SQL Editor (les messages « already exists » sont sans gravité), puis relancer `schema.sql` et `push.sql` (ils peuvent être relancés sans risque) pour recréer les déclencheurs sur les comptes. Les comptes eux-mêmes (mots de passe) restent gérés par Supabase : si le projet est perdu, les personnes recréent leur compte, et `auth_users_ids.csv` permet de rattacher leurs anciennes données à leur e-mail.

GitHub désactive les tâches planifiées d'un dépôt sans activité pendant 60 jours : un commit ou un lancement manuel les réactive.

## E-mails de confirmation fiables (service d'envoi)

Sans réglage, Supabase envoie les e-mails (confirmation, mot de passe oublié) avec son serveur d'essai : d'après sa documentation, **2 messages par heure** seulement, **uniquement vers les membres de l'équipe du projet** (les autres reçoivent « Email address not authorized »), sans garantie de livraison. Pour inviter du monde, il faut brancher un vrai service d'envoi (SMTP).

Avec **Resend** (recommandé par Supabase ; plan gratuit : 3 000 e-mails/mois et 100/jour d'après resend.com/pricing). Il faut un **nom de domaine à toi** : Resend envoie depuis un domaine vérifié, jamais depuis une adresse Gmail. Mieux vaut un sous-domaine (ex. `mail.ton-domaine.fr`) pour isoler la réputation d'envoi.
1. resend.com → créer le compte → **Domains → Add Domain** → ajouter les enregistrements DNS demandés chez ton registraire, puis **Verify**.
2. Resend → **API Keys → Create API Key** (accès « Sending access ») : copie la clé (elle commence par `re_`).
3. Supabase → **Authentication → Emails → SMTP Settings** (le menu peut s'appeler « Auth → SMTP ») → activer **Custom SMTP** :
   - Sender email : une adresse de ton domaine, ex. `noreply@mail.ton-domaine.fr` · Sender name : `Tathbīt`
   - Host : `smtp.resend.com` · Port : `465` · Username : `resend` · Password : la clé API.
4. Supabase → **Authentication → Rate Limits** : avec un SMTP personnalisé, la limite démarre à 30 e-mails/heure ; relève-la si besoin.
5. **Authentication → URL Configuration** : *Site URL* = `https://msake2026.github.io/tathbit/` ; ajoute la même adresse dans *Redirect URLs*.
6. **Authentication → Emails → Templates** : colle le contenu de `supabase/emails/confirm-signup.html` (modèle « Confirm sign up », sujet : `Confirm your email · Tathbīt`) et de `supabase/emails/reset-password.html` (modèle « Reset password », sujet : `Reset your password · Tathbīt`). Le message contient les trois langues (français, anglais, arabe) et le sujet est toujours en anglais (Supabase n'accepte qu'un seul sujet par modèle).
7. Test : crée un compte avec une adresse qui n'est pas dans l'équipe Supabase ; l'e-mail doit arriver (regarde les courriers indésirables). Dans l'application, le bouton « Renvoyer l'e-mail de confirmation » apparaît après l'inscription ou si la connexion est refusée parce que l'e-mail n'est pas confirmé (une relance toutes les 60 s au plus).

### Variante sans nom de domaine : Gmail comme service d'envoi

Pour démarrer gratuitement (environ 500 e-mails par jour pour un compte Gmail personnel d'après des sources tierces ; non confirmé par la documentation de Supabase) :
1. Crée un compte Gmail **dédié** à Tathbīt (ne réutilise pas ton adresse principale).
2. Active la **validation en deux étapes** (myaccount.google.com → Sécurité). Sans elle, les mots de passe d'application n'existent pas. Ils ne sont pas proposés avec des clés de sécurité seules, un compte professionnel/scolaire ou la Protection avancée.
3. Ouvre https://myaccount.google.com/apppasswords, donne un nom (ex. « Tathbīt Supabase ») : Google affiche un code de 16 caractères, montré une seule fois. Changer le mot de passe du compte Google révoque ce code.
4. Supabase → Authentication → SMTP Settings → Custom SMTP : Sender email = l'adresse Gmail dédiée · Sender name = `Tathbīt` · Host = `smtp.gmail.com` · Port = `465` (ou `587`) · Username = l'adresse Gmail complète · Password = le code de 16 caractères.
5. Puis les étapes 4 à 7 ci-dessus (limite horaire, URL de site, modèles, test). Si Google bloque l'envoi ou si le nombre d'inscrits dépasse la limite quotidienne, passe à un nom de domaine et à Resend.

Ne mets jamais la clé API dans le dépôt : elle ne va que dans le champ « Password » de Supabase.

