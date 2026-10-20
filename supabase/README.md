# Activer les comptes (Supabase) — à faire une seule fois

1. Crée un compte gratuit sur https://supabase.com puis **New project** (région Europe, mot de passe de base de données à garder).
2. **SQL Editor → New query** : colle tout le fichier `schema.sql` et clique **Run**.
3. **Authentication → Providers → Email** : laisse **Confirm email** activé (c'est ce qui protège le compte admin) et mets un mot de passe minimum de 8 caractères.
4. **Authentication → URL Configuration** : *Site URL* = `https://msake2026.github.io/hifz/` ; ajoute la même adresse dans *Redirect URLs*.
5. **Project Settings → API** : copie **Project URL** et la clé **anon / publishable** dans `config.js` (jamais la clé `service_role`), puis publie (git push).
6. Sur le site : **Réglages → Compte → Créer un compte** avec `amrouniali@gmail.com`, clique le lien reçu par e-mail : ce compte devient **admin** automatiquement (e-mail confirmé). Le menu « Espace admin » apparaît alors.

L'administrateur initial se change dans `schema.sql` (fonction `bootstrap_admin_email`). D'autres admins se nomment depuis l'espace admin.
