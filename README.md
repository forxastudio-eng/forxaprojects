# FORXA · Plataforma unificada

Un solo repositorio de GitHub, un solo sitio de Netlify y un solo proyecto de
Supabase para todo:

| Ruta | Qué es | Quién entra |
|---|---|---|
| `/` | Landing principal de FORXA con todos los proyectos | Público |
| `/alabes/` `/arcus/` `/porton/` | Landings de cada proyecto | Público |
| `/admin/` | Panel de administración | Editor, administrador, marketing |
| `/cotizador/` | Cotizador interno y su historial | Todo el equipo (historial: no asesores) |
| `/marketing/` | Dashboard ejecutivo de marketing | Editor, administrador, marketing |

```
forxa-plataforma/
├── site/                  ← lo ÚNICO que publica Netlify
│   ├── index.html         landing principal
│   ├── js/forxa-config.js ← URL y anon key de Supabase (un solo lugar)
│   ├── css/  assets/      marca FORXA compartida
│   ├── alabes/ arcus/ porton/ cotizador/ marketing/ admin/
├── supabase/              SQL en orden 01 → 07 (no se publica)
├── scripts/               migración y cuentas (se ejecutan en tu PC)
├── redirecciones-sitios-viejos/
└── netlify.toml
```

## Estado de la migración (22 de septiembre de 2026)

**Hecho y verificado** en el proyecto nuevo `forxa-plataforma` (`nvbqfckuqpdjterypszb`, organización forxastudio):

- Base de datos instalada (SQL 01–07), con roles y permisos probados como visitante anónimo.
- Todos los datos, comparados tabla por tabla con su origen: Álabes 34, Arcus 77, Portón 80 lotes y 6 fotos de slider, cotizador (5 proyectos, 179 unidades, 34 extras, 10 asesores, 29 proformas con su numeración) y el dashboard de marketing.
- 166 imágenes copiadas. Las 164 que usa la base de datos existen en el Storage nuevo.
- 11 cuentas creadas. 28 de las 29 proformas quedaron ligadas a su autor; la restante la generó `forxacorp@gmail.com`, que no tiene rol.
- `site/js/forxa-config.js` ya tiene la URL y la clave pública del proyecto nuevo.
- Portón del Valle (`hrecdyregmnbcmifjmva`) quedó **pausado**. Su respaldo está en `scripts/respaldo/porton/`.

**Falta** (en este orden):

1. **Contraseñas iniciales**: en el SQL Editor del proyecto nuevo ejecuta
   `select * from migracion.credenciales_iniciales;`
   Entrega cada una por un canal privado y pide que la cambien en Panel → Mi cuenta. Después ejecuta
   `drop table migracion.credenciales_iniciales;`
2. **Auth**: en *Authentication → Sign In / Providers → Email* desactiva **Allow new users to sign up**. En *URL Configuration* pon tu dominio como Site URL y agrega `https://TU-DOMINIO/admin/` en Redirect URLs.
3. **Limpieza opcional**: borra la función desactivada en *Edge Functions → migracion-forxa → Delete*.
4. **GitHub y Netlify**: pasos 6 y 7 de abajo. Después, redirigir los sitios viejos (paso 8).
5. **Seguridad**: cuando los sitios viejos ya redirijan, regenera las claves de los proyectos viejos (quedaron escritas en el chat de migración).

Los pasos 1 a 5 de "Puesta en marcha" ya están hechos. Los scripts de `scripts/` quedan como herramienta de respaldo y para futuras migraciones.

## Roles

| | Editor | Administrador | Marketing | Asesor |
|---|:-:|:-:|:-:|:-:|
| Crear, editar, eliminar en el panel | ✓ | – | – | – |
| Cambiar disponibilidad de unidades | ✓ | ✓ | – | – |
| Ver todo y descargar tablas | ✓ | ✓ | ✓ | – |
| Historial de proformas y sus dashboards | ✓ | ✓ | ✓ | – |
| Editar dashboard de marketing | ✓ | – | ✓ | – |
| Usar el cotizador | ✓ | ✓ | ✓ | ✓ |
| Administrar usuarios y roles | ✓ | – | – | – |

Los permisos los hace cumplir la base de datos (RLS), no solo la interfaz: aunque
alguien manipule la página, Supabase rechaza lo que su rol no permite. El
administrador solo puede cambiar estados mediante la función `cambiar_estado`,
que además deja registro en **Panel → Actividad**.

Roles iniciales (archivo `supabase/07_usuarios.sql`):

- **Editor:** gabichopalomeque@gmail.com
- **Administrador:** ceo@ e info@forxainmobiliaria.com
- **Marketing:** marketing@forxainmobiliaria.com
- **Asesores:** prodriguez, psacaquirin, dmolina, vponce, vgranja, dpalacios y acardenas @forxainmobiliaria.com

---

## Puesta en marcha (una sola vez)

No apagues nada de lo actual hasta el paso 8. Todo esto se hace en paralelo.

### 0. Si necesitas borrar un proyecto viejo para liberar espacio

El plan gratuito de Supabase admite 2 proyectos activos. Si para crear el
proyecto nuevo tienes que borrar uno viejo, **respáldalo primero** (pasos 3 y
4 explican cómo preparar los scripts):

```bash
cd scripts
npm install
npm run respaldar porton     # o: alabes, cotizador, marketing, todos
```

Guarda en `scripts/respaldo/porton/` todas sus tablas e imágenes. Revisa que
los totales que imprime tengan sentido (y abre `respaldo/porton/tablas/lots.json`)
**antes** de borrar. Después de borrar el proyecto, quita su `PORTON_SERVICE_KEY`
del `.env`: la migración usará el respaldo automáticamente. La carpeta
`respaldo/` contiene datos de clientes; guárdala en un lugar seguro, no se sube
a GitHub.

### 1. Crear el proyecto nuevo de Supabase

1. En [supabase.com](https://supabase.com/dashboard) → **New project** (ej. `forxa-plataforma`), región de EE. UU. más cercana.
2. **SQL Editor → New query**: pega y ejecuta, **en orden**, cada archivo de `supabase/`:
   `01_roles.sql` → `02_landings.sql` → `03_cotizador.sql` → `04_marketing.sql` → `05_cambiar_estado.sql` → `06_politicas.sql` → `07_usuarios.sql`.
   Todos se pueden volver a ejecutar sin problema.
3. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up** (las cuentas solo las creas tú).
4. **Authentication → URL Configuration**: en **Site URL** pon la dirección final (ej. `https://forxainmobiliaria.com`) y agrega `https://forxainmobiliaria.com/admin/` en **Redirect URLs** (para "Olvidé mi contraseña").

> Plan gratuito: Supabase permite 2 proyectos activos gratis. Si ya tienes 2, pausa uno de los viejos
> **después** de migrar (paso 4), o usa un plan de pago.

### 2. Poner las claves en el sitio

Abre `site/js/forxa-config.js` y reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY`
con los de **Project Settings → API** del proyecto nuevo (URL y clave **anon public**).
Es el único archivo con claves del sitio; la anon key es pública por diseño.

### 3. Preparar los scripts (en tu computadora)

Necesitas [Node.js](https://nodejs.org) 18 o superior.

```bash
cd scripts
cp .env.ejemplo .env      # en Windows: copy .env.ejemplo .env
npm install
```

Completa `scripts/.env` con la URL del proyecto nuevo y las **service_role
keys** (Project Settings → API → service_role) del nuevo y de los 4 viejos.
Son claves secretas: el archivo `.env` está en `.gitignore` y nunca se sube.

### 4. Migrar los datos

```bash
npm run inspeccionar   # muestra tablas, columnas y cantidades de los proyectos viejos
npm run simular        # dice qué copiaría, sin escribir nada
npm run migrar         # copia de verdad
```

Copia unidades, lotes, slider, portafolio, todo el cotizador (incluido el
historial y la numeración de proformas), el dashboard de marketing y todas las
imágenes de Storage, reescribiendo sus direcciones al proyecto nuevo. Se puede
repetir: siempre deja el nuevo igual a los viejos. Si alguna columna vieja no
existe en el esquema nuevo, la simulación te avisa antes de copiar.

### 5. Crear las cuentas

```bash
npm run usuarios          # lista qué cuentas faltan
npm run usuarios:crear    # las crea
```

Genera `scripts/credenciales-iniciales.csv` con una contraseña inicial por
persona. Entrégalas por un canal privado, pide que cada quien la cambie en
**Panel → Mi cuenta** y borra el CSV.

> Si ejecutas la migración **después** de crear las cuentas, el historial
> conserva quién generó cada proforma. Si la ejecutaste antes, puedes repetir
> `npm run migrar` ahora.

### 6. Subir a GitHub

Crea un repositorio nuevo (ej. `forxa-plataforma`, puede ser privado) y sube
todo el contenido de esta carpeta:

```bash
git init
git add .
git commit -m "Plataforma unificada FORXA"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/forxa-plataforma.git
git push -u origin main
```

Revisa que `scripts/.env` **no** aparezca en GitHub.

### 7. Publicar en Netlify

1. **Add new site → Import an existing project → GitHub** → elige el repositorio.
2. Netlify lee `netlify.toml`: carpeta publicada `site`, sin comando de build. **Deploy**.
3. Prueba en la dirección temporal `….netlify.app`:
   - la landing y las tres landings de proyecto (con su ítem **Más proyectos**),
   - entrar al panel con cada rol,
   - generar una proforma y verla en el historial,
   - exportar el dashboard del historial a PDF,
   - abrir el dashboard de marketing.
4. **Domain management**: conecta tu dominio. Actualiza Site URL en Supabase (paso 1.4) si cambió.

### 8. Apagar lo viejo

Sigue `redirecciones-sitios-viejos/LEEME.md` para que los sitios viejos
redirijan a las direcciones nuevas. Déjalos redirigiendo unos meses, luego
archiva esos repos y pausa (no borres) los Supabase viejos.

---

## Uso diario

- **Cambiar disponibilidad:** Panel → Inventario → el proyecto → selector de estado de la unidad. Se publica al instante.
- **Editar unidades, fotos y fichas (editor):** mismo lugar, botón del lápiz.
- **Precios, planos y configuración del cotizador (editor):** Panel → Cotizador → Configurar cotizador.
- **Dashboard del historial:** Panel → Historial y dashboard → pestaña Dashboard → título, período → Exportar a PDF. En el diálogo de impresión elige **Guardar como PDF** y deja activado **Gráficos de fondo**.
- **Agregar una persona:** Panel → Usuarios y roles (asigna el rol) + crea su cuenta con `npm run usuarios:crear` o en Supabase → Authentication → Add user.

## Agregar un proyecto nuevo

1. **Landing:** copia la carpeta del proyecto en `site/<nombre>/` (ej. `site/misicata/`).
   En su `index.html`:
   - agrega `<base href="/misicata/">` justo después de `<meta charset>`;
   - carga `<script src="/js/forxa-config.js"></script>` en lugar de su propio archivo de claves;
   - agrega `<a href="/" class="nav-more">Más proyectos</a>` en el menú.
2. **Tabla de unidades (si la landing muestra disponibilidad):** crea la tabla en el SQL Editor
   y agrega su nombre a la lista de `06_politicas.sql` (bloque "landings") y a `cambiar_estado`
   en `05_cambiar_estado.sql`; vuelve a ejecutar ambos.
3. **Panel:** agrega una entrada en `INV` (`site/admin/js/views.js`) y una línea en el menú
   (`NAV` en `site/admin/js/app.js`). Álabes o Portón sirven de modelo.
4. **Portafolio:** Panel → Portafolio de proyectos → Agregar proyecto, con enlace `/misicata/`.
5. **Cotizador:** Panel → Configurar cotizador → nuevo proyecto y sus unidades.
6. `git push`: Netlify publica solo.

Si el proyecto tiene su sitio fuera de esta plataforma, basta con el paso 4 usando su dirección `https://…`.

## Cambios respecto a los sitios anteriores

- Un solo login y un solo panel para todo, con roles por persona.
- `data/consolidado.json` (lista de precios), los `.sql` y los scripts del cotizador
  ya no quedan publicados en internet: viven fuera de `site/`.
- El dashboard de marketing dejó de ser público; requiere sesión.
- Cotizador y dashboard del historial con la identidad visual de FORXA.
- Corregido en Arcus: el botón "Contáctanos" del menú era blanco sobre blanco.

## Seguridad

- En el sitio solo va la **anon key** (pública por diseño). Las **service_role keys** solo
  en `scripts/.env`, en tu computadora.
- Si alguien deja el equipo: Panel → Usuarios y roles → quitar acceso, y en Supabase →
  Authentication → Users → eliminar su cuenta.
