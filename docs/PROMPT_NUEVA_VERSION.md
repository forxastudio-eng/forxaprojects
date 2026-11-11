# Prompt para construir la nueva versión de la plataforma FORXA

Copia todo lo que está dentro del bloque y pégalo en una sesión nueva de Claude Code abierta sobre el repositorio `forxastudio-eng/forxaprojects`. Conviene trabajar **una fase por sesión**: cambia la línea `FASE A EJECUTAR` en cada sesión.

---

```text
Eres el desarrollador principal de la plataforma web de FORXA Inmobiliaria
(repositorio forxastudio-eng/forxaprojects). Vas a construir la nueva versión
de la web MEJORANDO lo que ya existe, no reescribiéndolo.

FASE A EJECUTAR: Fase 1   ← (cambia a Fase 2, 3 o 4 en cada sesión)

## 1. Lee primero (obligatorio, antes de tocar nada)
- docs/PLAN_MEJORA_WEB.md   ← plan aprobado: hallazgos S1–S12, R1–R9 y las fases
- README.md                 ← arquitectura, roles y puesta en marcha
- netlify.toml, site/js/forxa-config.js, site/js/cms.js
- supabase/01…15*.sql       ← esquema, RLS y funciones (en orden)
Resume en 10 líneas lo que entendiste y la lista exacta de cambios de la fase
antes de empezar.

## 2. Reglas que no se rompen
1. No cambies la estructura de la web: las mismas URLs (/, /alabes/, /arcus/,
   /porton/, /cotizador/, /admin/, /marketing/, /privacidad/, /cookies/), las
   mismas carpetas, el mismo Netlify (publica site/) y el mismo proyecto de
   Supabase (nvbqfckuqpdjterypszb).
2. No cambies la identidad visual de ningún proyecto. FORXA: azul #1D62DB /
   #3C9FF4, Lexend + Hanken Grotesk. Arcus, Álabes, Portón del Valle, AURA y
   15 Patios (#352B23 / #BD603F) conservan su paleta, tipografía y logos.
   Mejora sobre esa base; no la reemplaces.
3. Base de datos: solo cambios aditivos e idempotentes, en un archivo nuevo
   supabase/NN_descripcion.sql (if not exists, on conflict, create or replace).
   Nunca borres columnas ni datos. Si tocas datos, primero haz un respaldo en
   migracion.respaldo_<tabla>_<fecha>. Los permisos los hace cumplir RLS con
   tiene_rol()/mi_rol(); mantén ese modelo.
4. Sin frameworks ni dependencias nuevas en el sitio publicado, salvo las que
   la fase nombre. Los scripts de Node (sharp, etc.) van en scripts/ y no se
   publican.
5. Imágenes: nunca borres ni renombres los originales. Genera las versiones
   AVIF/WebP al lado y úsalas con <picture>, con el JPG como respaldo.
6. Seguridad: todo texto que venga de la base y se inserte como HTML pasa por
   un único esc(). La CSP entra primero como Content-Security-Policy-Report-Only.
   No pongas claves secretas en el front (solo la anon key, que ya está en
   forxa-config.js).
7. Un PR por fase (o por tema si la fase es grande). Ramas claude/<tema>.
   Nunca hagas push a main.

## 3. Criterios de diseño (usa las skills)
- /anthropic-skills:ui-ux-pro-max para reglas de accesibilidad, interacción,
  rendimiento y patrones. Verifica cada sugerencia contra la marca:
  descarta paletas o tipografías que reemplacen la identidad existente.
- /anthropic-skills:impeccable: `audit` al empezar y al terminar la fase
  (puntaje 0–4 por dimensión), `optimize` para rendimiento, `adapt` para
  móvil, `harden` para errores y casos límite, `polish` antes del PR. Para
  la home y las landings usa el modo Persuade (la primera pantalla muestra
  la oferta real: fotos, proyecto, precio desde, disponibilidad y una acción
  que funcione). Para el cotizador, el panel y marketing usa el modo Operate
  (escaneabilidad, consistencia, foco visible, estados de carga).
- Mínimos siempre: contraste de 4,5:1; :focus-visible con anillo de 2 px;
  objetivos táctiles de 44 px; alt en todas las imágenes; prefers-reduced-motion
  con estado final estático; video con póster, botón de pausa y pausa fuera de
  pantalla; íconos SVG (nunca emojis); width/height o aspect-ratio en toda
  imagen (CLS < 0,1).

## 4. Qué construir en cada fase (detalle en docs/PLAN_MEJORA_WEB.md §5)
Fase 1 · Ganancias rápidas
- netlify.toml: HSTS, Permissions-Policy, CSP Report-Only (permitir: self,
  *.supabase.co, cdn.jsdelivr.net, cdnjs.cloudflare.com, fonts.googleapis.com,
  fonts.gstatic.com, wa.me) y Cache-Control de 7 días + stale-while-revalidate
  para /assets/*, /*/img/*, *.css y *.js.
- supabase-js con versión exacta + integrity (SRI) + crossorigin en todas las
  páginas que lo cargan.
- supabase/15_endurecimiento.sql:
  - revoke execute from anon en mi_rol, tiene_rol, siguiente_numero_proforma
    y sincronizar_estado_cotizador; revoke from authenticated en
    sincronizar_estado_cotizador.
  - revoke all on las tablas internas from anon.
  - search_path fijo en set_updated_at, codigo_cotizador y
    migracion.reasociar_autores.
  - Índices en cotizador_historial(creado_por) y (proyecto_id).
  - (select auth.uid()) y (select auth.jwt()) en las 3 políticas que señala el
    asesor de Supabase; fusionar las políticas permisivas duplicadas.
  - Límites de 8 MB y tipos MIME en los buckets.
- loading="lazy" decoding="async" + width/height bajo la primera pantalla;
  fetchpriority="high" en el hero.
- Quitar <source src="video/hero-arcus.mp4"> (archivo borrado).
- Fuentes: de @import a <link rel=preconnect> + <link>; quitar las familias
  que no se usan del cotizador.
- Cotizador: firmar las URLs en lote con storage.createSignedUrls.
Fase 2 · Imágenes, video, SEO y accesibilidad
- scripts/optimizar-imagenes.mjs con sharp (AVIF y WebP en 640, 1280 y 1920)
  y actualización de las páginas a <picture>.
- Al subir desde el panel: redimensionar a 2000 px máximo y convertir a WebP
  en el navegador antes de enviar.
- Video de Portón: 720p, unos 1,5 MB; solo póster en móvil y con Save-Data;
  pausa fuera de pantalla con IntersectionObserver; botón de pausa.
- og:* / twitter:* con imagen, JSON-LD (RealEstateAgent, Residence/Offer),
  robots.txt (excluir /admin/, /cotizador/, /marketing/) y sitemap.xml.
- A11y: :focus-visible, contraste sobre fotos, 44 px.
- Responsive: grilla de cifras de Álabes, un solo CTA de WhatsApp en el hero
  móvil, navegación de Arcus agrupada en "Unidades".
- esc() compartido y allowlist en cms.js.
Fase 3 · Funcionalidad
- Home Persuade: primera pantalla con los proyectos reales (foto, "desde $",
  "N disponibles" en vivo, filtro por tipo y ubicación). Agregar 15 Patios a
  public.projects.
- Tabla leads con RLS (anon solo insert; leen editor, administrador y
  marketing), Cloudflare Turnstile, formulario que guarda y luego abre
  WhatsApp, bandeja de leads en /admin/ con estados y exportación a Excel.
- "Agendar visita" en cada landing (guarda un lead de tipo visita).
- Distintivo "Quedan N" en las landings con los estados ya sincronizados.
- Cotizador: PDF directo (librería cargada solo al pulsar), enlace de solo
  lectura con token, duplicar proforma, filtros de unidades.
- Marketing: leads por proyecto y fuente; conversión de lead a proforma.
- Analítica sin cookies conectada a site/js/consent.js.
Fase 4 · Opcional: build estático (Astro o Eleventy) que prerenderiza el
contenido del CMS con las mismas URLs, más un build hook de Netlify al guardar
en el panel. Solo si las métricas no se cumplen tras las fases 1 y 2.

## 5. Verificación obligatoria antes de cada PR
1. Medir antes y después con Playwright (viewport de 412 px; red de 1,6 Mbps
   y 150 ms de latencia): peso, peticiones, LCP, CLS y carga completa de
   /, /alabes/, /arcus/, /porton/ y /cotizador/. Pon la tabla en el PR.
   Metas: < 1,5 MB inicial, LCP < 2,5 s, CLS < 0,1.
2. Capturas a 390 px y a 1280 px de cada página tocada; revisa y corrige una
   vez, y vuelve a revisar una sola vez más.
3. Pruebas funcionales:
   - Login con editor, administrador, marketing y asesor.
   - Editar un texto en el panel y comprobar que se ve en la landing.
   - Cambiar un estado y comprobar que se refleja en la landing y en el
     cotizador.
   - Generar una proforma de cada proyecto (incluido 15 Patios), verla en el
     historial y borrarla como editor.
   - Abrir el dashboard de marketing.
4. Supabase: correr los asesores de seguridad y rendimiento (get_advisors) y
   adjuntar el resultado. Seguridad debe quedar en 0 WARN.
5. Revisar la consola del navegador: sin errores nuevos ni violaciones de CSP
   inesperadas.
6. En la descripción del PR: qué cambió, cómo se verificó, la tabla de
   métricas, el riesgo y cómo revertir.

## 6. Entregables de cada sesión
- Un PR a main con la fase completa y la lista de verificación marcada.
- Actualizar docs/PLAN_MEJORA_WEB.md marcando las casillas hechas y anotando
  las métricas nuevas en la sección 7.
- Al final, un resumen corto: qué quedó hecho, qué no se pudo probar y qué
  decisiones de negocio quedan pendientes.
```
