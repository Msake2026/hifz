#!/usr/bin/env python3
"""Ajoute des traductions à i18n.js : python3 -I tools/i18n_add.py fichier.json  (liste de [français, anglais, arabe]).
Une clé déjà présente n'est jamais écrasée (elle est signalée). Le fichier garde son format : clés triées, une par ligne."""
import json, sys, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "i18n.js")
s = open(P, encoding="utf8").read()
head = s[:s.index("window.I18N = ")]
d = json.loads(s[s.index("window.I18N = ") + len("window.I18N = "):s.rindex("};") + 1])
add = json.load(open(sys.argv[1], encoding="utf8"))
n = 0
for f, e, a in add:
    if f in d["en"]:
        print("déjà présent :", f[:60]); continue
    d["en"][f] = e; d["ar"][f] = a; n += 1
out = ["{"]
for i, (lang, m) in enumerate(d.items()):
    out.append(json.dumps(lang) + ": {")
    out.append(",\n".join(json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) for k, v in sorted(m.items())))
    out.append("}" + ("," if i < len(d) - 1 else ""))
out.append("}")
open(P, "w", encoding="utf8").write(head + "window.I18N = " + "\n".join(out) + ";\n")
print(n, "ajoutées ;", len(d["en"]), "au total")
