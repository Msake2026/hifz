# Activer les comptes (Supabase) — à faire une seule fois

1. Crée un compte gratuit sur https://supabase.com puis **New project** (région Europe, mot de passe de base de données à garder).
2. **SQL Editor → New query** : colle tout le fichier `schema.sql` et clique **Run**.
3. **Authentication → Providers → Email** : laisse **Confirm email** activé (c'est ce qui protège le compte admin) et mets un mot de passe minimum de 8 caractères.
4. **Authentication → URL Configuration** : *Site URL* = `https://msake2026.github.io/hifz/` ; ajoute la même adresse dans *Redirect URLs*.
5. **Project Settings → API** : copie **Project URL** et la clé **anon / publishable** dans `config.js` (jamais la clé `service_role`), puis publie (git push).
6. Sur le site : **Réglages → Compte → Créer un compte** avec `amrouniali@gmail.com`, clique le lien reçu par e-mail : ce compte devient **admin** automatiquement (e-mail confirmé). Le menu « Espace admin » apparaît alors.

L'administrateur initial se change dans `schema.sql` (fonction `bootstrap_admin_email`). D'autres admins se nomment depuis l'espace admin.

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

Restaurer : `gpg -d hifz-backup-….tar.gz.gpg | tar xz`, puis, dans un projet neuf, exécuter `public.sql` dans le SQL Editor (les messages « already exists » sont sans gravité), puis relancer `schema.sql` et `push.sql` (ils peuvent être relancés sans risque) pour recréer les déclencheurs sur les comptes. Les comptes eux-mêmes (mots de passe) restent gérés par Supabase : si le projet est perdu, les personnes recréent leur compte, et `auth_users_ids.csv` permet de rattacher leurs anciennes données à leur e-mail.

GitHub désactive les tâches planifiées d'un dépôt sans activité pendant 60 jours : un commit ou un lancement manuel les réactive.

