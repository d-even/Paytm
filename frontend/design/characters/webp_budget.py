"""Shared helper: save an RGBA image as WebP under a byte budget."""
import io
from pathlib import Path

from PIL import Image

BUDGET = 60 * 1024


def save_webp(img: Image.Image, path: Path, budget: int = BUDGET) -> None:
    """Lower quality, then size, until the file fits the budget (60 KB by default)."""
    current = img
    while True:
        for quality in (90, 86, 82, 78, 74, 70, 66, 62):
            buf = io.BytesIO()
            current.save(buf, 'WEBP', quality=quality, method=6, alpha_quality=90)
            if buf.tell() <= budget:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(buf.getvalue())
                print(f'{path.name}: {current.size[0]}x{current.size[1]}, q{quality}, {buf.tell() // 1024} KB')
                return
        current = current.resize((round(current.width * 0.9), round(current.height * 0.9)), Image.LANCZOS)
