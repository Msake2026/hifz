# Avant d'ouvrir Hifz au public

À relire le jour où tu invites du monde (ce que le code peut vérifier seul est déjà contrôlé à chaque `git push`).

## Surveillance automatique (déjà en place)
- **Sauvegarde nocturne** (`backup.yml`) : en cas d'échec, un ticket « surveillance » est ouvert dans le dépôt (GitHub t'écrit alors par e-mail).
- **Fraîcheur** (`monitor.yml`, chaque jour) : si la dernière sauvegarde réussie a plus de 36 h ou n'existe pas, ticket « surveillance ».
- **Lisibilité** (`verify-backup.yml`, chaque dimanche) : la dernière sauvegarde est déchiffrée et son contenu contrôlé ; ticket en cas de problème.
- **Tests** à chaque envoi : le contrôle de confidentialité échoue si l'application contacte un nouveau service qui n'est pas cité dans la page « Confidentialité et conditions ».
- **E-mails** : l'espace admin affiche le nombre d'inscriptions sur 1 h et 24 h face aux limites (Supabase 30 e-mails par heure par défaut, Gmail environ 500 par jour) et te dit quand prévoir un nom de domaine avec Resend (dès 40 comptes).

## À vérifier toi-même (le code ne peut pas le faire)
1. **Notifications GitHub** : https://github.com/settings/notifications → « Actions » : coche « Send notifications for failed workflows only » (et la case e-mail). Les tickets « surveillance » arrivent par e-mail si tu surveilles le dépôt (bouton **Watch** → *All Activity* ou *Custom → Issues*).
2. **Page de confidentialité** : relis-la en entier, dans les trois langues, avec les yeux de quelqu'un qui s'inscrit ; vérifie que l'adresse de contact reçoit bien ses e-mails. Je ne peux pas certifier sa conformité juridique : en cas de doute, fais-la relire (CNIL : cnil.fr).
3. **Supabase** : *Authentication → Providers → Email → Confirm email* activé ; *Rate Limits* adaptées ; au moins **deux administrateurs** (pour ne pas te verrouiller dehors) ; mot de passe de la base noté dans ton gestionnaire.
4. **Gmail comme expéditeur** : fonctionne pour quelques dizaines de personnes. Au-delà, ou si Google bloque l'envoi : nom de domaine + Resend (`supabase/README.md`).
5. **Sauvegarde** : télécharge de temps en temps un fichier du dossier *Artifacts* (30 jours de conservation seulement) et garde ta phrase secrète `BACKUP_PASSPHRASE` ailleurs.
6. **Essai complet sur un iPhone** : installer l'application, créer un compte, recevoir l'e-mail, activer un rappel, télécharger une sourate hors ligne.

GitHub désactive les tâches planifiées d'un dépôt sans activité pendant 60 jours : un envoi (`git push`) ou un lancement manuel les réactive (GitHub t'écrit avant de le faire).
