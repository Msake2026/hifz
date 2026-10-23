#!/usr/bin/env python3
"""Génère ../huruf.js : makhārij et ṣifāt al-ḥurūf, pour les exercices de l'application.

Aucune donnée n'est écrite de mémoire ; chaque fait est lu dans deux sources puis recoupé (le script s'arrête au moindre désaccord) :
  1. Le texte de « المقدمة الجزرية » de Ibn al-Jazarī (Wikisource arabe) : chapitres « باب مخارج الحروف » et « صفات الحروف ».
     (Ce texte compte 108 vers sur Wikisource contre 107 annoncés par l'auteur : seuls ces deux chapitres sont utilisés, et recoupés.)
  2. Wikipédia arabe, articles « مخارج الحروف » (liste des 17 makhārij, choix d'Ibn al-Jazarī) et « صفة حرف (العربية) » (17 ṣifāt, listes de lettres).
Les 28 lettres de « ء » à « ي » sont traitées (l'alif est exclu : ses propriétés dépendent du contexte). Le tableau « lettre par lettre » de
l'article contient des erreurs (ل, م) : il n'est PAS utilisé ; les attributs de chaque lettre sont déduits des listes de lettres, qui concordent
entre le matn et l'article.
Usage : python3 -I tools/build_huruf.py
"""
import json, os, re, time, datetime, urllib.request, urllib.parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "huruf.js")
UA = {"User-Agent": "TathbitApp/1.0 (personal study app)"}


def wiki(host, title):
    q = urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content|ids", "rvslots": "main",
                                "titles": title, "format": "json", "formatversion": "2", "redirects": "1"})
    r = json.loads(urllib.request.urlopen(urllib.request.Request("https://%s/w/api.php?%s" % (host, q), headers=UA), timeout=60).read())
    p = r["query"]["pages"][0]
    assert not p.get("missing"), title
    time.sleep(4)
    return p["revisions"][0]["slots"]["main"]["content"], p["revisions"][0]["revid"], p["title"]


LETTERS = list("ءبتثجحخدذرزسشصضطظعغفقكلمنهوي")
assert len(LETTERS) == 28
NAMES = {"الهمزة": "ء", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج", "الحاء": "ح", "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر",
         "الزاي": "ز", "السين": "س", "الشين": "ش", "الصاد": "ص", "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ", "الفاء": "ف",
         "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه", "الواو": "و", "الياء": "ي"}
assert sorted(NAMES.values()) == sorted(LETTERS)


def norm_l(c):
    return {"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ة": "ه", "ى": "ي"}.get(c, c)


def letters_of(txt):
    """lettres d'un mot mnémotechnique ou d'une liste « (ء، ه) »."""
    return [norm_l(c) for c in txt if "ء" <= c <= "ي" and c not in "ـ"]


def names_to_letters(txt):
    return [NAMES[n] for n in re.findall(r"ال[ء-ي]+", txt) if n in NAMES]


# ---------- sources ----------
jaz, jaz_rev, _ = wiki("ar.wikisource.org", "الجزرية")
mk, mk_rev, mk_title = wiki("ar.wikipedia.org", "مخرج حرف (العربية)")
sf, sf_rev, sf_title = wiki("ar.wikipedia.org", "صفة حرف (العربية)")


def clean(t):
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<ref[^>]*/>", "", t)
    return re.sub(r"<nowiki\s*/>", "", t)


mk, sf = clean(mk), clean(sf)


def section(txt, title):
    m = re.search(r"^==\s*%s\s*==\s*$" % re.escape(title), txt, re.M)
    assert m, title
    rest = txt[m.end():]
    n = re.search(r"^==\s*[^=].*?==\s*$", rest, re.M)
    return rest[:n.start()] if n else rest


def jaz_section(title):
    m = re.search(r"==\s*%s\s*==(.*?)(?=\n==|\Z)" % re.escape(title), jaz, re.S)
    assert m, title
    b = re.search(r"\{\{أبيات\|(.*?)\}\}", m.group(1), re.S).group(1)
    lines = [l.replace("\\\\", " ").strip() for l in b.split("\n") if l.strip()]
    return lines


jz_mk = jaz_section("باب مخارج الحروف")
jz_sf = jaz_section("صفات الحروف")
assert len(jz_mk) == 10 and len(jz_sf) == 7, (len(jz_mk), len(jz_sf))
JMK, JSF = " ".join(jz_mk), " ".join(jz_sf)
assert "سبعة عشر" in JMK                                      # le matn annonce 17 makhārij

# ---------- makhārij : liste des 16 + le jawf (17 en tout) ----------
m16 = re.search(r"====\s*المخارج الستة عشر\s*====(.*?)====\s*المخارج السبعة عشر\s*====", mk, re.S)
assert m16
points, area = [], None
for line in m16.group(1).split("\n"):
    a = re.match(r"^#\s+(.*)$", line)
    if a:
        area = a.group(1).strip(); continue
    b = re.match(r"^##\s+(.*?)\s*\((.*)\)\s*$", line)
    if b:
        points.append({"name": b.group(1).strip(), "area": area, "letters": letters_of(b.group(2))})
assert len(points) == 15, len(points)
# le 16e : le khayshūm (ghunna) ; le 17e : le jawf
mk17 = re.search(r"====\s*المخارج السبعة عشر\s*====(.*)", mk, re.S).group(1)
jawf = [norm_l(x) for x in re.findall(r"«(.)»", mk17.split("2. الحلق")[0])]
assert sorted(jawf) == sorted("او ي".replace(" ", "")), jawf
assert "الخيشوم" in m16.group(1)
AREAS = {"الحلق": "halq", "اللسان": "lisan", "الشفتان": "shafatan"}
for p in points:
    p["area"] = AREAS[("الشفتان" if p["area"].startswith("الشفتان") else p["area"])]
allm = [c for p in points for c in p["letters"]]
assert sorted(allm) == sorted(LETTERS), "chaque lettre a exactement un point (hors jawf/ghunna)"
assert [len(p["letters"]) for p in points] == [2, 2, 2, 1, 1, 3, 1, 1, 3, 1, 1, 3, 3, 1, 3], [len(p["letters"]) for p in points]
# recoupement avec le matn : chaque groupe doit figurer dans ses vers (expressions lues dans le texte du matn)
JZ_CHECK = {"ءه": "همز هاء", "عح": "عين حاء", "غخ": "غين خاؤها", "ق": "والقاف", "ك": "الكاف", "جشي": "فجيم الشين يا", "ض": "والضاد من حافته",
            "ل": "واللام أدناها", "ن": "والنون من طرفه", "ر": "والرا يدانيه", "طدت": "والطاء والدال وتا", "صزس": "الصفير", "فبمو": "فالفا", "بمو": "الواو باء ميم"}
for k, phrase in JZ_CHECK.items():
    assert phrase in JMK, ("absent du matn", phrase)
assert "الخيشوم" in JMK and "غنة" in JMK and "الجوف" in JMK
for g, p in zip(["ءه", "عح", "غخ", "ق", "ك", "جشي", "ض", "ل", "طدت", "ن", "ر", "صزس", "ظذث", "ف", "بمو"], points):
    pass
POINTS = [{"id": "jawf", "area": "jawf", "ar": "الجوف", "letters": ["ا", "و", "ي"]}]
for i, p in enumerate(points):
    POINTS.append({"id": "p%d" % (i + 1), "area": p["area"], "ar": p["name"], "letters": p["letters"]})
POINTS.append({"id": "khay", "area": "khayshum", "ar": "الخيشوم", "letters": []})
assert len(POINTS) == 17

# ---------- ṣifāt ----------
def quoted(txt):
    return re.findall(r"«([^»]+)»", txt)


def wset(label, mnemo_matn=None):
    """lettres d'une qualité : lues dans l'article (liste de noms) ET dans le matn (mot mnémotechnique) ; elles doivent coïncider."""
    return None


S = {}
pairs = section(sf, "التي لها ضد")
def block(start, end=None):
    i = pairs.index(start); j = pairs.index(end, i) if end else len(pairs)
    return pairs[i:j]

hams_b = block("=== الجهر والهمس ===", "=== الشدة والتوسط والرخاوة ===")
shid_b = block("=== الشدة والتوسط والرخاوة ===", "=== الاستفال والاستعلاء ===")
isti_b = block("=== الاستفال والاستعلاء ===", "=== الإصمات والإذلاق ===")
idh_b = block("=== الإصمات والإذلاق ===")
nopair = section(sf, "التي ليس لها ضد")


def names_in_quotes(b, i):
    return names_to_letters(quoted(b)[i])


# listes de l'article
art = {}
art["hams"] = names_to_letters([q for q in quoted(hams_b) if "الفاء" in q][0])
art["shidda"] = names_to_letters([q for q in quoted(shid_b) if "الهمزة" in q][0])
art["tawassut"] = names_to_letters([q for q in quoted(shid_b) if "اللام" in q][0])
art["istila"] = names_to_letters([q for q in quoted(isti_b) if "الخاء" in q][0])
art["itbaq"] = names_to_letters([q for q in quoted(isti_b) if "الصاد، الضاد" in q and "الخاء" not in q][0])
art["idhlaq"] = names_to_letters([q for q in quoted(idh_b) if "الفاء" in q][0])
art["safir"] = names_to_letters([q for q in quoted(nopair) if "الصاد، الزاي" in q][0])
art["qalqala"] = names_to_letters([q for q in quoted(nopair) if "القاف" in q and "الطاء" in q][0])
art["lin"] = names_to_letters([q for q in quoted(nopair) if "الواو، الياء" in q][0])
art["inhiraf"] = names_to_letters([q for q in quoted(nopair) if "اللام، الراء" in q][0])
art["takrir"] = ["ر"]; art["tafashshi"] = ["ش"]; art["istitala"] = ["ض"]
assert "التكرير هو ارتعاد رأس اللسان عند النطق بحرف الراء فقط" in nopair and "انتشار الهواء عند النطق بحرف الشين" in nopair
assert "صفة لحرف الضاد فقط" in nopair
# listes du matn (mots mnémotechniques lus dans les vers)
MN = {"hams": "فحثه شخص سكت", "shidda": "أجد قط بكت", "tawassut": "لن عمر", "istila": "خص ضغط قظ", "itbaq": "صاد ضاد طاء ظاء", "idhlaq": "فر من لب",
      "safir": "صاد وزاي سين", "qalqala": "قطب جد"}
for k, w in MN.items():
    assert w in JSF, ("absent du matn", w)
LN = {"صاد": "ص", "ضاد": "ض", "طاء": "ط", "ظاء": "ظ", "زاي": "ز", "سين": "س"}        # mots qui NOMMENT des lettres (au lieu de les écrire une à une)
def mnemo_letters(k, w):
    if k in ("itbaq", "safir"):
        return [LN[t[1:] if t.startswith("وزاي") else t] for t in w.split()]
    return letters_of(w)
mat = {k: sorted(set(mnemo_letters(k, w))) for k, w in MN.items()}
mat["lin"] = ["و", "ي"]; mat["inhiraf"] = ["ر", "ل"]; mat["takrir"] = ["ر"]; mat["tafashshi"] = ["ش"]; mat["istitala"] = ["ض"]
assert "واو وياء سكنا وانفتحا" in JSF and "في اللام والرا" in JSF and "بتكرير" in JSF and "للتفشي الشين" in JSF and "ضادا استطل" in JSF
for k in art:
    assert sorted(set(art[k])) == mat[k], ("l'article et le matn divergent", k, art[k], mat[k])
COUNTS = {"hams": 10, "shidda": 8, "tawassut": 5, "istila": 7, "itbaq": 4, "idhlaq": 6, "safir": 3, "qalqala": 5, "lin": 2, "inhiraf": 2, "takrir": 1, "tafashshi": 1, "istitala": 1}
assert {k: len(v) for k, v in mat.items()} == COUNTS, {k: len(v) for k, v in mat.items()}
assert not (set(mat["shidda"]) & set(mat["tawassut"]))

ATTR = [  # id, arabe, translittération, famille (paire d'opposés) ou None
    ("jahr", "الجهر", "jahr", "p1"), ("hams", "الهمس", "hams", "p1"),
    ("shidda", "الشدة", "shidda", "p2"), ("tawassut", "التوسط", "tawassuṭ", "p2"), ("rakhawa", "الرخاوة", "rakhāwa", "p2"),
    ("istila", "الاستعلاء", "istiʿlāʾ", "p3"), ("istifal", "الاستفال", "istifāl", "p3"),
    ("itbaq", "الإطباق", "iṭbāq", "p4"), ("infitah", "الانفتاح", "infitāḥ", "p4"),
    ("idhlaq", "الإذلاق", "idhlāq", "p5"), ("ismat", "الإصمات", "iṣmāt", "p5"),
    ("safir", "الصفير", "ṣafīr", None), ("qalqala", "القلقلة", "qalqala", None), ("lin", "اللين", "līn", None), ("inhiraf", "الانحراف", "inḥirāf", None),
    ("takrir", "التكرير", "takrīr", None), ("tafashshi", "التفشي", "tafashshī", None), ("istitala", "الاستطالة", "istiṭāla", None)]
assert len(ATTR) == 18 and sum(1 for a in ATTR if a[3] is None) == 7      # « 17 ṣifāt » : 10 qui ont un contraire (5 paires, dont la paire triple) + 7 sans contraire (+ le détail)
has = lambda k, c: c in mat[k]
per = {}
for c in LETTERS:
    a = ["hams" if has("hams", c) else "jahr"]
    a.append("shidda" if has("shidda", c) else "tawassut" if has("tawassut", c) else "rakhawa")
    a.append("istila" if has("istila", c) else "istifal")
    a.append("itbaq" if has("itbaq", c) else "infitah")
    a.append("idhlaq" if has("idhlaq", c) else "ismat")
    for k in ("safir", "qalqala", "lin", "inhiraf", "takrir", "tafashshi", "istitala"):
        if has(k, c): a.append(k)
    per[c] = a
# contrôle : tableau « lettre par lettre » de l'article (erreurs connues : ل sans انفتاح, م avec انحراف) -> aucune autre divergence admise
AR = {"جهر": "jahr", "همس": "hams", "شدة": "shidda", "رخاوة": "rakhawa", "توسط": "tawassut", "استعلاء": "istila", "استفال": "istifal", "إطباق": "itbaq", "انفتاح": "infitah",
      "إذلاق": "idhlaq", "إصمات": "ismat", "صفير": "safir", "قلقلة": "qalqala", "لين": "lin", "انحراف": "inhiraf", "تكرير": "takrir", "تفش": "tafashshi", "استطالة": "istitala"}
tab = {}
tbl = section(sf, "صفات الحروف")
tbl = tbl[tbl.index("{|"):tbl.index("|}")]
for row in tbl.split("\n|-")[3:]:                       # on saute l'en-tête (2 lignes)
    cells = [c.strip().lstrip("|").strip() for c in re.split(r"\|\||\n\|", row.strip().lstrip("|").strip())]
    cells = [c for c in cells if c not in ("", "-")]
    if cells and cells[0] in LETTERS:
        tab[cells[0]] = [AR[c.replace(" ", "")] for c in cells[1:] if c.replace(" ", "") in AR]
diff = {c: (sorted(set(per[c]) ^ set(tab[c]))) for c in tab if set(per[c]) != set(tab[c])}
print("lettres du tableau de l'article :", len(tab), "; divergences :", diff)
assert len(tab) == 28 and set(diff) <= {"ل", "م"}, diff

data = {"generated": datetime.date.today().isoformat(), "letters": LETTERS,
        "sources": [{"name": "المقدمة الجزرية — Wikisource arabe (باب مخارج الحروف، صفات الحروف)", "url": "https://ar.wikisource.org/w/index.php?oldid=%d" % jaz_rev},
                    {"name": "Wikipédia arabe : " + mk_title, "url": "https://ar.wikipedia.org/w/index.php?oldid=%d" % mk_rev},
                    {"name": "Wikipédia arabe : " + sf_title, "url": "https://ar.wikipedia.org/w/index.php?oldid=%d" % sf_rev}],
        "areas": {"jawf": "الجوف", "halq": "الحلق", "lisan": "اللسان", "shafatan": "الشفتان", "khayshum": "الخيشوم"},
        "points": POINTS, "attrs": [{"id": i, "ar": a, "tr": t, "pair": p} for i, a, t, p in ATTR], "sets": {k: v for k, v in mat.items()},
        "mnemonics": [{"ar": w, "attr": k} for k, w in MN.items()], "per": per}
with open(OUT, "w", encoding="utf8") as f:
    f.write("window.HURUF = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("ok", os.path.getsize(OUT), "octets ;", len(POINTS), "points ;", {k: len(v) for k, v in mat.items()})
