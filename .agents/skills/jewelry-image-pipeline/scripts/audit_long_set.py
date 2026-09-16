#!/usr/bin/env python3
"""Mechanical preflight for Antique Long Set outputs; visual source review is still mandatory."""
import argparse
import json
from pathlib import Path
from PIL import Image
import numpy as np

def audit(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im)
    h, w = a.shape[:2]
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # Detect jewellery-coloured pixels, not the green set or white logo.
    product = ((r > 75) & (r > g * 1.035) & (g > b * 1.08)) | ((r > 60) & (r > g * 1.2))
    product[:, round(w * .80):] = False
    ys, xs = np.where(product)
    margins = {
        "left": float(xs.min() / w * 100) if len(xs) else 0,
        "right": float((w - 1 - xs.max()) / w * 100) if len(xs) else 0,
        "top": float(ys.min() / h * 100) if len(ys) else 0,
        "bottom": float((h - 1 - ys.max()) / h * 100) if len(ys) else 0,
    }
    logo = a[:round(h*.18), round(w*.82):]
    white_logo_pixels = int(np.all(logo > 200, axis=2).sum())
    return {
        "file": path.name,
        "dimensions": [w, h],
        "square_2000": w == 2000 and h == 2000,
        "detected_content_margins_percent": margins,
        "boundary_clear": all(v >= 7.5 for v in margins.values()),
        "logo_present": white_logo_pixels > 250,
        "manual_source_comparison_required": True,
    }

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("images", nargs="+")
    p.add_argument("--output")
    args = p.parse_args()
    report = [audit(Path(x)) for x in args.images]
    text = json.dumps(report, indent=2)
    if args.output:
        Path(args.output).write_text(text)
    print(text)