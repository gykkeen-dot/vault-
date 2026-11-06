#!/usr/bin/env python3
"""Builds preview.html (single file for the Artifact) from preview.template.html + shader.js."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
shader = re.sub(r"^export ", "", (root / "shader.js").read_text(), flags=re.M)
tpl = (root / "preview.template.html").read_text()
mask = re.sub(r"^export ", "", (root / "mask.js").read_text(), flags=re.M)
(root / "preview.html").write_text(tpl.replace("/*SHADER*/", shader).replace("/*MASK*/", mask))
print("preview.html written")
