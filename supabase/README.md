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
