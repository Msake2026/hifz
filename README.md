# Hifz – tester sa mémorisation du Coran et des moutoun

Application web (un seul dossier, sans serveur) : exercices de mémorisation, historique des erreurs, révision espacée, lecteur du texte complet, audio verset par verset.

- **Coran (Ḥafṣ)** : texte uthmani du projet Tanzil, embarqué dans `quran.js` (généré et contrôlé par `tools/build_quran.py` depuis api.alquran.cloud ; vérifié par empreinte SHA-256 à chaque chargement) ; audio via cdn.islamic.network.
- **Moutoun** : `moutoun.js` généré par `tools/build_moutoun.py` (Wikisource arabe, hadith-api). Texte à comparer avec ton édition.
- **Versets proches** : `mutashabihat.js`, calculé automatiquement par `tools/build_mutashabihat.py`.
- Ta progression reste sur ton appareil (localStorage) ; export/import dans Réglages.

Installation sur téléphone : ouvrir la page en HTTPS puis « Installer l'application » (Android/Chrome) ou Partager → « Sur l'écran d'accueil » (iPhone/Safari).

**Comptes et espace admin (optionnel)** : synchronisation de la progression et administration via Supabase. Mise en route : voir `supabase/README.md` ; les règles de sécurité sont dans `supabase/schema.sql` ; les deux valeurs publiques à renseigner sont dans `config.js`.

**Tests** : `node --test tests/node.test.mjs` (Coran, traductions, rappels, secrets) ; tests de l'application avec de vrais clics : `python3 -m http.server 8765` puis ouvrir `http://localhost:8765/tests/`. Ils tournent aussi à chaque `git push` (GitHub Actions). Régénérer le texte du Coran : `python3 -I tools/build_quran.py`.

