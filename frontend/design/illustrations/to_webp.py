"""Converts the PNGs drawn by placeholders.mjs into WebP files under 60 KB."""
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'characters'))
from webp_budget import save_webp  # noqa: E402

OUT = HERE.parent.parent / 'public' / 'illustrations'
for png in sorted((HERE / 'out').glob('*.png')):
    save_webp(Image.open(png).convert('RGBA'), OUT / f'{png.stem}.webp')
