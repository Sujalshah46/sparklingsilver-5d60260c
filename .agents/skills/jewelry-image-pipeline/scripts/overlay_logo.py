#!/usr/bin/env python3
"""Overlay Sparkling Silver logo top-right at 14% width, 90% opacity.
Usage: python overlay_logo.py <input.jpg> <logo.png> <output.jpg>
"""
import sys
from PIL import Image

def overlay(in_path, logo_path, out_path, width_pct=0.14, opacity=0.90, inset=40):
    base = Image.open(in_path).convert("RGB")
    logo = Image.open(logo_path).convert("RGBA")
    W, H = base.size
    lw = int(W * width_pct)
    lh = int(logo.size[1] * (lw / logo.size[0]))
    logo = logo.resize((lw, lh), Image.LANCZOS)
    # apply opacity
    r, g, b, a = logo.split()
    a = a.point(lambda p: int(p * opacity))
    logo.putalpha(a)
    canvas = Image.new("RGBA", base.size)
    canvas.paste(base, (0, 0))
    canvas.paste(logo, (W - lw - inset, inset), logo)
    canvas.convert("RGB").save(out_path, "JPEG", quality=95, subsampling=0)

if __name__ == "__main__":
    overlay(sys.argv[1], sys.argv[2], sys.argv[3])
