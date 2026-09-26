#!/usr/bin/env python3
"""Generate Android adaptive-icon foregrounds from the real CAREi logo.

ic_launcher_foreground.png per density: transparent canvas, the logo
(white bg + navy C / teal i mark) centered at ~72% so the mark sits inside
the adaptive safe zone. Paired with a white ic_launcher_background the
result matches the Play Store icon on every launcher shape.
"""
from PIL import Image
import os

SRC = r"C:\carei\landing\public\icon-512.png"
RES = r"C:\carei\android\app\src\main\res"

# 108dp adaptive canvas sizes per density bucket
DENSITIES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

logo = Image.open(SRC).convert("RGBA")

for folder, size in DENSITIES.items():
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Place the logo at 72% of canvas — keeps mark inside the ~66% safe zone
    inner = int(size * 0.72)
    scaled = logo.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(scaled, (off, off))
    out = os.path.join(RES, folder, "ic_launcher_foreground.png")
    canvas.save(out)
    print("wrote", out, f"{size}x{size}")
