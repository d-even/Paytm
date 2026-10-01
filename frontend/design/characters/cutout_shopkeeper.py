"""
Cuts the shopkeeper character out of her cream studio background.

    python3 -m pip install pillow numpy
    python3 design/characters/cutout_shopkeeper.py

Writes public/illustrations/merchant-payment.webp.
The ground shadow is removed on purpose: the app draws its own shadow so it
can move with the character. Overlay coordinates in MerchantPayment.tsx are in
the cropped image's pixel space, so re-check them if the crop box changes.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from webp_budget import save_webp

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'public' / 'illustrations' / 'merchant-payment.webp'

src = Image.open(HERE / 'shopkeeper-original.png').convert('RGB')
a = np.asarray(src).astype(np.float32)
H, W, _ = a.shape
border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
bg = np.median(border, axis=0)
d = np.sqrt(((a - bg) ** 2).sum(axis=2))

T = 16.0
cand = d < T
filled = np.zeros((H, W), bool)

def flood(seeds):
    q = deque(seeds)
    for y, x in seeds:
        filled[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and not filled[ny, nx] and cand[ny, nx]:
                filled[ny, nx] = True
                q.append((ny, nx))

seeds = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]
flood([s for s in seeds if cand[s]])

# Ground shadow under the feet: warm, darker copies of the background colour.
# They are grown out from the background so toes and sandals are never touched;
# the page draws its own shadow that moves with the character.
mx = a.max(axis=2); mn = a.min(axis=2)
sat = (mx - mn) / np.maximum(mx, 1)
rgbn = a / 255.0
hue = np.degrees(np.arctan2(np.sqrt(3) * (rgbn[..., 1] - rgbn[..., 2]), 2 * rgbn[..., 0] - rgbn[..., 1] - rgbn[..., 2])) % 360
shadowy = (hue > 8) & (hue < 55) & (sat < 0.2) & (mx > 150)
limit = np.full(W, 1362)
limit[:318] = 1290
rows = np.arange(H)[:, None]
shadowy &= rows >= limit[None, :]
# Beside the sari the shadow meets its cream border, which is more saturated.
shadowy &= (rows >= 1362) | (sat < 0.12)
q = deque()
ys, xs = np.nonzero(filled[1290:])
for y, x in zip(ys + 1290, xs):
    q.append((y, x))
while q:
    y, x = q.popleft()
    for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
        if 0 <= ny < H and 0 <= nx < W and not filled[ny, nx] and shadowy[ny, nx]:
            filled[ny, nx] = True
            q.append((ny, nx))

alpha = np.where(filled, 0.0, 1.0)
# Soft edge: in a thin band around the cut, alpha follows distance from the background colour.
fm = Image.fromarray((filled * 255).astype(np.uint8))
band = np.asarray(fm.filter(ImageFilter.MaxFilter(5))) > 0
band &= ~filled
lo, hi = 6.0, 42.0
edge_alpha = np.clip((d - lo) / (hi - lo), 0, 1)
alpha = np.where(band, edge_alpha, alpha)
# Remove the background tint from semi-transparent edge pixels.
al = alpha[..., None]
rgb = np.where(al > 0.01, (a - (1 - al) * bg) / np.maximum(al, 0.01), 0)
rgb = np.clip(rgb, 0, 255)
out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
bbox = img.getbbox()
pad = 8
bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, W), min(bbox[3] + pad, H))
img = img.crop(bbox)
print('crop', bbox, img.size)
save_webp(img, OUT)
