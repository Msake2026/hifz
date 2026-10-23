#!/usr/bin/env python3
"""Texte d'Ibn ʿĀshir, « al-Murshid al-Muʿīn » (317 vers selon les sources) : appelé par build_moutoun.py.

Aucune édition savante numérisée en texte n'est librement disponible : on compare DEUX transcriptions web indépendantes.
  A. blog « قصيدة صوفية » (soufisunni.blogspot.com) : vocalisée, un hémistiche par ligne, contient les 5 vers d'introduction
  B. site « العلوم الشرعية » (chariaa.weebly.com)    : un vers par ligne, vocalisation irrégulière, sans l'introduction
Le texte publié est celui de A (meilleure vocalisation), sans aucune correction de ma part : B sert de contrôle, chaque
divergence de consonnes est comptée et affichée (elle va dans AUDIT-CONTENU.md) ; le script s'arrête si les deux textes
s'éloignent trop. (Une « correction » faite de mémoire s'est révélée fausse : الطُّهْران est juste, la variante de B est la coquille.)
Rejeté : l'édition « modfied » d'archive.org (item Murshed-mu3in) : texte remanié, pas celui d'Ibn ʿĀshir.
"""
import re, html, difflib, urllib.request, time, sys

UA = "TathbitApp/1.0 (personal study app)"
URL_A = "http://soufisunni.blogspot.com/2013/03/blog-post_31.html"
URL_B = "https://chariaa.weebly.com/160515781606-157515761606-1593157515881585.html"

# Titres de chapitres (pas des vers), en écriture « squelette » (voir sk)
HEADINGS = {"فصل في قواعد الاسلام", "كتاب الطهاره", "فصل في فرايض الوضو", "سنن الوضو", "نواقض الوضو", "فرايض الغسل",
            "سنن الغسل", "موجب الغسل", "فصل في التيمم", "فروض التيمم", "سنن التيمم", "كتاب الصلاه", "سنن الصلاه",
            "مندوبات الصلاه", "فرض العين وفرض الكفايه", "سجود السهو", "صلاه الجمعه", "شروط الامام", "كتاب الزكاه",
            "فصل في زكاه الفطر", "كتاب الصيام", "كتاب الحج", "كتاب مبادي التصوف وهوادي التعرف",
            "ملخص مبادي اداب التصوف"}
# Vers que B écrit sur deux lignes (deux hémistiches séparés)
B_SPLIT = [("مقدمه لكتاب الاعتقاد", "معينه لقاريها علي المراد"), ("كتاب ام القواعد", "وما انطوت عليه من العقايد"),
           ("مقدمه من الاصول", "معينه في فروعها علي الوصول")]


# Titres français = ma traduction des titres arabes de la source (à signaler comme rédigée par l'IA)
FR = {"مقدمه": "Introduction",
      "مقدمه لكتاب الاعتقاد": "Introduction au livre du credo",
      "كتاب ام القواعد": "La mère des fondements : les croyances (ʿaqāʾid)",
      "فصل في قواعد الاسلام": "Les piliers de l'islam",
      "مقدمه من الاصول": "Introduction aux fondements (uṣūl)",
      "كتاب الطهاره": "Livre de la purification",
      "فصل في فرايض الوضو": "Les obligations des ablutions",
      "سنن الوضو": "Les sunan des ablutions",
      "نواقض الوضو": "Ce qui annule les ablutions",
      "فرايض الغسل": "Les obligations du grand lavage",
      "سنن الغسل": "Les sunan du grand lavage",
      "موجب الغسل": "Ce qui rend le grand lavage obligatoire",
      "فصل في التيمم": "Le tayammum",
      "فروض التيمم": "Les obligations du tayammum",
      "سنن التيمم": "Les sunan du tayammum",
      "كتاب الصلاه": "Livre de la prière",
      "سنن الصلاه": "Les sunan de la prière",
      "مندوبات الصلاه": "Les recommandations de la prière",
      "فرض العين وفرض الكفايه": "Obligation individuelle et obligation collective",
      "سجود السهو": "La prosternation de l'oubli",
      "صلاه الجمعه": "La prière du vendredi",
      "شروط الامام": "Les conditions de l'imam",
      "كتاب الزكاه": "Livre de la zakât",
      "فصل في زكاه الفطر": "La zakât al-fiṭr",
      "كتاب الصيام": "Livre du jeûne",
      "كتاب الحج": "Livre du ḥajj",
      "كتاب مبادي التصوف وهوادي التعرف": "Les principes du taṣawwuf"}
# Vers qui servent eux-mêmes de titre dans le texte (début de vers -> ouvre un bloc)
VERSE_TITLES = ["مقدمه لكتاب الاعتقاد", "كتاب ام القواعد", "مقدمه من الاصول"]


def http(url):
    for _ in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40).read().decode("utf8", "ignore")
        except Exception as e:
            print("retry", url[:50], e, file=sys.stderr)
            time.sleep(10)
    raise SystemExit("échec réseau : " + url)


def lines_of(page):
    t = html.unescape(re.sub(r"<(script|style)[\s\S]*?</\1>", "", page))
    t = re.sub(r"<br\s*/?>|</p>|</div>|</h\d>|</li>|</tr>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    return [x.strip() for x in t.split("\n") if x.strip()]


def junk(s):
    return s.replace("ـ", "").replace("​", "").replace("‏", "").replace("\xa0", " ")


def sk(s):
    """Squelette consonantique : sans voyelles, hamza/alif/yā'/tā' marbūṭa unifiés."""
    s = junk(s)
    s = re.sub(r"[ً-ٰٟۖ-ۭ]", "", s)
    s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ء", "").replace("ؤ", "و").replace("ئ", "ي")
    return " ".join(re.sub(r"[^ء-ي ]", " ", s).split())


def tidy(w):
    w = re.sub(r"[0-9\u0660-\u0669]+", "", w).strip("()[]«»")  # numéros de notes du blog collés au mot
    w = re.sub(r"(?<=ا)[َ-ِ]", "", w)  # voyelle isolée collée après un alif : coquille de saisie
    return w


# Corrections de voyelles faites par une relecture humaine (seules modifications du texte de la copie A). mot de A -> mot corrigé
CORRECTIONS = {"\u062d\u064e\u062c\u0651\u064e\u0629\u064d": "\u062d\u0650\u062c\u0651\u064e\u0629\u064d"}   # حَجَّةٍ -> حِجَّةٍ (ordre des voyelles = celui de la source)   # vers 215 : ḥijja (ذو الحجة), pas ḥajja ; relecture de l'utilisateur, 23 oct. 2026


LAST_REVIEW = []   # remplie par ibn_ashir() : une ligne par divergence (voir tools/review_ibn_achir.py)


def ibn_ashir():
    a = lines_of(http(URL_A)); b = lines_of(http(URL_B))
    a0 = next(i for i, l in enumerate(a) if sk(l).startswith("يقول عبد الواحد بن عاشر"))
    a1 = next(i for i, l in enumerate(a) if "اجتباه" in sk(l).replace(" ", "")) + 1
    b0 = next(i for i, l in enumerate(b) if sk(l).startswith("مقدمه لكتاب الاعتقاد"))
    b1 = next(i for i, l in enumerate(b) if "اجتباه" in sk(l).replace(" ", "")) + 1
    A = [(l, i) for i, l in enumerate(a[a0:a1]) if sk(l) not in HEADINGS]
    # A : jetons (forme d'origine, clé, n° de ligne)
    S = [(tidy(w), sk(w).replace(" ", ""), li) for l, li in A for w in junk(l).split() if sk(w)]
    for old, new in CORRECTIONS.items():
        hits = [k for k, t in enumerate(S) if t[0] == old]
        assert len(hits) == 1, (old, len(hits))
        S[hits[0]] = (new,) + S[hits[0]][1:]
    # B : un vers par ligne (B_SPLIT recolle les trois vers coupés)
    bl, i = [], b0
    while i < b1:
        l = b[i]
        if sk(l) in HEADINGS or not sk(l):
            i += 1; continue
        if i + 1 < b1 and any(sk(l) == x and sk(b[i + 1]) == y for x, y in B_SPLIT):
            bl.append(junk(l) + " " + junk(b[i + 1])); i += 2; continue
        bl.append(junk(l)); i += 1
    C = [(sk(w).replace(" ", ""), ci) for ci, l in enumerate(bl) for w in l.split() if sk(w)]
    Co = [w for l in bl for w in l.split() if sk(w)]   # mots de B tels qu'écrits, même ordre que C
    sm = difflib.SequenceMatcher(None, [c[0] for c in C], [s[1] for s in S], autojunk=False)
    grp, last, intro, extra, diffs, rev = {}, None, [], [], [], []
    for tag, x0, x1, y0, y1 in sm.get_opcodes():
        if tag == "equal":
            for k in range(x1 - x0):
                grp.setdefault(C[x0 + k][1], []).append(y0 + k); last = C[x0 + k][1]
        elif tag == "replace":
            diffs.append((' '.join(c[0] for c in C[x0:x1]), ' '.join(s[1] for s in S[y0:y1]), C[x0][1]))
            rev.append((C[x0][1], ' '.join(s[0] for s in S[y0:y1]), ' '.join(Co[x0:x1])))
            grp.setdefault(C[x0][1], []).extend(range(y0, y1)); last = C[x1 - 1][1]
        elif tag == "insert":
            if last is None:
                intro.extend(range(y0, y1))        # introduction : seulement dans A
            elif y1 - y0 >= 6:
                extra.append((last, list(range(y0, y1))))  # vers présent seulement dans A
                rev.append((last, ' '.join(s[0] for s in S[y0:y1]), '(vers absent de B)'))
            else:
                diffs.append(("", ' '.join(s[1] for s in S[y0:y1]), last))
                rev.append((last, ' '.join(s[0] for s in S[y0:y1]), ''))
                grp.setdefault(last, []).extend(range(y0, y1))
        elif tag == "delete":
            diffs.append((' '.join(c[0] for c in C[x0:x1]), "", C[x0][1])); last = C[x1 - 1][1]
            rev.append((C[x0][1], '', ' '.join(Co[x0:x1])))

    def unit(idx):
        toks = [S[j] for j in sorted(idx)]
        ws = [t[0] for t in toks]
        n1 = sum(1 for t in toks if t[2] == toks[0][2])
        two = len({t[2] for t in toks}) == 2
        m = n1 if two else (len(toks) + 1) // 2  # vers sur une seule ligne : coupe au milieu
        lid0.append(toks[0][2])
        return {"t": " ".join(ws), "m": m}

    units, lid0 = [], []
    by = {}
    for j in intro: by.setdefault(S[j][2], []).append(j)
    ls = sorted(by); assert len(ls) == 10, len(ls)
    units += [unit(by[ls[2 * k]] + by[ls[2 * k + 1]]) for k in range(5)]
    ex, unit_of = dict(extra), {}
    for ci in range(len(bl)):
        if grp.get(ci): units.append(unit(grp[ci]))
        unit_of[ci] = len(units)
        if ci in ex: units.append(unit(ex[ci]))
    LAST_REVIEW[:] = [{"n": unit_of.get(ci, 0), "a": a_, "b": b_, "bline": bl[ci] if ci < len(bl) else ""} for ci, a_, b_ in rev]
    sk_diffs = [d for d in diffs if d[0].replace(" ", "") != d[1].replace(" ", "")]
    ratio = sm.ratio()
    print("Ibn ʿĀshir :", len(units), "vers ; accord A/B", round(ratio, 4), "; divergences", len(sk_diffs), file=sys.stderr)
    assert ratio > 0.95 and 310 <= len(units) <= 320, (ratio, len(units))
    assert all(u["t"].strip() and 3 <= u["m"] for u in units)
    # Blocs : titres de la copie A (chapitres) + les trois vers qui font office de titre dans le texte
    marks = []  # (n° du 1er vers du bloc, titre arabe, clé)
    for hi, hl in [(i, l) for i, l in enumerate(a[a0:a1]) if sk(l) in HEADINGS and sk(l) in FR]:
        n = next((k + 1 for k, x in enumerate(lid0) if x > hi), None)
        if n: marks.append((n, " ".join(junk(hl).split()), sk(hl)))
    for key in VERSE_TITLES:
        n = next(k + 1 for k, u in enumerate(units) if sk(u["t"]).startswith(key))
        marks.append((n, units[n - 1]["t"], key))
    marks.sort()
    sections = [{"ar": "المقدمة", "fr": FR["مقدمه"], "from": 1}] + [{"ar": t, "fr": FR[k], "from": n} for n, t, k in marks]
    assert all(x["from"] < y["from"] for x, y in zip(sections, sections[1:])), sections
    return units, [(u, v) for u, v, _ in sk_diffs], sections


def source():
    return {"name": "Deux transcriptions web non officielles, comparées (soufisunni.blogspot.com, chariaa.weebly.com)",
            "url": URL_A,
            "note": "pas d'édition savante en texte : copies de blog, non relues et parfois divergentes ; à comparer avec ton édition imprimée "
                    "(les divergences sont listées dans AUDIT-CONTENU.md)"}


if __name__ == "__main__":
    u, d, sec = ibn_ashir()
    for x in d: print(x)
    for x in sec: print(x)
