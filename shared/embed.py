#!/usr/bin/env python3
"""Embed shared/egp-receipt.js into each SDK between the EGP-RECEIPT markers.

    cd "singular sdks" && python3 shared/embed.py

Each SDK file must already contain the two marker lines once; the text
between them is replaced with the current shared module.
"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
shared = (root / "shared" / "egp-receipt.js").read_text()
m = re.search(r"/\* EGP-RECEIPT-BEGIN \*/.*?/\* EGP-RECEIPT-END \*/", shared, re.S)
if not m:
    sys.exit("shared/egp-receipt.js is missing its markers")
block = m.group(0)

targets = [
    root / "1-pulsebridge" / "pulsebridge-sdk.js",
    root / "2-standard" / "standardpaymentsdk.js",
    root / "3-inter" / "webbridge.js",
    root.parent / "modular" / "sdk" / "egp-core.js",   # the modular engine shares the same receipt
]
for path in targets:
    src = path.read_text()
    new, n = re.subn(r"/\* EGP-RECEIPT-BEGIN \*/.*?/\* EGP-RECEIPT-END \*/", lambda _: block, src, flags=re.S)
    if n != 1:
        print(f"SKIP {path.name}: expected exactly one marker pair, found {n}")
        continue
    path.write_text(new)
    print(f"embedded into {path.relative_to(root.parent)}")
