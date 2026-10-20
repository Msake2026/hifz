# Hifz – tester sa mémorisation du Coran et des moutoun

Application web (un seul dossier, sans serveur) : exercices de mémorisation, historique des erreurs, révision espacée, lecteur du texte complet, audio verset par verset.

- **Coran (Ḥafṣ)** : texte uthmani du projet Tanzil via api.alquran.cloud ; audio via cdn.islamic.network.
- **Moutoun** : `moutoun.js` généré par `tools/build_moutoun.py` (Wikisource arabe, hadith-api). Texte à comparer avec ton édition.
- **Versets proches** : `mutashabihat.js`, calculé automatiquement par `tools/build_mutashabihat.py`.
- Ta progression reste sur ton appareil (localStorage) ; export/import dans Réglages.

Installation sur téléphone : ouvrir la page en HTTPS puis « Installer l'application » (Android/Chrome) ou Partager → « Sur l'écran d'accueil » (iPhone/Safari).

**Comptes et espace admin (optionnel)** : synchronisation de la progression et administration via Supabase. Mise en route : voir `supabase/README.md` ; les règles de sécurité sont dans `supabase/schema.sql` ; les deux valeurs publiques à renseigner sont dans `config.js`.
