# Recorta el plano de cada ficha (suites/lofts) sobre fondo plano -> site/arcus/img/unidades/<CODIGO>.webp
import glob, os
from PIL import Image
import numpy as np
SRC = "site/arcus/img/fichas"; OUT = "site/arcus/img/unidades"
BG = (227, 220, 210)  # beige de la ficha
for f in sorted(glob.glob(SRC + "/SUITE-*.jpg") + glob.glob(SRC + "/LOFT-*.jpg")):
    im = Image.open(f).convert("RGB").crop((440, 130, 1521, 765))
    a = np.asarray(im).astype(int)
    bgc = np.median(a.reshape(-1, 3), axis=0)
    d = np.abs(a - bgc).sum(axis=2)
    flat = np.where(d[..., None] < 40, np.array(BG), a).astype("uint8")  # borra el patrón de montañas
    m = d > 40
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    plan = Image.fromarray(flat).crop((x0, y0, x1 + 1, y1 + 1))
    W, H = 1000, 750
    plan.thumbnail((W - 80, H - 80), Image.LANCZOS)
    c = Image.new("RGB", (W, H), BG)
    c.paste(plan, ((W - plan.width) // 2, (H - plan.height) // 2))
    c.save(os.path.join(OUT, os.path.basename(f)[:-4] + ".webp"), quality=85)
