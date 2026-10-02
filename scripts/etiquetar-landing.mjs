/* FORXA · Etiquetador de landings
   Recorre el HTML de una landing y agrega atributos data-cms* a todo lo que
   puede editarse desde el panel (textos, imágenes, enlaces, listas…), SIN
   cambiar el diseño ni el formato del archivo (solo inserta atributos).

   Uso:  node etiquetar-landing.mjs <pagina>        (alabes | arcus | porton | home)
         node etiquetar-landing.mjs <pagina> --check (solo informa, no escribe)

   Es idempotente: si la página ya tiene data-cms, no hace nada.
   Para páginas nuevas: agrega su configuración en CONFIG y ejecútalo una vez. */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

const SITE = process.env.FORXA_SITE || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');

/* ----------------------------------------------------------------- config */
const LISTAS_COMUNES = [
  { clase: 'gallery-grid', etiqueta: 'Fotos de la galería', item: 'Foto', cls: 'wide:Doble ancho,tall:Doble alto,arch:Forma de arco' },
  { clase: 'amenities-grid', etiqueta: 'Amenidades', item: 'Amenidad' },
  { clase: 'poi-list', etiqueta: 'Puntos de interés cercanos', item: 'Punto' },
  { clase: 'about__badges', etiqueta: 'Cifras destacadas', item: 'Cifra' },
  { clase: 'hero__stats', etiqueta: 'Cifras de la portada', item: 'Cifra' },
  { clase: 'plans-grid', etiqueta: 'Planos / plantas', item: 'Plano' },
];
const CONFIG = {
  alabes: {
    archivo: 'alabes/index.html', base: '/alabes/',
    listas: [...LISTAS_COMUNES, { clase: 'location__maps', etiqueta: 'Mapas de ubicación', item: 'Mapa' }],
  },
  arcus: {
    archivo: 'arcus/index.html', base: '/arcus/',
    listas: [...LISTAS_COMUNES,
      { clase: 'location__maps', etiqueta: 'Mapas de ubicación', item: 'Mapa' },
      { clase: 'marquee__track', etiqueta: 'Cinta de frases (se repite en bucle)', item: 'Frase', repetir: 2 }],
  },
  porton: {
    archivo: 'porton/index.html', base: '/porton/',
    listas: [...LISTAS_COMUNES,
      { clase: 'benefits-list', etiqueta: 'Beneficios', item: 'Beneficio' },
      { clase: 'showcase', etiqueta: 'Zonas exclusivas', item: 'Zona' },
      { clase: 'lotes-perks', etiqueta: 'Ventajas de compra', item: 'Ventaja' }],
  },
  home: { archivo: 'index.html', base: '/', listas: [] },
};

// Contenido que el propio sitio rellena por código (no se etiqueta).
const OMITIR_IDS = new Set(['grid-suites', 'grid-lofts', 'grid-a', 'grid-b', 'grid-c', 'localesGrid', 'lotesTable',
  'lotsSvg', 'mapTooltip', 'filters', 'grid', 'lightbox', 'lotesCount', 'formStatus', 'year', 'countSuites', 'countLofts',
  'countLocales', 'c-proyecto', 'c-error', 'interactiveMap', 'progressBar']);
const OMITIR_CLASES = ['location-slider'];   // el carrusel de Portón se edita en "Slider de Portón" (base de datos)
const OMITIR_TAGS = new Set(['script', 'style', 'svg', 'noscript', 'template', 'select', 'option', 'symbol', 'defs', 'head']);
const FORMATO = new Set(['em', 'strong', 'b', 'u', 'br', 'mark', 'sup', 'sub']);

const ETIQ_GRUPO = {
  header: 'Menú superior', inicio: 'Portada', proyecto: 'Sobre el proyecto', ubicacion: 'Ubicación',
  amenidades: 'Amenidades', tipologias: 'Suites y tipologías', locales: 'Locales comerciales', planos: 'Plantas y distribución',
  galeria: 'Galería', contacto: 'Contacto', mapa: 'Mapa interactivo', lotes: 'Lotes', exclusivo: 'Zonas exclusivas',
  proyectos: 'Proyectos', footer: 'Pie de página', marquee: 'Cinta de frases', hero: 'Portada',
};

/* ------------------------------------------------------------- utilidades */
const attr = (n, k) => (n.attrs || []).find(a => a.name === k)?.value;
const clases = n => (attr(n, 'class') || '').split(/\s+/).filter(Boolean);
const esEl = n => !!n.tagName;
const kids = n => (n.childNodes || []).filter(esEl);
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const txt = n => (n.childNodes || []).map(c => c.nodeName === '#text' ? c.value : esEl(c) ? txt(c) : '').join('');
const limpio = s => s.replace(/\s+/g, ' ').trim();

function rol(n) {
  for (let p = n.parentNode, i = 0; p && p.tagName && i < 4; p = p.parentNode, i++) {
    if (/^h[1-3]$/.test(p.tagName)) return p.tagName === 'h1' ? ['titulo-principal', 'Título principal'] : p.tagName === 'h2' ? ['titulo', 'Título'] : ['subtitulo', 'Subtítulo'];
  }
  const t = n.tagName, c = clases(n).join(' ');
  if (/hero-place/.test(c)) return ['etiqueta', 'Sobretítulo'];
  if (/hero-lead/.test(c)) return ['descripcion', 'Descripción'];
  if (/eyebrow|kicker/.test(c)) return ['etiqueta', 'Sobretítulo'];
  if (t === 'h1') return ['titulo-principal', 'Título principal'];
  if (t === 'h2') return ['titulo', 'Título'];
  if (t === 'h3' || t === 'h4') return ['subtitulo', 'Subtítulo'];
  if (t === 'blockquote') return ['cita', 'Frase destacada'];
  if (t === 'cite') return ['cita-autor', 'Autor de la frase'];
  if (t === 'figcaption') return ['pie', 'Pie de foto'];
  if (t === 'label') return ['campo', 'Etiqueta del campo'];
  if (t === 'th') return ['columna', 'Columna'];
  if (t === 'button' || (t === 'a' && /\bbtn\b/.test(c))) return ['boton', 'Botón'];
  if (t === 'a') return ['enlace', 'Enlace'];
  if (t === 'strong' || t === 'b') return ['dato', 'Dato destacado'];
  if (t === 'em') return ['destacado', 'Texto destacado'];
  if (t === 'i') return ['numero', 'Número / viñeta'];
  if (t === 'p') return /hero__tagline/.test(c) ? ['lema', 'Lema'] : /hero__desc/.test(c) ? ['descripcion', 'Descripción'] : ['texto', 'Párrafo'];
  if (t === 'span') return ['detalle', 'Texto'];
  if (t === 'div') return ['texto', 'Texto'];
  return ['texto', 'Texto'];
}

/* ------------------------------------------------------------------- main */
export function etiquetar(nombre, soloVerificar) {
  const cfg = CONFIG[nombre];
  if (!cfg) throw new Error('Página desconocida: ' + nombre);
  const file = path.join(SITE, cfg.archivo);
  const src = fs.readFileSync(file, 'utf8');
  if (/data-cms/.test(src)) return { yaEtiquetada: true };
  const doc = parse(src, { sourceCodeLocationInfo: true });

  const ins = [];               // {pos, text, ord}
  let ord = 0;
  const add = (pos, text) => ins.push({ pos, text, ord: ord++ });
  const attrsPorNodo = new Map(); // nodo → [" data-cms=…"]
  const addAttr = (n, s) => { (attrsPorNodo.get(n) || attrsPorNodo.set(n, []).get(n)).push(s); };

  const usados = new Set();
  const campos = [];            // informe
  const html = doc.childNodes.find(n => n.tagName === 'html');
  const head = kids(html).find(n => n.tagName === 'head');
  const body = kids(html).find(n => n.tagName === 'body');

  addAttr(html, ` data-cms-page="${nombre}"`);

  /* ---- <head>: SEO ---- */
  addAttr(head, ' data-cms-group="Pestaña del navegador y buscadores"');
  for (const n of kids(head)) {
    if (n.tagName === 'title') {
      addAttr(n, ' data-cms="seo.titulo" data-cms-label="Título de la página (pestaña y Google)"');
      campos.push('seo.titulo');
    } else if (n.tagName === 'meta' && attr(n, 'name') === 'description') {
      addAttr(n, ' data-cms-attr="content:seo.descripcion" data-cms-label="Descripción para Google" data-cms-type="textarea"');
      campos.push('seo.descripcion');
    } else if (n.tagName === 'link' && /icon/.test(attr(n, 'rel') || '') && !/apple/.test(attr(n, 'rel')) && !/32/.test(attr(n, 'sizes') || '')) {
      addAttr(n, ' data-cms-attr="href:seo.icono" data-cms-label="Icono de la pestaña (favicon)" data-cms-type="image"');
      campos.push('seo.icono');
    }
  }

  /* ---- grupos (secciones de primer nivel) ---- */
  const grupos = [];
  const candidatos = [];
  for (const n of kids(body)) {
    if (n.tagName === 'main') candidatos.push(...kids(n)); else candidatos.push(n);
  }
  const SECCIONALES = new Set(['header', 'section', 'footer', 'div']);
  for (const n of candidatos) {
    if (!SECCIONALES.has(n.tagName)) continue;
    if (n.tagName === 'div' && !clases(n).includes('marquee')) continue;
    grupos.push(n);
  }
  const conteoGrupo = {};
  for (const g of grupos) {
    const id = attr(g, 'id') || '';
    let gslug = id || (g.tagName === 'div' ? clases(g)[0] : g.tagName);
    let etiqueta = ETIQ_GRUPO[id] || ETIQ_GRUPO[clases(g)[0]] || ETIQ_GRUPO[g.tagName];
    if (!etiqueta) {
      const k = findFirst(g, x => /eyebrow|kicker/.test(clases(x).join(' ')));
      etiqueta = k ? limpio(txt(k)) : (clases(g)[0] || g.tagName);
      if (!id) gslug = slug(etiqueta) || gslug;
    }
    if (g.tagName === 'section' && !id && clases(g).includes('statement')) { etiqueta = 'Frase destacada'; gslug = 'frase'; }
    conteoGrupo[gslug] = (conteoGrupo[gslug] || 0) + 1;
    if (conteoGrupo[gslug] > 1) gslug += '-' + conteoGrupo[gslug];
    g._grupo = gslug;
    addAttr(g, ` data-cms-group="${escAttr(etiqueta)}"`);
    if (g.tagName === 'section' && gslug !== 'inicio' && gslug !== 'hero') addAttr(g, ` data-cms-show="mostrar.${gslug}"`);
  }

  /* ---- marcar listas ---- */
  const listaDe = new Map();   // nodo contenedor → cfg lista
  (function buscar(n) {
    if (!esEl(n)) return;
    for (const l of cfg.listas) {
      if (clases(n).includes(l.clase) && !listaDe.has(n)) listaDe.set(n, l);
    }
    kids(n).forEach(buscar);
  })(body);

  /* ---- contexto de procesamiento ---- */
  function nuevoContador() { return {}; }
  function claveUnica(base) {
    let k = base, i = 2;
    while (usados.has(k)) k = base + '-' + (i++);
    usados.add(k);
    return k;
  }

  function procesar(n, ctx) {
    if (!esEl(n)) return;
    const t = n.tagName;
    if (t === 'svg' && ctx.item) { kids(n).filter(x => x.tagName === 'use').forEach(u => campo(u, ctx)); return; }
    if (OMITIR_TAGS.has(t)) return;
    const id = attr(n, 'id');
    if (id && OMITIR_IDS.has(id)) return;
    if (attr(n, 'data-cms-skip') !== undefined) return;
    if (clases(n).some(x => OMITIR_CLASES.includes(x))) return;

    let c = ctx;
    if (n._grupo && !ctx.item) c = { ...ctx, grupo: n._grupo, cont: nuevoContador() };

    /* listas */
    if (listaDe.has(n) && !ctx.item) {
      const l = listaDe.get(n);
      const key = claveUnica(`${ctx.grupo}.lista-${slug(l.clase)}`);
      let attrs = ` data-cms-list="${key}" data-cms-label="${escAttr(l.etiqueta)}" data-cms-noun="${escAttr(l.item)}"`;
      if (l.cls) attrs += ` data-cms-cls="${escAttr(l.cls)}"`;
      if (l.repetir) attrs += ` data-cms-repeat="${l.repetir}"`;
      addAttr(n, attrs);
      campos.push(key + ' (lista)');
      const hijos = kids(n).filter(h => !OMITIR_TAGS.has(h.tagName));
      hijos.forEach((it, idx) => {
        if (l.repetir && idx >= hijos.length / l.repetir) return;   // las copias del bucle no se etiquetan
        const cont = nuevoContador();
        itemRaiz(it, cont);
        const ci = { ...c, item: true, cont };
        campo(it, ci);
        if (!it._hoja) recorrerHijos(it, ci);
      });
      return;
    }

    campo(n, c);
    // Los elementos con texto propio ya se trataron; seguimos con los hijos
    if (!n._hoja) recorrerHijos(n, c);
  }

  function recorrerHijos(n, c) { kids(n).forEach(h => procesar(h, c)); }

  function itemRaiz(it, cont) {
    for (const a of ['data-title']) {
      if (attr(it, a) !== undefined) { addAttr(it, ` data-cms-attr="${a}:titulo-ampliado"`); }
    }
  }

  function nombreCampo(n, c, base) {
    // relativo dentro de listas; absoluto fuera
    const [r] = rol(n);
    const nombre = base || r;
    c.cont[nombre] = (c.cont[nombre] || 0) + 1;
    const rel = c.cont[nombre] > 1 ? `${nombre}-${c.cont[nombre]}` : nombre;
    return c.item ? rel : claveUnica(`${c.grupo || 'pagina'}.${rel}`);
  }
  function etiquetaCampo(n, key, base) {
    const [, lab] = rol(n);
    const num = (key.match(/-(\d+)$/) || [])[1];
    return (base || lab) + (num ? ' ' + num : '');
  }

  function campo(n, c) {
    const t = n.tagName, cl = clases(n);
    const reg = k => campos.push(k);

    /* imágenes */
    if (t === 'img') {
      if (n === lightboxImg) return;
      const key = nombreCampo(n, c, 'imagen');
      const pc = clases(n.parentNode || {}).join(' ') + ' ' + clases(n).join(' ');
      const esLogo = /brand|logo|footer__forxa|footer__adrian/.test(pc);
      addAttr(n, ` data-cms-img="${key}" data-cms-label="${escAttr(etiquetaCampo(n, key, esLogo ? 'Logotipo' : 'Imagen'))}"`);
      reg(key); n._hoja = true; return;
    }
    /* video */
    if (t === 'video') {
      if (attr(n, 'poster') !== undefined) {
        const key = nombreCampo(n, c, 'video-portada');
        addAttr(n, ` data-cms-attr="poster:${key}" data-cms-label="Imagen de carga del video" data-cms-type="image"`);
        reg(key);
      }
      for (const s of kids(n).filter(x => x.tagName === 'source')) {
        const tipo = attr(s, 'type') || '';
        const key = nombreCampo(s, c, 'video-' + (tipo.split('/')[1] || 'archivo'));
        addAttr(s, ` data-cms-attr="src:${key}" data-cms-label="${escAttr('Video de fondo (' + (tipo.split('/')[1] || '').toUpperCase() + ')')}" data-cms-type="video"`);
        reg(key);
      }
      n._hoja = true; return;
    }
    /* íconos dentro de listas */
    if (t === 'use' && c.item) {
      const key = nombreCampo(n, c, 'icono');
      addAttr(n, ` data-cms-icon="${key}" data-cms-label="Ícono"`);
      reg(key); return;
    }
    /* campos de formulario */
    if ((t === 'input' || t === 'textarea') && attr(n, 'placeholder') !== undefined) {
      const key = nombreCampo(n, c, 'ejemplo');
      addAttr(n, ` data-cms-attr="placeholder:${key}" data-cms-label="Texto de ejemplo del campo"`);
      reg(key); return;
    }

    /* enlaces */
    let extra = '';
    if (t === 'a') {
      const href = attr(n, 'href') || '';
      if (/wa\.me/.test(href)) extra = ' data-cms-wa';
      else if (!href.startsWith('#') && !/^\/(admin|cotizador)\//.test(href) && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const key = nombreCampo(n, c, 'enlace-url');
        extra = ` data-cms-href="${key}"`;
        reg(key);
      }
    }

    /* contadores animados */
    if (attr(n, 'data-count') !== undefined) {
      const key = nombreCampo(n, c, 'cifra');
      addAttr(n, ` data-cms-attr="data-count:${key}" data-cms-label="Cifra (número)" data-cms-type="number"`);
      reg(key); n._hoja = true; return;
    }

    /* ¿tiene texto propio? */
    const nodos = n.childNodes || [];
    const textos = nodos.filter(x => x.nodeName === '#text' && x.value.trim());
    const hijos = nodos.filter(esEl);
    if (!textos.length) { if (extra) addAttr(n, extra); return; }
    if (t === 'a' && attr(n, 'data-cms-wa') === undefined && extra === '' && (attr(n, 'href') || '').startsWith('#') && cl.includes('nav-more')) { /* texto normal */ }

    const soloFormato = hijos.every(h => FORMATO.has(h.tagName));
    if (soloFormato) {
      const key = nombreCampo(n, c);
      const lab = etiquetaCampo(n, key);
      const tipo = hijos.length ? 'data-cms-html' : 'data-cms';
      addAttr(n, ` ${tipo}="${key}" data-cms-label="${escAttr(lab)}"${extra}`);
      if (['texto', 'descripcion', 'cita'].includes(rol(n)[0]) || txt(n).trim().length > 70) addAttr(n, ' data-cms-type="textarea"');
      reg(key); n._hoja = true; return;
    }
    // Mezcla de texto y elementos: envolvemos cada trozo de texto en un <span>.
    if (extra) addAttr(n, extra);
    for (const tn of textos) {
      const loc = tn.sourceCodeLocation; if (!loc) continue;
      const raw = src.slice(loc.startOffset, loc.endOffset);
      const ini = raw.length - raw.trimStart().length;
      const fin = raw.trimEnd().length;
      const [rp, lp] = rol(n);
      const base = (rp === 'etiqueta' || rp.startsWith('titulo') || rp === 'subtitulo') ? rp : 'texto';
      const key = nombreCampo(n, c, base);
      const lab = n.tagName === 'a' || n.tagName === 'button' ? 'Texto del botón' : etiquetaCampo(n, key, base === 'texto' ? 'Texto' : lp);
      add(loc.startOffset + ini, `<span data-cms="${key}" data-cms-label="${escAttr(lab)}">`);
      add(loc.startOffset + fin, '</span>');
      reg(key);
    }
  }

  let lightboxImg = null;
  (function f(n) { if (esEl(n)) { if (attr(n, 'id') === 'lightboxImg') lightboxImg = n; kids(n).forEach(f); } })(body);

  function findFirst(n, fn) {
    for (const k of kids(n)) { if (fn(k)) return k; const r = findFirst(k, fn); if (r) return r; }
    return null;
  }

  // Los grupos reciben su contexto; los elementos del <body> fuera de grupos (lightbox, flotante) usan 'pagina'.
  const ctxBase = { grupo: 'pagina', cont: nuevoContador() };
  (function recorrerBody(n, c) {
    for (const h of kids(n)) {
      if (h.tagName === 'main') { recorrerBody(h, c); continue; }
      procesar(h, c);
    }
  })(body, ctxBase);

  // Enlaces de WhatsApp fuera de grupos (botón flotante)
  /* (ya cubiertos por procesar → campo → data-cms-wa) */

  /* ---- aplicar atributos a las etiquetas de apertura ---- */
  for (const [n, partes] of attrsPorNodo) {
    const loc = n.sourceCodeLocation?.startTag; if (!loc) continue;
    let pos = loc.endOffset - 1;
    if (src[pos - 1] === '/') pos -= 1;
    add(pos, partes.join(''));
  }
  ins.sort((a, b) => b.pos - a.pos || b.ord - a.ord);
  let out = src;
  for (const e of ins) out = out.slice(0, e.pos) + e.text + out.slice(e.pos);

  if (!soloVerificar) fs.writeFileSync(file, out);
  return { campos: campos.length, listas: [...listaDe.values()].length, muestra: campos };
}

if (process.argv[1].endsWith('tagger.mjs') || process.argv[1].endsWith('etiquetar-landing.mjs')) {
  const nombre = process.argv[2];
  const r = etiquetar(nombre, process.argv.includes('--check'));
  console.log(nombre, r.yaEtiquetada ? 'ya etiquetada' : `${r.campos} campos, ${r.listas} listas`);
  if (process.argv.includes('--verbose') && r.muestra) console.log(r.muestra.join('\n'));
}
