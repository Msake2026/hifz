#!/usr/bin/env python3
"""Génère ../data/ahkam.js : règles du nūn sākin / tanwīn et du mīm sākin pour les exercices (idhhār, idghām avec/sans ghunna, iqlāb, ikhfāʾ).

Rien n'est écrit de mémoire. Les ensembles de lettres sont lus dans deux sources (qui doivent concorder avec le texte d'Ibn al-Jazarī sur Wikisource) :
  - Wikipédia arabe, « أحكام النون الساكنة والتنوين » et « أحكام الميم الساكنة » ;
  - المقدمة الجزرية (Wikisource), باب النون الساكنة والتنوين : إظهار عند حروف الحلق، إدغام بغنة في « يومن » (sauf dans la même كلمة : دنيا…),
    إدغام بغير غنة في اللام والراء، إقلاب عند الباء، إخفاء عند باقي الحروف.
Les occurrences sont repérées dans quran.js (nūn sans voyelle ni chadda, tanwīn, mīm sans voyelle ni chadda) puis CONTRÔLÉES contre les marques de la source de
tajwīd (data/tajweed.js) : seuls les versets où les décomptes par règle coïncident exactement sont conservés (les marques de la source fusionnent
parfois deux règles voisines : ces versets sont écartés). Les cas non tranchés ne sont jamais conservés.
Usage : python3 -I tools/build_ahkam.py   (après tools/build_quran.py et tools/build_extras.py)
"""
import json, os, re, time, collections, datetime, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "TathbitApp/1.0 (personal study app)"}


def wiki(host, title):
    q = urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content|ids", "rvslots": "main", "titles": title, "format": "json",
                                "formatversion": "2", "redirects": "1"})
    r = json.loads(urllib.request.urlopen(urllib.request.Request("https://%s/w/api.php?%s" % (host, q), headers=UA), timeout=60).read())["query"]["pages"][0]
    assert not r.get("missing"), title
    time.sleep(4)
    return re.sub(r"<ref[^>]*>.*?</ref>", "", r["revisions"][0]["slots"]["main"]["content"], flags=re.S), r["revisions"][0]["revid"], r["title"]


noon, noon_rev, noon_t = wiki("ar.wikipedia.org", "أحكام النون الساكنة والتنوين")
mimw, mim_rev, mim_t = wiki("ar.wikipedia.org", "أحكام الميم الساكنة")
jaz, jaz_rev, _ = wiki("ar.wikisource.org", "الجزرية")

AL = list("ءبتثجحخدذرزسشصضطظعغفقكلمنهوي")


def LO(t):  # mêmes lettres, dans l'ordre de la source
    out = []
    for c in t.replace("هـ", "ه"):
        c = {"أ": "ء", "إ": "ء", "ى": "ي", "ة": "ه"}.get(c, c)
        if "\u0621" <= c <= "\u064A" and c not in out: out.append(c)
    return "".join(out)


def L(t):
    return "".join(sorted({{"أ": "ء", "إ": "ء", "ى": "ي", "ة": "ه", "هـ": "ه"}.get(c, c) for c in t if "ء" <= c <= "ي"}))


# ---------- ensembles de lettres, lus dans l'article ----------
m = re.search(r"حروف إظهارهما:\s*(.*?)\.", noon)
idhhar = L(m.group(1).replace("هـ", "ه"))
m = re.search(r"حروف إدغامهما:\s*\(ي، ر، م، ل، و، ن\)", noon); assert m
idg_all = L("يرملون")
assert "ينمو" in noon and "«رل»" in noon.replace(" ", "") or "(ر، ل)" in noon
idg_g, idg_n = L("ينمو"), L("رل")
iqlab = "ب"
assert "حرف واحد وهو (ب)" in noon
ikh_sec = noon[noon.index("== الإخفاء =="):]
quote = re.search(r"\{\{اقتباس\|([^|]*)\|([^}]*)\}\}", ikh_sec)
mn_text = (quote.group(1) + " " + quote.group(2)).strip()
assert "صف ذا ثنا كم جاد شخص قد سما" in mn_text and "دم طيبا زد في تقى ضع ظالما" in mn_text
ikhfa = L("".join(w[0] for w in mn_text.split()))                                                # lettre initiale de chaque mot du vers
listed = L(re.search(r"و هي:\s*\(([^)]*)\)", ikh_sec).group(1))                                    # liste explicite de l'article
assert ikhfa == listed, ("le vers et la liste de l'article divergent", ikhfa, listed)
assert (len(idhhar), len(idg_all), len(idg_g), len(idg_n), len(ikhfa)) == (6, 6, 4, 2, 15), (idhhar, idg_all, idg_g, idg_n, ikhfa)
assert sorted(idhhar + idg_all + iqlab + ikhfa) == sorted(AL) or sorted(set(idhhar + idg_all + iqlab + ikhfa)) == sorted(AL), "les 5 groupes couvrent les 28 lettres"
assert len(set(idhhar) | set(idg_all) | {iqlab} | set(ikhfa)) == 28 and len(idhhar + idg_all + iqlab + ikhfa) == 28
for w in ("دنيا", "بنيان", "قنوان", "صنوان"):                      # exceptions citées par l'article (écriture parfois espacée)
    assert re.search(r"[\s\u064B-\u0652]*".join(w), noon), w
# recoupement avec le matn d'Ibn al-Jazarī (Wikisource)
sec = re.search(r"==\s*باب النون الساكنة والتنوين\s*==(.*?)(?=\n==|\Z)", jaz, re.S).group(1)
for phrase in ("فعند حرف الحلق أظهر", "في اللام والرا", "وأدغمن بغنة في يومن", "إلا بكلمة كدنيا", "والقلب عند البا بغنة", "إخفا لدى باقي الحروف"):
    assert phrase in sec, ("absent du matn", phrase)
assert L("يومن") == L("ينمو") and L("لر") == L("رل")
# mīm
assert "ال[[ب]]" in mimw or "هو ([[ب]])" in mimw or "(ب)" in mimw
assert "الإخفاء الشفوي" in mimw and "الإدغام الشفوي" in mimw and "الإظهار الشفوي" in mimw
sh = mimw[mimw.index("== ثانياً: الإدغام الشفوي =="):]
assert re.search(r"حرف و?\s*\(?\[?\[?م", sh) or "الميم" in sh


# ---------- repérage dans le texte du Coran ----------
q = open(os.path.join(HERE, "..", "quran.js"), encoding="utf8").read()
Q = json.loads(q[len("window.QURAN = "):].rstrip().rstrip(";"))["surahs"]
t = open(os.path.join(HERE, "..", "data", "tajweed.js"), encoding="utf8").read()
T = json.loads(t[t.index('window.QX["tajweed"] = ') + len('window.QX["tajweed"] = '):].rstrip().rstrip(";"))["s"]
MARK = re.compile("[ً-ٰٟۖ-ۭ]")
VOW = re.compile("[ًَُِّ-ٍ]")


def clusters(txt):  # identique à hfClusters (index.html)
    out, w = [], 0
    for ch in txt:
        if ch == " ":
            w += 1; continue
        if "ء" <= ch <= "ي" or "ٱ" <= ch <= "ۓ":
            out.append({"c": ch, "m": "", "w": w})
        elif out and MARK.match(ch):
            out[-1]["m"] += ch
    return out


def norm(c):
    return {"ٱ": "ا", "أ": "ء", "إ": "ء", "ؤ": "ء", "ئ": "ء", "ى": "ي", "آ": "ء"}.get(c, c)


def noon_rule(n, same, isn):
    if n in idhhar: return "H"
    if n in idg_g: return "M" if (same and isn) else "G"      # M : إظهار مطلق (دنيا، بنيان، قنوان، صنوان)
    if n in idg_n: return "N"
    if n == iqlab: return "Q"
    if n in ikhfa: return "K"
    return None


def occ_of(txt):
    cl, out = clusters(txt), []
    for k, x in enumerate(cl):
        isn = x["c"] == "ن" and not VOW.search(x["m"])
        istw = re.search("[ً-ٍ]", x["m"]) is not None
        ismim = x["c"] == "م" and not VOW.search(x["m"]) and "ٓ" not in x["m"]
        if not (isn or istw or ismim): continue
        j = k + 1
        if istw:
            while j < len(cl) and cl[j]["w"] == x["w"] and cl[j]["c"] in "اى" and not re.search("[َُِّْ]", cl[j]["m"]): j += 1
        if j >= len(cl): continue                         # dernière lettre du verset : pas de lettre suivante
        n = norm(cl[j]["c"]); same = cl[j]["w"] == x["w"]
        if ismim and not (isn or istw):
            r = "mK" if n == "ب" else "mG" if n == "م" else "mH" if n != "ا" or True else None
        else:
            r = noon_rule(n, same, isn)
        out.append((k, j, r))
    return out


SRC = {"G": "a", "N": "u", "Q": "i", "K": "f", "mK": "c", "mG": "w"}
occ, kept, dropped, unknown = {}, 0, 0, 0
for si, s in enumerate(Q):
    for vi, v in enumerate(s["a"]):
        o = occ_of(v[0])
        if any(r is None for _, _, r in o): unknown += 1; continue
        mine = collections.Counter(SRC[r] for _, _, r in o if r in SRC)
        src = collections.Counter(m.group(1) for m in re.finditer(r"\[([afuicw])\[", T[si][vi]))
        if mine != src: dropped += 1; continue
        kept += 1
        if o: occ["%d:%d" % (si + 1, vi + 1)] = ",".join("%d.%d.%s" % x for x in o)
print("versets conservés", kept, "écartés (décomptes différents)", dropped, "avec cas non tranché", unknown)
assert kept > 6000 and dropped < 120, (kept, dropped)

# ghunna (nūn / mīm avec chadda, hors chadda née d'un idghām) : même contrôle contre les marques « g » de la source
def idgham_before(cl, k):
    j = k - 1
    while j >= 0 and cl[j]["c"] in "اى" and not re.search("[\u064E\u064F\u0650\u0651\u0652]", cl[j]["m"]): j -= 1
    if j < 0: return False
    p = cl[j]
    return bool(re.search("[\u064B-\u064D]", p["m"]) or (p["c"] in "نم" and not VOW.search(p["m"])))


gh, gh_n = {}, 0
for si, s in enumerate(Q):
    for vi, v in enumerate(s["a"]):
        cl = clusters(v[0]); ks = [k for k, x in enumerate(cl) if x["c"] in "نم" and "\u0651" in x["m"] and not idgham_before(cl, k)]
        if len(ks) == len(re.findall(r"\[g\[", T[si][vi])):
            gh_n += 1
            if ks: gh["%d:%d" % (si + 1, vi + 1)] = ",".join(map(str, ks))
print("ghunna : versets concordants (conservés)", gh_n, "/ 6236")
assert gh_n >= 6100

counts = collections.Counter(r for v in occ.values() for r in (x.split(".")[2] for x in v.split(",")))
print(dict(counts))
data = {"generated": datetime.date.today().isoformat(),
        "sources": [{"name": "Wikipédia arabe : " + noon_t, "url": "https://ar.wikipedia.org/w/index.php?oldid=%d" % noon_rev},
                    {"name": "Wikipédia arabe : " + mim_t, "url": "https://ar.wikipedia.org/w/index.php?oldid=%d" % mim_rev},
                    {"name": "المقدمة الجزرية — Wikisource arabe (باب النون الساكنة والتنوين)", "url": "https://ar.wikisource.org/w/index.php?oldid=%d" % jaz_rev}],
        "sets": {"H": LO(re.search(r"حروف إظهارهما:\s*(.*?)\.", noon).group(1)), "G": LO("ينمو"), "N": LO("رل"), "Q": "ب", "K": LO(re.search(r"و هي:\s*\(([^)]*)\)", ikh_sec).group(1))}, "mnemonics": {"H": "أخي هاك علما حازه غير خاسر", "idgham": "يرملون", "G": "ينمو", "K": mn_text},
        "exceptions": ["دنيا", "بنيان", "قنوان", "صنوان"], "occ": occ, "gh": gh}
os.makedirs(os.path.join(HERE, "..", "data"), exist_ok=True)
out = os.path.join(HERE, "..", "data", "ahkam.js")
with open(out, "w", encoding="utf8") as f:
    f.write("window.AHKAM = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("ok", os.path.getsize(out) // 1024, "Ko", {k: v for k, v in data["sets"].items()})
assert all(sorted(L(data["sets"][k])) == sorted(v) for k, v in {"H": idhhar, "G": idg_g, "N": idg_n, "Q": iqlab, "K": ikhfa}.items())
