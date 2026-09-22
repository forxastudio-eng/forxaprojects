// ============================================================================
// FORXA · Migración de los 4 proyectos de Supabase viejos al proyecto nuevo
//
//   node migrar_datos.mjs respaldar porton  → guarda en scripts/respaldo/porton/
//                                             TODAS sus tablas e imágenes
//                                             (también: alabes, cotizador,
//                                             marketing o "todos")
//   node migrar_datos.mjs inspeccionar      → tablas/columnas/conteos de los viejos
//   node migrar_datos.mjs                   → SIMULACIÓN (no escribe nada)
//   node migrar_datos.mjs --ejecutar        → copia datos e imágenes de verdad
//   node migrar_datos.mjs --ejecutar --solo-imagenes → copia SOLO las imágenes
//                                             (cuando los datos ya se migraron)
//
// De dónde lee cada proyecto viejo:
//   · si su service key está en .env → del proyecto en vivo
//   · si no, pero existe scripts/respaldo/<proyecto>/ → del respaldo local
//   · si no hay ninguno de los dos → ese proyecto se omite (con aviso)
// Así puedes respaldar un proyecto, borrarlo para liberar espacio en el plan
// gratuito y migrarlo igual después.
//
// Las service_role keys son secretas: nunca las subas a GitHub ni a Netlify.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RESPALDO = path.join(DIR, "respaldo");
const ENV = leerEnv(path.join(DIR, ".env"));
const ARG = process.argv[2];
const MODO = ["inspeccionar", "respaldar"].includes(ARG) ? ARG : "migrar";
const EJECUTAR = process.argv.includes("--ejecutar");
const SOLO_IMAGENES = process.argv.includes("--solo-imagenes");   // no toca tablas, solo copia Storage

function leerEnv(file) {
  if (!fs.existsSync(file)) { console.error("Falta scripts/.env (copia .env.ejemplo y complétalo)."); process.exit(1); }
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#]*?)\s*(#.*)?$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
function req(k) { if (!ENV[k]) { console.error("Falta " + k + " en scripts/.env"); process.exit(1); } return ENV[k]; }
const cliente = (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------- orígenes
const VIEJOS = {
  alabes:    { url: ENV.ALABES_URL    || "https://mosmktpjozzkzsovwgze.supabase.co", key: ENV.ALABES_SERVICE_KEY },
  porton:    { url: ENV.PORTON_URL    || "https://hrecdyregmnbcmifjmva.supabase.co", key: ENV.PORTON_SERVICE_KEY },
  cotizador: { url: ENV.COTIZADOR_URL || "https://jjdybtskzqpybrltdnss.supabase.co", key: ENV.COTIZADOR_SERVICE_KEY },
  marketing: { url: ENV.MARKETING_URL || "https://igeckdsakwuhnajyeagf.supabase.co", key: ENV.MARKETING_SERVICE_KEY }
};

const TABLAS = [
  { src: "cotizador", t: "cotizador_proyectos",         pk: "id" },
  { src: "cotizador", t: "cotizador_unidades",          pk: "id" },
  { src: "cotizador", t: "cotizador_inventario_extra",  pk: "id" },
  { src: "cotizador", t: "cotizador_asesores",          pk: "id" },
  { src: "cotizador", t: "cotizador_historial",         pk: "id", mapUsuario: "creado_por" },
  { src: "cotizador", t: "cotizador_contador_proforma", pk: "proyecto_id" },
  { src: "cotizador", t: "projects",                    pk: "id", portafolio: true },
  { src: "alabes",    t: "units",                       pk: "code" },
  { src: "alabes",    t: "arcus_units",                 pk: "code" },
  { src: "porton",    t: "lots",                        pk: "code" },
  { src: "porton",    t: "slider_images",               pk: "id", sinColumnas: ["id"] },
  { src: "marketing", t: "dashboard_content",           pk: "id" }
];
const ORDEN_VACIADO = ["cotizador_historial", "cotizador_contador_proforma", "cotizador_inventario_extra",
  "cotizador_unidades", "cotizador_asesores", "cotizador_proyectos", "units", "arcus_units", "lots",
  "slider_images", "projects", "dashboard_content"];

const STORAGE = [
  { src: "alabes",    bucket: "site-images",     dst: "site-images",     prefijo: "" },
  { src: "porton",    bucket: "site-images",     dst: "site-images",     prefijo: "porton/" },
  { src: "cotizador", bucket: "covers",          dst: "site-images",     prefijo: "portafolio/" },
  { src: "cotizador", bucket: "cotizador-media", dst: "cotizador-media", prefijo: "" }
];

// ------------------------------------------------------------- utilidades
function ref(url) { return new URL(url).hostname.split(".")[0]; }

let REGLAS_URL = [];
function prepararReglas(nuevoUrl) {
  REGLAS_URL = STORAGE.map(s => ({
    re: new RegExp("https://" + ref(VIEJOS[s.src].url) + "\\.supabase\\.co/storage/v1/object/public/" + s.bucket + "/", "g"),
    to: nuevoUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + s.dst + "/" + s.prefijo
  }));
}
function reescribir(v) {
  if (typeof v === "string") { let s = v; for (const r of REGLAS_URL) s = s.replace(r.re, r.to); return s; }
  if (Array.isArray(v)) return v.map(reescribir);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = reescribir(v[k]); return o; }
  return v;
}

function rutaNueva(url) {
  if (!/netlify\.app/i.test(url || "")) return url;
  const u = url.toLowerCase();
  if (u.includes("arcus")) return "/arcus/";
  if (u.includes("alabes")) return "/alabes/";
  if (u.includes("porton")) return "/porton/";
  return url;
}
const LANDINGS = [
  { name: "Álabes", url: "/alabes/", tagline: "Suites, departamentos y locales comerciales en la calle del Batán.", cover_url: "assets/covers/alabes.jpg", ubicacion: "Cuenca", tipo: "Suites y locales" },
  { name: "Arcus Suites & Lofts", url: "/arcus/", tagline: "Suites, lofts y espacios comerciales sobre la Remigio Tamariz Crespo.", cover_url: "assets/covers/arcus.jpg", ubicacion: "Cuenca", tipo: "Suites, lofts y locales" },
  { name: "Portón del Valle", url: "/porton/", tagline: "Lotes y desarrollo residencial en el valle de Yunguilla.", cover_url: "assets/covers/porton-del-valle.jpg", ubicacion: "Yunguilla", tipo: "Lotes" }
];

async function traerTodo(sb, tabla) {
  let out = [], desde = 0;
  for (;;) {
    const { data, error } = await sb.from(tabla).select("*").range(desde, desde + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) return out;
    desde += 1000;
  }
}

async function columnas(p) {
  const r = await fetch(p.url.replace(/\/$/, "") + "/rest/v1/", { headers: { apikey: p.key, Authorization: "Bearer " + p.key } });
  if (!r.ok) throw new Error("No se pudo leer el esquema de " + p.url + " (" + r.status + "). ¿La service key es correcta?");
  const j = await r.json();
  const out = {};
  for (const [t, def] of Object.entries(j.definitions || {})) out[t] = Object.keys(def.properties || {});
  return out;
}

async function listarVivo(sb, bucket, carpeta = "") {
  let out = [], offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(carpeta, { limit: 1000, offset });
    if (error) throw error;
    for (const it of data) {
      const ruta = carpeta ? carpeta + "/" + it.name : it.name;
      if (it.id === null) out = out.concat(await listarVivo(sb, bucket, ruta));
      else if (it.name !== ".emptyFolderPlaceholder") out.push({ ruta, tipo: it.metadata && it.metadata.mimetype });
    }
    if (data.length < 1000) return out;
    offset += 1000;
  }
}

async function usuariosVivo(sb) {
  const m = {};
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach(u => { m[u.id] = u.email && u.email.toLowerCase(); });
    if (data.users.length < 1000) return m;
  }
}

// ------------------------------------------------------------------ fuentes
// Misma interfaz para un proyecto en vivo o para su respaldo local.
function fuenteViva(nombre) {
  const p = VIEJOS[nombre], sb = cliente(p.url, p.key);
  return {
    tipo: "en vivo",
    tabla: (t) => traerTodo(sb, t),
    archivos: (bucket) => listarVivo(sb, bucket),
    descargar: async (bucket, ruta) => {
      const { data, error } = await sb.storage.from(bucket).download(ruta);
      if (error) throw error;
      return { buffer: Buffer.from(await data.arrayBuffer()), tipo: data.type };
    },
    usuarios: () => usuariosVivo(sb)
  };
}
function fuenteRespaldo(nombre) {
  const base = path.join(RESPALDO, nombre);
  const leer = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  return {
    tipo: "respaldo local",
    tabla: async (t) => {
      const f = path.join(base, "tablas", t + ".json");
      if (!fs.existsSync(f)) throw new Error("no está en el respaldo");
      return leer(f);
    },
    archivos: async (bucket) => {
      const f = path.join(base, "storage", bucket + ".json");
      return fs.existsSync(f) ? leer(f) : [];
    },
    descargar: async (bucket, ruta) => ({ buffer: fs.readFileSync(path.join(base, "storage", bucket, ruta)), tipo: null }),
    usuarios: async () => {
      const f = path.join(base, "usuarios.json");
      return fs.existsSync(f) ? leer(f) : {};
    }
  };
}
function fuente(nombre) {
  if (VIEJOS[nombre].key) return fuenteViva(nombre);
  if (fs.existsSync(path.join(RESPALDO, nombre))) return fuenteRespaldo(nombre);
  return null;
}

// --------------------------------------------------------------- respaldar
async function respaldar() {
  const pedido = (process.argv[3] || "").toLowerCase();
  const nombres = pedido === "todos" ? Object.keys(VIEJOS) : [pedido];
  if (!nombres.every(n => VIEJOS[n])) {
    console.error("Indica qué respaldar: alabes, porton, cotizador, marketing o todos.\n  Ej.: node migrar_datos.mjs respaldar porton");
    process.exit(1);
  }
  for (const n of nombres) {
    if (!VIEJOS[n].key) { console.log("· " + n + ": falta " + n.toUpperCase() + "_SERVICE_KEY en .env, se omite"); continue; }
    const f = fuenteViva(n), base = path.join(RESPALDO, n);
    console.log("\n=== Respaldando " + n + " (" + VIEJOS[n].url + ") en " + base);
    fs.mkdirSync(path.join(base, "tablas"), { recursive: true });
    let totalFilas = 0, totalArchivos = 0;

    for (const T of TABLAS.filter(x => x.src === n)) {
      try {
        const filas = await f.tabla(T.t);
        fs.writeFileSync(path.join(base, "tablas", T.t + ".json"), JSON.stringify(filas, null, 1));
        totalFilas += filas.length;
        console.log("  ✓ " + T.t.padEnd(30) + String(filas.length).padStart(5) + " filas");
      } catch (e) { console.log("  · " + T.t + ": " + (e.message || e) + " (se omite)"); }
    }
    for (const S of STORAGE.filter(x => x.src === n)) {
      let lista;
      try { lista = await f.archivos(S.bucket); }
      catch (e) { console.log("  · storage " + S.bucket + ": " + (e.message || e) + " (se omite)"); continue; }
      const ok = [];
      for (const a of lista) {
        try {
          const { buffer } = await f.descargar(S.bucket, a.ruta);
          const destino = path.join(base, "storage", S.bucket, a.ruta);
          fs.mkdirSync(path.dirname(destino), { recursive: true });
          fs.writeFileSync(destino, buffer);
          ok.push(a);
        } catch (e) { console.log("  ! " + S.bucket + "/" + a.ruta + ": " + (e.message || e)); }
      }
      fs.mkdirSync(path.join(base, "storage"), { recursive: true });
      fs.writeFileSync(path.join(base, "storage", S.bucket + ".json"), JSON.stringify(ok, null, 1));
      totalArchivos += ok.length;
      console.log("  ✓ storage " + S.bucket.padEnd(22) + String(ok.length).padStart(5) + " de " + lista.length + " archivos");
    }
    if (n === "cotizador") {
      try { fs.writeFileSync(path.join(base, "usuarios.json"), JSON.stringify(await f.usuarios(), null, 1)); console.log("  ✓ correos de usuarios (para el historial)"); }
      catch (e) { console.log("  · usuarios: " + (e.message || e)); }
    }
    fs.writeFileSync(path.join(base, "RESPALDO.txt"),
      "Respaldo de " + n + " (" + VIEJOS[n].url + ")\nFecha: " + new Date().toISOString() +
      "\nFilas: " + totalFilas + " · Archivos: " + totalArchivos + "\n");
    console.log("  Total: " + totalFilas + " filas y " + totalArchivos + " archivos.");
  }
  console.log("\nRevisa que los totales tengan sentido ANTES de borrar el proyecto viejo.");
  console.log("La carpeta scripts/respaldo/ tiene datos de clientes: guárdala en un lugar seguro y no la subas a GitHub.");
}

// ------------------------------------------------------------ inspeccionar
async function inspeccionar() {
  for (const [nombre, p] of Object.entries(VIEJOS)) {
    console.log("\n=== " + nombre + " (" + p.url + ")");
    if (!p.key) {
      console.log(fs.existsSync(path.join(RESPALDO, nombre)) ? "  (sin service key: se usará el respaldo local)" : "  (sin service key en .env, se omite)");
      continue;
    }
    const cols = await columnas(p);
    const sb = cliente(p.url, p.key);
    for (const [t, c] of Object.entries(cols)) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true });
      console.log("  " + t.padEnd(30) + String(count ?? "?").padStart(6) + " filas   " + c.join(", "));
    }
    const { data: buckets } = await sb.storage.listBuckets();
    for (const b of buckets || []) console.log("  [storage] " + b.id + (b.public ? " (público)" : " (privado)") + ": " + (await listarVivo(sb, b.id)).length + " archivos");
  }
}

// ----------------------------------------------------------------- migrar
async function migrar() {
  const NUEVO = { url: req("NUEVO_URL"), key: req("NUEVO_SERVICE_KEY") };
  prepararReglas(NUEVO.url);
  console.log(EJECUTAR ? "\n>>> MODO EJECUCIÓN: se escribirán datos en " + NUEVO.url : "\n>>> SIMULACIÓN (agrega --ejecutar para escribir de verdad)");
  const nuevo = cliente(NUEVO.url, NUEVO.key);
  const colsNuevo = await columnas(NUEVO);

  const fuentes = {};
  for (const n of Object.keys(VIEJOS)) {
    fuentes[n] = fuente(n);
    console.log("  " + n.padEnd(10) + (fuentes[n] ? "→ " + fuentes[n].tipo : "→ SIN DATOS (falta service key y no hay respaldo): se omite"));
  }

  let mapaUsuarios = {};
  if (fuentes.cotizador && !SOLO_IMAGENES) {
    const viejos = await fuentes.cotizador.usuarios();
    const nuevosPorId = await usuariosVivo(nuevo);
    const nuevosPorCorreo = Object.fromEntries(Object.entries(nuevosPorId).map(([id, e]) => [e, id]));
    for (const [id, email] of Object.entries(viejos)) mapaUsuarios[id] = nuevosPorCorreo[email] || null;
  }

  const datos = {};
  if (SOLO_IMAGENES) console.log("  (modo solo imágenes: las tablas no se tocan)");
  for (const T of (SOLO_IMAGENES ? [] : TABLAS)) {
    const f = fuentes[T.src];
    if (!f) continue;
    if (!colsNuevo[T.t]) { console.log("  ! " + T.t + " no existe en el proyecto nuevo: corre los SQL 01–07 primero."); process.exit(1); }
    let filas;
    try { filas = await f.tabla(T.t); }
    catch (e) { console.log("  · " + T.t + ": " + (e.message || e) + ", se omite"); continue; }

    const permitidas = new Set(colsNuevo[T.t]);
    const descartadas = new Set();
    filas = filas.map(fila => {
      const o = {};
      for (const [k, v] of Object.entries(fila)) {
        if ((T.sinColumnas || []).includes(k)) continue;
        if (!permitidas.has(k)) { descartadas.add(k); continue; }
        o[k] = reescribir(v);
      }
      if (T.mapUsuario && o[T.mapUsuario]) o[T.mapUsuario] = mapaUsuarios[o[T.mapUsuario]] ?? null;
      if (T.portafolio) o.url = rutaNueva(o.url);
      return o;
    });
    if (T.portafolio) {
      for (const L of LANDINGS) if (!filas.some(x => x.url === L.url)) {
        filas.push({ ...L, visible: true, sort_order: filas.length + 1 });
        console.log("  + portafolio: se agrega " + L.name + " (no estaba en el portafolio viejo)");
      }
    }
    datos[T.t] = { T, filas };
    console.log("  ✓ " + T.t.padEnd(30) + String(filas.length).padStart(5) + " filas" + (descartadas.size ? "   (columnas ignoradas: " + [...descartadas].join(", ") + ")" : ""));
  }
  const sinUsuario = (datos.cotizador_historial?.filas || []).filter(x => !x.creado_por).length;
  if (sinUsuario) console.log("  · historial: " + sinUsuario + " proformas quedarán sin 'creado_por' (esa persona aún no tiene cuenta en el proyecto nuevo). No afecta a los reportes.");

  const archivos = [];
  for (const S of STORAGE) {
    const f = fuentes[S.src];
    if (!f) continue;
    try {
      const lista = await f.archivos(S.bucket);
      lista.forEach(a => archivos.push({ ...a, S }));
      console.log("  ✓ storage " + S.src + "/" + S.bucket + " → " + S.dst + "/" + S.prefijo + "   " + lista.length + " archivos");
    } catch (e) { console.log("  · storage " + S.src + "/" + S.bucket + ": " + (e.message || e) + " (se omite)"); }
  }

  if (!EJECUTAR) { console.log("\nSimulación terminada. Nada fue modificado."); return; }

  for (const t of ORDEN_VACIADO) {
    if (!datos[t]) continue;
    const { error } = await nuevo.from(t).delete().not(datos[t].T.pk, "is", null);
    if (error) throw new Error("Vaciando " + t + ": " + error.message);
  }
  for (const T of TABLAS) {
    const d = datos[T.t]; if (!d) continue;
    for (let i = 0; i < d.filas.length; i += 500) {
      const lote = d.filas.slice(i, i + 500);
      const { error } = T.sinColumnas ? await nuevo.from(T.t).insert(lote) : await nuevo.from(T.t).upsert(lote, { onConflict: T.pk });
      if (error) throw new Error("Escribiendo " + T.t + ": " + error.message);
    }
    console.log("  → " + T.t + " copiada");
  }

  let ok = 0, fallos = 0;
  for (const a of archivos) {
    try {
      const { buffer, tipo } = await fuentes[a.S.src].descargar(a.S.bucket, a.ruta);
      const up = await nuevo.storage.from(a.S.dst).upload(a.S.prefijo + a.ruta, buffer, { upsert: true, contentType: a.tipo || tipo || undefined });
      if (up.error) throw up.error;
      if (++ok % 25 === 0) console.log("  … " + ok + "/" + archivos.length + " archivos");
    } catch (e) { fallos++; console.log("  ! " + a.S.bucket + "/" + a.ruta + ": " + (e.message || e)); }
  }
  console.log("\nListo. Archivos copiados: " + ok + (fallos ? ", con error: " + fallos : "") + ".");
}

const TAREAS = { respaldar, inspeccionar, migrar };
TAREAS[MODO]().catch(e => { console.error("\nERROR:", e.message || e); process.exit(1); });
