#!/usr/bin/env python3
"""Écrit BLOCS-MOUTOUN.md : les blocs (chapitres) et leurs vers, tels qu'ils sont dans l'application (lus dans moutoun.js)."""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
s = open(os.path.join(root, "moutoun.js"), encoding="utf8").read()
M = json.loads(s[s.index("=") + 1:s.rindex(";")])
out = ["# Blocs des moutoun, tels qu'ils sont dans l'application\n",
       "Chaque bloc : titre arabe (de la source), titre français (traduit par l'IA), numéros des vers, puis les vers (✦ sépare les deux hémistiches).\n"]
for t in M["texts"]:
    if not t.get("sec"):
        continue
    S, n = t["sec"], len(t["a"])
    out.append(f"\n---\n\n# {t['fr']} · {t['ar']}\n\n{n} vers, {len(S)} blocs. Source : {t['source']['name']}.\n")
    out.append("| Bloc | Titre | Vers |\n|---|---|---|")
    for k, b in enumerate(S):
        to = (S[k + 1]["from"] - 1) if k + 1 < len(S) else n
        out.append(f"| {k + 1} | {b['fr']} | {b['from']}–{to} |")
    for k, b in enumerate(S):
        to = (S[k + 1]["from"] - 1) if k + 1 < len(S) else n
        out.append(f"\n## Bloc {k + 1} : {b['fr']}\n\n**{b['ar']}**  ·  vers {b['from']} à {to} ({to - b['from'] + 1} vers)\n")
        for i in range(b["from"], to + 1):
            u = t["a"][i - 1]; w = u["t"].split(" ")
            out.append(f"{i}. {' '.join(w[:u['m']])} ✦ {' '.join(w[u['m']:])}")
open(os.path.join(root, "BLOCS-MOUTOUN.md"), "w", encoding="utf8").write("\n".join(out) + "\n")
print("ok")
