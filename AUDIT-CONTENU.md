# Audit du contenu de Tathbīt (22 oct. 2026, complété le 23 oct.)

Règle : aucun verset, vers ou règle n'est écrit de mémoire ; tout vient d'une source citée et vérifiable.

## 1. Données générées depuis une source (recontrôlées le 22 oct. 2026)
On a relancé chaque script `tools/build_*.py` sur une copie du dépôt, depuis les sources en ligne, puis comparé au fichier publié (hors date de génération).

| Fichier | Source | Résultat |
|---|---|---|
| `quran.js` (6236 versets) | api.alquran.cloud, édition `quran-uthmani` (Tanzil) | identique, SHA-256 `58ab3a39…` |
| `data/tajweed.js` | api.alquran.cloud, édition `quran-tajweed` | identique |
| `data/tr-fr.js` | Tanzil, `fr.hamidullah` | identique |
| `data/tr-en.js` | Tanzil, `en.sahih` ; 0 différence avec alquran.cloud | identique |
| `data/tafsir-ar.js` | api.alquran.cloud, `ar.muyassar` | identique |
| `huruf.js` | Wikisource (al-Jazariyya) recoupé avec 2 articles de Wikipédia arabe | identique |
| `data/ahkam.js` | Wikipédia arabe + Wikisource, contrôlé contre les marques de tajwīd | identique |
| `moutoun.js` | Wikisource arabe (Tuḥfat al-Aṭfāl 61 vers, Bayqūniyya 34 vers) + hadith-api (Arbaʿūn, 42 hadiths) | identique (hors Ibn ʿĀshir, ajouté le 23 oct., voir §3 bis) |
| `mutashabihat.js` | calcul automatique sur le texte (pas la liste classique des savants ; dit dans l'application) | identique |

Des tests automatiques contrôlent à chaque envoi les empreintes, l'alignement sur les 6236 versets, les sources et la cohérence des règles.

## 2. Points relevés par les scripts
- Tajwīd : 1 balise de la source sans code reconnu (6:61 environ), laissée sans couleur.
- Aḥkām : sur 6236 versets, 6160 conservés ; 31 écartés parce que les décomptes diffèrent de la source ; 45 cas non tranchés jamais utilisés.
- Makhārij/ṣifāt : le tableau « lettre par lettre » de l'article de Wikipédia contient des erreurs (ل, م) : il n'est pas utilisé, les attributs viennent des listes de lettres qui concordent avec le matn.
- Légende des couleurs du tajwīd : les 15 couleurs de l'application sont identiques à celles de la légende officielle de la source (vérifié). Les noms français sont ma traduction des noms anglais de cette légende.
- Mots d'exemple de l'idhhār muṭlaq (دنيا، بنيان، قنوان، صنوان) : confirmés par l'article de Wikipédia arabe « أحكام النون الساكنة والتنوين ».

## 3. Ce qui n'est PAS une source vérifiée et doit être relu par une personne compétente
1. **Traductions anglaise et arabe de l'interface** (~900 phrases, `i18n.js`) : écrites par moi, non relues. L'arabe surtout.
2. **Explications et consignes en français** dans l'application (conseils, descriptions des exercices, corrections affichées).
3. **Noms français de la légende du tajwīd** (« Madd nécessaire (6 temps) », etc.) : traduction des noms officiels, avec « temps » pour « vowels ».
4. **Sources non savantes** : Wikisource et Wikipédia ne sont pas des éditions de référence ; les règles de tajwīd, les makhārij et les ṣifāt devraient être relus par un enseignant qualifié.
5. **Annotation du tajwīd** : automatique (Islamic Network), non relue ; l'application le signale déjà.
6. **Logique des exercices** (qalqala, līn, types de madd déduits du texte) : testée contre les marques de la source, mais pas validée par un savant.

## 3 bis. Ibn ʿĀshir, « al-Murshid al-Muʿīn » (ajouté le 23 oct. 2026) : source la plus faible de l'application
Aucune édition savante n'est disponible en texte libre. Le texte vient de **deux transcriptions web non officielles**, comparées par `tools/build_ibn_achir.py` :
- A : blog soufisunni.blogspot.com (vocalisé ; contient les 5 vers d'introduction) → c'est le texte affiché, sans correction de ma part ;
- B : chariaa.weebly.com (un vers par ligne, vocalisation irrégulière) → sert de contrôle.

Résultat : **315 vers** (les sources citent 317 : 2 vers manquent peut-être dans les deux copies, ou le décompte compte des titres). Accord des consonnes entre A et B : 96,8 %. Il reste **51 divergences** (listées par `python3 -I tools/build_ibn_achir.py`), presque toutes des coquilles d'une des deux copies (ex. المجال / المحال). Celles qui changent le sens et que **seule ton édition imprimée peut trancher** : 
`لو أمكن / لو لم يك` (strophe sur le fanāʾ), `عالَما / عَلَما`, `الإيمان / الإسلام`, `حتما / ختما`, `لغير / عن`, `بفصل / بفضل`, `ونعم / وغنم`, `السقي / القي`, `لرفض / لفرض`, `والأشواط / والأشراط`, `بنسج / بسبح`, le vers « وادع بما شئت لدى الملتزم… » (présent dans A seulement) et le mot `حجه` (A seulement).
Rejeté : l'édition « modfied » d'archive.org (item *Murshed-mu3in*) : le texte est remanié (titres et vers différents), ce n'est pas celui d'Ibn ʿĀshir. Les scans OCR d'archive.org sont illisibles (voyelles).
**Fiche de relecture à remettre à une personne qui a l'édition imprimée : [RELECTURE-IBN-ACHIR.md](RELECTURE-IBN-ACHIR.md)** (15 divergences à trancher en priorité, puis 37 autres, chacune avec le vers complet).
**Corrections de voyelles faites par relecture humaine** (seules retouches du texte de la copie A) : vers 215, `حَجَّةٍ` → `حِجَّةٍ` (23 oct. 2026).
Un essai de « correction » de ma part, de mémoire, s'est révélé faux (الطُّهْران est juste, l'autre copie a la coquille) : je n'en fais plus aucune.

**Manquant** : *Manẓūmat al-ʿAqāʾid ash-Sharnūbiyya* (ʿAbd al-Majīd ash-Sharnūbī) : aucune version texte fiable trouvée (seulement des scans PDF/EPUB illisibles à l'OCR). Non ajoutée. Pour l'ajouter : copier le texte depuis ton édition dans « Mes moutoun », ou m'en envoyer des photos lisibles.

## 3 ter. Regroupement des moutoun par thème et par bloc (23 oct. 2026)
- **Thèmes** (liste des moutoun) : Tajwīd, ʿAqīda-fiqh mālikī-taṣawwuf, Muṣṭalaḥ al-ḥadīth, Ḥadīth. C'est la discipline de chaque ouvrage, indiquée par son titre et son auteur.
- **Blocs** (chapitres d'un matn) : uniquement quand la source les donne.
  - Tuḥfat al-Aṭfāl : 10 blocs, titres de la page Wikisource (المقدمة، النون الساكنة والتنوين، … الخاتمة).
  - Ibn ʿĀshir : 27 blocs ; titres des chapitres de la copie A (كتاب الطهارة، كتاب الصلاة… ) et trois vers du texte qui servent eux-mêmes de titre (مقدمة لكتاب الاعتقاد، كتاب أم القواعد، مقدمة من الأصول).
  - Bayqūniyya et Arbaʿūn : aucun bloc, car leurs sources n'ont pas de titres ; je n'en invente pas.
- Les titres arabes viennent de la source ; **les titres français et anglais sont traduits par l'IA** (mention affichée dans l'application). Le bloc « المقدمة » d'Ibn ʿĀshir (vers 1 à 5) est un nom que j'ai choisi.

## 4. Engagement
Si une source ne confirme pas un fait, il n'est pas mis dans l'application. Pour re-vérifier : `python3 -I tools/build_quran.py` puis les autres `build_*.py`, et comparer.

## 5. Mention « rédigé par une IA »
Tout texte d'explication écrit par l'IA qui a développé l'application (explications de règles, termes du plan, légende traduite, notes d'exercices) porte la mention « 🤖 Texte rédigé par une IA, pas une source officielle ». Réglages → « D'où viennent les contenus ? » résume ce qui vient de sources citées et ce qui est rédigé par l'IA.
