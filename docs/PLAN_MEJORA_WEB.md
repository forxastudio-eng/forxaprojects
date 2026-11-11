# FORXA · Auditoría y plan de mejora de la plataforma

**Fecha:** 11 de noviembre de 2026
**Alcance:** sitio público (`/`, `/alabes/`, `/arcus/`, `/porton/`), cotizador, panel `/admin/`, dashboard `/marketing/` y el proyecto de Supabase `forxa-plataforma`.
**Regla de oro:** se mejora sobre lo que ya existe. Se mantienen las mismas URLs, la misma base de datos, los mismos roles, el mismo panel y el mismo despliegue (Netlify publica `site/`). Ningún cambio de este plan obliga a migrar datos ni a reentrenar al equipo.
**Criterios de diseño:** skills `ui-ux-pro-max` (reglas de accesibilidad, interacción, rendimiento y patrón de landing) e `impeccable` (auditoría técnica 0–4 por dimensión, modos *Persuade* para landings y *Operate* para herramientas internas, "el brief manda": se respeta la identidad que ya existe).

---

## 0. Resumen ejecutivo

| | Estado |
|---|---|
| 15 Patios en la base de datos | ✅ Correcto: proyecto activo, 5 viviendas, precios, estados y rutas de imagen como se definieron |
| 15 Patios en la web en producción | ⚠️ **Falta hacer merge del PR #8.** Mientras tanto la portada, el logo y los planos dan 404 en producción, porque esos archivos solo existen en esa rama |
| Seguridad de datos (RLS) | ✅ Buena base: todas las tablas tienen RLS y los permisos los decide la base de datos, no la página |
| Seguridad de la plataforma | ⚠️ Faltan cabeceras de seguridad, la librería de Supabase se carga sin versión fija y siguen en la base las contraseñas iniciales |
| Velocidad | ❌ **Es la causa de la lentitud.** Cada landing descarga entre 5 y 6 MB al abrirse en un celular |

**Puntaje de salud (método `impeccable audit`): 10/20 · Aceptable, con trabajo importante pendiente.**

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 3/4 | Base buena (alt en todas las imágenes, `lang`, un h1, `prefers-reduced-motion`). En los campos de formulario se usa `outline: none` y solo cambia el color del borde |
| 2 | Rendimiento | 1/4 | Imágenes JPG/PNG a tamaño completo, sin `srcset`, sin carga diferida en Álabes ni en Portón, un video de 5 MB y nada de caché |
| 3 | Responsive | 2/4 | La grilla de cifras de Álabes se descuadra en móvil y hay dos CTA de WhatsApp montados en el hero |
| 4 | Tokens / tema | 2/4 | Hay tres sistemas de color superpuestos en el cotizador (oliva base, azul FORXA encima y paleta propia en la proforma) y cinco familias tipográficas cargadas |
| 5 | Integridad de implementación | 2/4 | Cada landing tiene su propia identidad bien resuelta, pero la home es genérica (logo gigante, sin fotos de proyectos en la primera pantalla) |

**Los 5 problemas más importantes**
1. **P0.** Hacer merge del PR #8, o 15 Patios se verá roto en producción.
2. **P0.** Borrar `migracion.credenciales_iniciales` (contraseñas iniciales en texto plano) cuando confirmes que ya se entregaron y se cambiaron.
3. **P1.** El peso de las landings: 5,1 MB en Álabes, 6,2 MB en Arcus y 6,3 MB en Portón, con más de 27 s de carga completa en 4G móvil.
4. **P1.** No hay cabeceras de seguridad (CSP, HSTS, Permissions-Policy) y `supabase-js@2` se carga sin versión exacta ni verificación de integridad.
5. **P1.** Ninguna landing tiene `og:image`. Cuando un asesor comparte el enlace por WhatsApp, la vista previa sale sin foto, y WhatsApp es el canal de venta principal.

---

## 1. Verificación de 15 Patios

Consultado directamente en Supabase:

| Dato | Valor en la base | ¿OK? |
|---|---|---|
| Proyecto | `15patios`, activo, orden 6, prefijo `15PATIOS`, `cuotas_entrega` | ✅ |
| Colores | `#352B23` / `#BD603F` | ✅ |
| Portada | `/assets/covers/15-patios.jpg` | ✅ en la base · ⚠️ el archivo solo está en el PR #8 |
| Vivienda 1 | 132,48 / 167,48 m² · $135.000 · disponible | ✅ |
| Vivienda 2 | 133,02 / 167,48 m² · $135.000 · disponible | ✅ |
| Vivienda 3 | 133,19 / 167,48 m² · $135.000 · **no disponible** | ✅ (según el brochure; confirmar) |
| Vivienda 4 | 132,55 / 167,48 m² · $135.000 · disponible | ✅ |
| Vivienda 5 | 190,71 / 146,65 m² · $144.500 · disponible | ✅ |
| Planos | `/cotizador/assets/unidades/15patios/vivienda-N.jpg` | ✅ en la base · ⚠️ los archivos solo están en el PR #8 |

**Acción:** hacer merge de https://github.com/forxastudio-eng/forxaprojects/pull/8. Después, abrir el cotizador, elegir 15 Patios, generar una proforma de prueba y revisar que se vean la portada, el logo en el membrete y el plano en la página 2. Esa proforma de prueba se puede borrar desde Historial con el rol editor.

**Pendientes de negocio** (ya están en la descripción del PR): financiamiento copiado de Arcus, estado de la Vivienda 3 y total de la tabla ($684.500 frente a $685.000).

---

## 2. Auditoría de seguridad

### Lo que ya está bien (mantener)
- RLS activo en las 15 tablas de `public`. Las políticas usan `tiene_rol()` y `mi_rol()`, así que el rol lo decide la base de datos.
- Los asesores solo pueden insertar en el historial, y solo a su nombre (`creado_por = auth.uid()`). Ver el historial queda para dirección y marketing, y borrarlo, solo para el editor.
- Los estados solo cambian mediante `cambiar_estado()`, que valida el rol y deja registro.
- `cotizador-media` es privado y se sirve con URLs firmadas. `site-images` es público, pero solo el editor puede subir archivos.
- Las funciones `SECURITY DEFINER` tienen `search_path` fijo (`public`).
- El historial escapa los datos del cliente (`escHTML`) y el dashboard de marketing usa `escapeHtml`.

### Hallazgos

| ID | Severidad | Hallazgo | Evidencia | Corrección | Riesgo de romper algo |
|---|---|---|---|---|---|
| S1 | **P0** | Siguen las contraseñas iniciales en texto plano | Existe la tabla `migracion.credenciales_iniciales` (paso 1 del README sin cerrar) | Confirmar que cada persona cambió su contraseña y ejecutar `drop table migracion.credenciales_iniciales;` | Ninguno |
| S2 | P1 | La protección contra contraseñas filtradas está apagada | Asesor de seguridad de Supabase: `auth_leaked_password_protection` | Authentication → Providers → Email → activar *Leaked password protection* | Ninguno: solo afecta contraseñas nuevas |
| S3 | P1 | No se pudo comprobar si el registro público está desactivado | Es el paso 2 del README; no se puede ver desde SQL | Authentication → *Allow new users to sign up* = OFF. Revisar también Site URL y Redirect URLs | Ninguno: las cuentas las crea el editor |
| S4 | P1 | Faltan cabeceras de seguridad | `netlify.toml` solo trae `nosniff`, `Referrer-Policy` y `X-Frame-Options` | Agregar `Strict-Transport-Security`, `Permissions-Policy` y una `Content-Security-Policy` que permita solo: el propio sitio, `*.supabase.co`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com` y `wa.me`. **Publicarla primero como `Content-Security-Policy-Report-Only`** durante una semana | Medio si se activa directo, y por eso empieza en modo solo-reporte |
| S5 | P1 | Librería de un tercero sin versión exacta ni integridad | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/...` en 5 páginas | Fijar la versión exacta (`@2.x.y`) con `integrity` (SRI) y `crossorigin`, o copiarla a `site/js/vendor/` | Bajo: la API v2 no cambia |
| S6 | P2 | Hay más funciones expuestas a `anon` de lo necesario | Asesor de Supabase: `mi_rol`, `tiene_rol`, `siguiente_numero_proforma` y `sincronizar_estado_cotizador` se pueden ejecutar como `anon` | `revoke execute ... from anon` en las cuatro, y `from authenticated` en `sincronizar_estado_cotizador` (es un trigger y nadie la llama por RPC). Hoy no son explotables: devuelven nulo o lanzan error, pero sobran | Bajo: probar el login y una proforma |
| S7 | P2 | Defensa en profundidad: `anon` tiene permisos de tabla sobre tablas internas | `has_table_privilege('anon', …)` da true en `user_roles`, `cotizador_*`, `actividad` y `dashboard_content`; hoy RLS es la única barrera | `revoke all on <tablas internas> from anon;` (las landings solo leen `projects`, `units`, `arcus_units`, `lots`, `slider_images` y `site_content`) | Bajo: el cotizador siempre trabaja con sesión iniciada |
| S8 | P2 | `search_path` mutable en 3 funciones | `set_updated_at`, `codigo_cotizador` y `migracion.reasociar_autores` | `alter function … set search_path = public;` | Ninguno |
| S9 | P2 | Buckets sin límite de tamaño ni de tipo de archivo | `site-images` y `cotizador-media` tienen `file_size_limit` y `allowed_mime_types` en null | Límite de 8 MB y solo `image/jpeg`, `image/png`, `image/webp`, `image/avif` (más `video/mp4` y `video/webm` en `site-images`) | Bajo: un video más grande que el límite tendría que comprimirse |
| S10 | P2 | Hay datos de la base que se insertan como HTML sin escapar | `cotizador.js` arma la proforma con `${u.nombre}`, `${nombre}` y similares; `cotizador/js/admin.js` usa `value="${u.nota}"`; `js/cms.js` inserta HTML de `site_content` | Usar un solo `esc()` compartido para todo texto que venga de la base, y un *allowlist* de etiquetas (`b`, `i`, `br`, `a`) para el contenido enriquecido del CMS. Hoy solo el editor puede escribir esos datos, así que el riesgo existe únicamente si se compromete esa cuenta | Bajo |
| S11 | P3 | Datos personales acumulados sin política de retención | `cotizador_historial` guarda teléfonos y correos de clientes | Definir cuánto tiempo se guardan (por ejemplo 24 meses) y anonimizar después. Mencionarlo en `/privacidad/` | Ninguno |
| S12 | P3 | Tablas de respaldo sin uso | `migracion.respaldo_*` (4 tablas sin clave primaria) | Exportarlas y borrarlas cuando ya no se necesiten | Ninguno |

---

## 3. Auditoría de rendimiento: por qué la web está lenta

### Medición
Las páginas se sirvieron localmente con red móvil simulada (4G lenta: 1,6 Mbps y 150 ms de latencia, el mismo perfil de Lighthouse móvil), en un viewport de 412 px. Los servicios de terceros (Supabase, Google Fonts y el CDN) estaban bloqueados en este entorno, así que **en producción la carga real es mayor**.

| Página | Peso al cargar | Peticiones | Carga completa |
|---|---|---|---|
| `/` (home) | 0,1 MB, más las portadas que trae Supabase (la de Arcus pesa 800 KB) | 12 | 1,0 s |
| `/alabes/` | **5,1 MB** | 30 | **26,9 s** |
| `/arcus/` | **6,2 MB** | 17 | **32,9 s** |
| `/porton/` | **6,3 MB** | 30 | **40,1 s** |
| `/cotizador/` | 0,1 MB | 9 | 0,9 s |

Peso del repositorio publicado: Arcus 27 MB, Portón 17 MB y Álabes 13 MB. Hay 243 JPG y 48 PNG, y **ningún WebP ni AVIF**.

### Causas, ordenadas por impacto

| ID | Prioridad | Causa | Evidencia | Corrección |
|---|---|---|---|---|
| R1 | **P1** | Imágenes a tamaño completo, en formatos pesados y sin versiones por pantalla | Mapas de 1,5 MB (`arcus/img/ubicacion/mapa-1.jpg` y `mapa-2.jpg`), fachadas de 1 a 1,2 MB, portada de Arcus de 800 KB; `srcset` = 0 en todas las páginas | Generar AVIF y WebP en 640, 1280 y 1920 px con un script (`scripts/optimizar-imagenes.mjs`, con `sharp`), y usar `<picture>` con `srcset`/`sizes`, conservando el JPG original como respaldo. Se espera entre 60 % y 80 % menos peso |
| R2 | **P1** | No hay carga diferida | `loading="lazy"`: Álabes 0 de 24 imágenes, Portón 0 de 30, Arcus 31 de 41 | `loading="lazy" decoding="async"` en todo lo que queda bajo la primera pantalla, y `fetchpriority="high"` en la imagen del hero |
| R3 | **P1** | El video del hero de Portón pesa 5 MB y arranca solo, también en móvil | `porton/img/hero-video.mp4` 5 MB y `.webm` 4,9 MB | Recomprimir a 720p y unos 1,5 MB. En móvil y con `Save-Data`, mostrar solo el póster. Pausar el video cuando sale de pantalla y añadir un botón de pausa (WCAG 2.2.2) |
| R4 | **P1** | El navegador no guarda nada en caché | Netlify sirve por defecto `max-age=0, must-revalidate`: en cada visita se vuelve a preguntar por cada imagen | En `netlify.toml`: `Cache-Control: public, max-age=604800, stale-while-revalidate=86400` para `/assets/*`, `/*/img/*` y `*.css`/`*.js`. Se usan 7 días y no `immutable` porque los nombres de archivo no llevan hash |
| R5 | P2 | Las fuentes se cargan en cadena | `@import` dentro del CSS en `css/forxa-tokens.css`, `arcus/css/styles.css`, `cotizador/css/styles.css` y `forxa-theme.css`. El cotizador baja 5 familias (Bricolage, Work Sans, Plus Jakarta, Lexend y Hanken) aunque solo muestra 2 | `<link rel="preconnect">` más `<link rel="stylesheet">` en el `<head>` en lugar de `@import`, recortar pesos y familias que no se usan, y `font-display: swap` |
| R6 | P2 | El CMS reemplaza contenido después de cargar | `js/cms.js` y `supabase-js` en todas las landings (Álabes tiene 129 elementos `data-cms`) | Aplicar `defer` y fijar la versión. Reservar los tamaños (`width`/`height` y `aspect-ratio`) para que no haya saltos de contenido (CLS). Más adelante, opcionalmente, prerenderizar (ver fase 4) |
| R7 | P2 | Hay una petición rota en cada visita a Arcus | El HTML apunta a `video/hero-arcus.mp4`, que fue borrado del repositorio; el CMS lo deja vacío y usa un póster de Storage de unos 1,2 MB | Quitar el `<source>` del HTML y optimizar el póster |
| R8 | P2 | El cotizador firma las imágenes una por una | `await signedMediaUrl()` dentro de bucles (`cotizador/index.html:108`, `cotizador.js:550`); en Administrar se piden decenas de firmas en paralelo (`admin.js:225`) | Usar `storage.createSignedUrls([...])` en lote: una sola petición por pantalla |
| R9 | P3 | Optimizaciones de base de datos (hoy pocas filas, más adelante crecerán) | Asesores de Supabase: FK sin índice en `cotizador_historial` (`creado_por`, `proyecto_id`); `auth.uid()` y `auth.jwt()` sin `(select …)` en 3 políticas; dos políticas permisivas duplicadas | Migración SQL corta. Ver la fase 1 |

**Objetivo medible:** cada landing con menos de 1,5 MB en la carga inicial, LCP por debajo de 2,5 s en 4G móvil, CLS por debajo de 0,1 y Lighthouse móvil con Rendimiento ≥ 85 y Accesibilidad ≥ 95.

---

## 4. Auditoría de funcionalidad y diseño (UX)

Modo *impeccable*: las landings y la home son **Persuade** (el visitante decide y actúa). El cotizador, el panel y marketing son **Operate** (el usuario completa una tarea).

### Home `/` (Persuade): el hallazgo más grande de diseño
- **La primera pantalla no muestra lo que se vende.** Hay un titular, un párrafo y el isotipo de FORXA en grande. No aparecen fotos, proyectos, precios ni disponibilidad. Según la regla de *Persuade*, la apertura debe hacer comprensible y deseable la oferta, y mostrar una acción que funcione.
- Los proyectos llegan desde Supabase debajo de la primera pantalla, y 15 Patios no está en la home.
- **Recomendación:** que la primera pantalla sea una tira de proyectos con foto real, nombre, ubicación, tipo, "desde $X" y "N unidades disponibles" (los datos ya existen en `projects`, `units`, `arcus_units` y `lots`), más un filtro por tipo de inmueble y una acción "Agendar visita".

### Landings de proyecto (Persuade)
- ✅ Cada una tiene su identidad propia y bien resuelta: Arcus (Lora/Inter, café), Álabes y Portón. **Se conservan; no se rediseña la marca.**
- ❌ No hay `og:image`, `og:title` ni `og:description`: los enlaces compartidos por WhatsApp salen sin foto.
- ❌ No hay datos estructurados (`schema.org` `Residence`/`Offer`/`RealEstateAgent`), `robots.txt` ni `sitemap.xml`.
- ❌ En Álabes móvil, la grilla de cifras (34 unidades, 2028, 4 locales, 3 plantas) tiene los bordes descuadrados.
- ❌ En Álabes móvil hay dos CTA de WhatsApp en el hero (el botón y el flotante), y el flotante tapa la flecha de "seguir bajando".
- ⚠️ Arcus tiene 8 enlaces de navegación más el CTA: es una barra sobrecargada (regla `nav-hierarchy`). Conviene agrupar "Suites & Lofts", "Locales" y "Plantas" en "Unidades".
- ⚠️ Los formularios de contacto abren WhatsApp y no guardan el lead. **Se pierden los datos para medir y dar seguimiento.**

### Cotizador, panel y marketing (Operate)
- ✅ El flujo es claro, el asesor queda recordado, el número de proforma es atómico, se puede enviar por WhatsApp y los estados se sincronizan con las landings.
- ⚠️ Tres capas de color en el cotizador: `styles.css` (oliva), `forxa-theme.css` (azul que lo pisa) y la proforma (azul propio). Conviene consolidarlas en un solo set de *tokens*.
- ⚠️ El PDF depende de "Imprimir → Guardar como PDF". Los asesores en el celular lo pasan mal.
- ⚠️ En los inputs, `outline: none` deja el foco indicado solo por el color del borde (WCAG 2.4.7 / 1.4.11). Hay que añadir un anillo visible de 2 px con `:focus-visible`.
- ⚠️ No hay estados de carga con `aria-busy` ni *skeletons*: las tarjetas aparecen de golpe.

### Criterios de diseño que se aplican (y los que se descartan)
- **Se aplican** (`ui-ux-pro-max`, prioridades 1–7):
  - Contraste de 4,5:1, foco visible y objetivos táctiles de 44 px.
  - WebP/AVIF, carga diferida y espacio reservado (CLS < 0,1).
  - Un CTA principal por pantalla, video con póster, pausa y pausa automática fuera de pantalla, y `prefers-reduced-motion` con estado final estático.
  - Íconos SVG (nunca emojis).
  - Duraciones de 150–300 ms en los estados *hover*, con easing por contexto.
- **Se aplican** (`impeccable`):
  - "El brief manda": se conserva cada identidad (FORXA azul con Lexend/Hanken; Arcus, Álabes, Portón y 15 Patios con la suya).
  - Una plantilla de "titular, párrafo y botón sobre fila de tarjetas iguales" no cuenta como diseño. La home debe mostrar el producto (los proyectos), no un logo.
- **Se descartan:** la sugerencia automática de la base de `ui-ux-pro-max` para "real estate" era paleta verde azulada, tipografía Cinzel y *glassmorphism*. Se rechaza porque reemplazaría una identidad que ya existe y funciona.

---

## 5. Plan de trabajo por fases

Cada fase va en **su propio PR**, se revisa en el *deploy preview* de Netlify y se puede revertir con un clic (revertir el PR). No se cambian URLs ni el esquema de datos, salvo agregar.

### Fase 0 · Hoy, sin código (30 minutos)
- [ ] Hacer merge del PR #8 (15 Patios) y probar una proforma de 15 Patios.
- [ ] Confirmar las contraseñas cambiadas y ejecutar `drop table migracion.credenciales_iniciales;` (S1).
- [ ] Activar *Leaked password protection* (S2) y confirmar *Allow new users to sign up* = OFF (S3).
- [ ] Confirmar con el equipo comercial el financiamiento de 15 Patios y el estado de la Vivienda 3.

### Fase 1 · Ganancias rápidas de bajo riesgo (1–2 días)
**Seguridad**
- [ ] `netlify.toml`:
  - HSTS y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - **CSP en modo `Report-Only`** (S4).
  - `Cache-Control` para assets (R4).
- [ ] Fijar `supabase-js` a una versión exacta con SRI en las 5 páginas (S5).
- [ ] `supabase/15_endurecimiento.sql`:
  - `revoke execute` a `anon` (S6) y `revoke all` de tablas internas a `anon` (S7).
  - `search_path` (S8) y límites de buckets (S9).
  - Índices FK y `(select auth.uid())` en las 3 políticas (R9).
  - Fusionar las políticas duplicadas.
- [ ] Volver a correr los asesores de Supabase y dejar seguridad en 0 WARN.

**Rendimiento**
- [ ] `loading="lazy" decoding="async"` y `width`/`height` en todas las imágenes bajo la primera pantalla de Álabes, Portón y Arcus (R2), y `fetchpriority="high"` en el hero.
- [ ] Quitar el `<source>` roto de Arcus (R7).
- [ ] Pasar las fuentes de `@import` a `<link>` con `preconnect` y quitar las familias que no se usan del cotizador (R5).
- [ ] Firmar las URLs en lote en el cotizador (R8).

**Verificación:** las mismas mediciones de la sección 3 antes y después; login con cada rol; generar y borrar una proforma; cambiar un estado desde el panel y comprobar que se refleja en la landing y en el cotizador.

### Fase 2 · Imágenes, video, SEO y accesibilidad (≈ 1 semana)
- [ ] `scripts/optimizar-imagenes.mjs` (`sharp`): genera `.avif` y `.webp` en 640, 1280 y 1920 junto al original, **sin renombrar ni borrar nada**. Con el script se actualizan las páginas a `<picture>` con `srcset`/`sizes` (R1).
- [ ] Mismo tratamiento para las imágenes que sube el editor:
  - Al subir desde el panel, el navegador redimensiona a un máximo de 2000 px y convierte a WebP antes de enviar (canvas, sin servidor).
  - Las imágenes ya subidas en Storage se pueden pedir redimensionadas con las *Image Transformations* de Supabase si el plan lo incluye. Si no, se reprocesan una vez con el script.
- [ ] Video de Portón:
  - Recomprimir a 720p y unos 1,5 MB.
  - En móvil y con `Save-Data`, solo el póster.
  - Pausar fuera de pantalla con `IntersectionObserver` y añadir un botón de pausa (R3).
- [ ] SEO y compartir:
  - `og:*` y `twitter:*` con foto en cada landing y en la home.
  - JSON-LD (`RealEstateAgent` en la home y `Residence`/`Offer` por proyecto).
  - `robots.txt` (que excluya `/admin/`, `/cotizador/` y `/marketing/`) y `sitemap.xml`.
- [ ] Accesibilidad:
  - `:focus-visible` con anillo de 2 px en todos los inputs.
  - Revisar el contraste de los textos sobre fotos (scrim mínimo).
  - Objetivos táctiles de 44 px en móvil.
- [ ] Arreglos de diseño responsive: grilla de cifras de Álabes, un solo CTA de WhatsApp en el hero móvil y la navegación de Arcus agrupada.
- [ ] Un `esc()` compartido para todo texto de la base, y *allowlist* en el CMS (S10).

### Fase 3 · Nueva funcionalidad sobre la base existente (2–3 semanas)
1. **Home que vende.**
   - Primera pantalla con los proyectos reales: foto, "desde $", unidades disponibles calculadas en vivo y filtro por tipo y ubicación.
   - 15 Patios agregado a la tabla `projects`, que es contenido y no código.
2. **Captura de leads.**
   - Tabla `leads` con RLS: `anon` solo puede `insert`, y leen editor, administrador y marketing.
   - Protección anti-spam con Cloudflare Turnstile.
   - El formulario guarda el lead y después abre WhatsApp como hoy.
   - En el panel: bandeja de leads con estado (nuevo, contactado, visita, cerrado) y exportación a Excel (ya existe XLSX en el panel).
3. **Agendar visita** desde cada landing, con fecha preferida y proyecto o unidad. Se guarda como lead del tipo "visita".
4. **Disponibilidad en vivo en las landings.** Distintivo "Quedan N" por tipología a partir de los mismos estados que ya se sincronizan.
5. **Cotizador.**
   - Descarga directa del PDF (por ejemplo, con `html2pdf`/`jsPDF` cargados solo al pulsar), además de "Imprimir".
   - Enlace compartible de solo lectura a la proforma (vista pública con token, que no expone el historial).
   - Duplicar una proforma.
   - Buscar y filtrar unidades por precio, dormitorios y piso.
6. **Dashboard de marketing.** Sumar los leads por proyecto y fuente y la conversión de lead a proforma (los dos datos ya estarán en la base).
7. **Analítica respetuosa.** Una herramienta sin cookies (por ejemplo Plausible o Umami), conectada al banner de consentimiento que ya existe.

### Fase 4 · Opcional, si después de las fases 1–3 aún hace falta velocidad
- Un *build* estático ligero (Astro o Eleventy) que lea Supabase al publicar y genere HTML con el contenido del CMS ya puesto. Mantiene las mismas URLs, el mismo panel y la misma base. Netlify vuelve a publicar con un *build hook* cuando el editor guarda en el panel.
- Solo se hace si las métricas de la sección 3 no se cumplen con las fases 1 y 2.

---

## 6. Cómo no romper nada
1. **Un PR por fase y por tema.** Se revisa siempre en el *deploy preview* de Netlify antes del merge.
2. **Lista de comprobación en cada PR:**
   - La home carga los proyectos.
   - Las 3 landings muestran el contenido del CMS.
   - El panel permite iniciar sesión y editar un texto.
   - El cambio de estado se refleja en la landing y en el cotizador.
   - El cotizador genera la proforma y la guarda en el historial.
   - El historial y el dashboard abren con el rol marketing.
   - Marketing carga sus datos.
3. **SQL siempre idempotente** (`if not exists`, `on conflict`), con respaldo previo en `migracion.respaldo_*` cuando se tocan datos.
4. **Primero CSP en modo solo-reporte** y luego en modo estricto.
5. **Las imágenes nuevas conviven con las originales** (no se borra ningún JPG en la fase 2).
6. **Medir antes y después** con el mismo perfil de red y anotar los resultados en el PR.

## 7. Métricas de éxito

| Métrica | Hoy | Meta |
|---|---|---|
| Peso inicial de una landing (móvil) | 5–6 MB | < 1,5 MB |
| Carga completa en 4G | 27–40 s | < 6 s |
| LCP móvil | sin medir en producción | < 2,5 s |
| CLS | sin medir (el CMS reemplaza contenido) | < 0,1 |
| Asesores de seguridad de Supabase | 4 WARN | 0 WARN |
| Lighthouse móvil (rendimiento / accesibilidad) | sin medir en producción | ≥ 85 / ≥ 95 |
| Leads registrados | 0 (todo se va a WhatsApp) | 100 % de los formularios |
