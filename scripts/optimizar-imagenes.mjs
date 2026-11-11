// Genera versiones WebP (640/1280/1920 px) junto a cada JPG/PNG de site/ y añade
// srcset/sizes a los <img> de las páginas. NO borra ni renombra los originales.
// Uso (en tu computadora, nunca en Netlify):  npm i && node optimizar-imagenes.mjs
// Es idempotente: no regenera lo que ya existe ni duplica srcset.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../site');
const WIDTHS = [640, 1280, 1920];
const MIN_WIDTH = 800;   // por debajo (logos, íconos) no vale la pena
const SKIP = /(^|\/)(brand|logos?|icons?|favicon)[^/]*/i;

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const all = walk(SITE);
const variants = new Map(); // ruta original → [{w, file}]

for (const f of all.filter(f => /\.(jpe?g|png)$/i.test(f))) {
  if (SKIP.test(path.relative(SITE, f))) continue;
  const { width } = await sharp(f).metadata();
  if (!width || width < MIN_WIDTH) continue;
  const list = [];
  for (const w of WIDTHS.filter(w => w < width).concat(width <= 1920 ? [width] : [])) {
    const out = f.replace(/\.(jpe?g|png)$/i, `-${w}.webp`);
    if (!fs.existsSync(out)) await sharp(f).resize({ width: w }).webp({ quality: 78 }).toFile(out);
    list.push({ w, file: out });
  }
  variants.set(f, list);
}

let patched = 0;
for (const page of all.filter(f => f.endsWith('.html'))) {
  const dir = path.dirname(page);
  const html = fs.readFileSync(page, 'utf8');
  const out = html.replace(/<img\b[^>]*>/g, tag => {
    if (/\ssrcset=/.test(tag)) return tag;
    const m = tag.match(/\ssrc="([^"#?]+\.(?:jpe?g|png))"/i);
    if (!m || /^(https?:|data:)/.test(m[1])) return tag;
    const abs = m[1].startsWith('/') ? path.join(SITE, m[1]) : path.join(dir, m[1]);
    const v = variants.get(abs);
    if (!v?.length) return tag;
    const base = m[1].replace(/\.(jpe?g|png)$/i, '');
    const srcset = v.map(x => `${base}-${x.w}.webp ${x.w}w`).join(', ');
    patched++;
    return tag.replace('<img', `<img srcset="${srcset}" sizes="(max-width: 800px) 100vw, 50vw"`);
  });
  if (out !== html) fs.writeFileSync(page, out);
}
console.log(`${variants.size} imágenes con variantes WebP; ${patched} <img> con srcset.`);
