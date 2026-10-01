"""
Cuts Mitra (the waving shopkeeper) out of a checkerboard that is baked into
the pixels of the source image (it is not real transparency).

    python3 -m pip install pillow numpy
    python3 design/characters/cutout_mitra.py

Writes to public/illustrations:
  mitra-wave.webp       the whole character, for static use
  mitra-wave-body.webp  everything except the raised forearm and hand
  mitra-wave-hand.webp  the raised forearm and hand, on the same canvas, so the
                        page can rotate it about the elbow (ARM_PIVOT) to wave
  mitra-avatar.webp     a square head crop for chat avatars
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from webp_budget import save_webp

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'public' / 'illustrations'
src = Image.open(HERE / 'mitra-wave-original.png').convert('RGB')
a = np.asarray(src).astype(np.float32)
H, W, _ = a.shape

mx = a.max(axis=2)
mn = a.min(axis=2)
sat = (mx - mn) / np.maximum(mx, 1)
# Checker squares are neutral light greys (about 242 and 254).
cand = (sat < 0.045) & (mn > 226)

filled = np.zeros((H, W), bool)
q = deque()
for y in range(H):
    for x in (0, W - 1):
        if cand[y, x] and not filled[y, x]:
            filled[y, x] = True
            q.append((y, x))
# The gap between the hand-on-hip arm and the body is enclosed checkerboard.
POCKETS = [(515, 677)]
for y, x in POCKETS:
    if cand[y, x]:
        filled[y, x] = True
        q.append((y, x))
for x in range(W):
    for y in (0, H - 1):
        if cand[y, x] and not filled[y, x]:
            filled[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
        if 0 <= ny < H and 0 <= nx < W and not filled[ny, nx] and cand[ny, nx]:
            filled[ny, nx] = True
            q.append((ny, nx))

# Soft edge. The local background is whichever checker grey sits nearby, so
# estimate it from the filled neighbourhood, then un-mix edge pixels from it.
bgval = np.where(filled, mn, 0).astype(np.float32)
wsum = Image.fromarray((filled * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))
vsum = Image.fromarray(np.clip(bgval, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))
w = np.asarray(wsum).astype(np.float32) / 255
local_bg = np.where(w > 0.01, np.asarray(vsum).astype(np.float32) / np.maximum(w, 0.01), 248)
local_bg = np.clip(local_bg, 238, 255)[..., None]

band = np.asarray(Image.fromarray((filled * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
band &= ~filled
d = np.sqrt(((a - local_bg) ** 2).sum(axis=2))
edge_alpha = np.clip((d - 8) / (60 - 8), 0, 1)
alpha = np.where(filled, 0.0, 1.0)
alpha = np.where(band, np.maximum(edge_alpha, 0), alpha)
al = alpha[..., None]
rgb = np.where(al > 0.01, (a - (1 - al) * local_bg) / np.maximum(al, 0.01), 0)
out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
bbox = img.getbbox()
pad = 8
bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, W), min(bbox[3] + pad, H))
img = img.crop(bbox)
print('crop', bbox, img.size)
save_webp(img, OUT / 'mitra-wave.webp')

# Wave layers. The raised hand sits alone above y=352; below that only the
# skin of the forearm moves, so the kurta beside it stays put.
c = np.asarray(img).copy()
ch, cw = c.shape[:2]
yy, xx = np.mgrid[0:ch, 0:cw]
rgb = c[..., :3].astype(int)
cmx = rgb.max(axis=2)
cmn = rgb.min(axis=2)
csat = (cmx - cmn) / np.maximum(cmx, 1)
skin = (csat > 0.2) & (rgb[..., 0] > 190) & (rgb[..., 0] - rgb[..., 2] > 45) & (c[..., 3] > 0)
forearm = skin & (yy >= 340) & (yy < 472) & (xx >= 20) & (xx <= 125)
forearm = np.asarray(Image.fromarray((forearm * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
arm = ((yy < 352) & (xx < 150)) | (forearm & (yy >= 352) & (yy < 472))
# The hand layer carries on under the sleeve cuff (hidden by the body layer)
# so no gap opens at the cuff while it rotates.
hand = c.copy()
hand[~arm] = 0
body = c.copy()
body[arm & (yy < 430), 3] = 0
save_webp(Image.fromarray(hand, 'RGBA'), OUT / 'mitra-wave-hand.webp')
save_webp(Image.fromarray(body, 'RGBA'), OUT / 'mitra-wave-body.webp')
print('arm pivot (canvas px): (72, 462)')

# Square head crop for the chat avatar.
save_webp(img.crop((142, 0, 142 + 330, 330)).resize((256, 256), Image.LANCZOS), OUT / 'mitra-avatar.webp')
