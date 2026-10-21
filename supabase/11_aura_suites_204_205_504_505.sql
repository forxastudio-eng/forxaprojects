-- ============================================================================
-- FORXA · 11 · AURA: los departamentos 204 y 504 se dividieron en dos suites
--   Departamento 204 → Suite 204 + Suite 205 (Planta Alta 1)
--   Departamento 504 → Suite 504 + Suite 505 (Planta Alta 4)
-- Todas incluyen bodega y parqueadero. area_util_m2 = área interna y
-- area_total_m2 = interna + terraza (el "Área útil" de la ficha).
-- Los planos se publican con el sitio en /cotizador/assets/unidades/aura/.
-- Las proformas ya emitidas guardan su propia copia de la unidad y no cambian.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

insert into public.cotizador_unidades
  (proyecto_id, codigo, nombre, tipo, planta, area_util_m2, area_total_m2,
   dormitorios, banos, parqueos, bodega_codigo, bodega_area_m2, precio, estado, foto_url, nota)
values
  ('aura', '204', 'Suite 204', 'Suite', 'Planta Alta 1 · Monoambiente · Terraza 76.60 m²', 34.12, 110.72,
   null, 1, 1, null, null, 99000, 'disponible', '/cotizador/assets/unidades/aura/suite-204.jpg',
   'Incluye bodega y parqueadero. Interna 34.12 m² + terraza 76.60 m² = 110.72 m².'),
  ('aura', '205', 'Suite 205', 'Suite', 'Planta Alta 1 · Terraza 12.55 m²', 46.35, 58.90,
   1, 1, 1, null, null, 107300, 'disponible', '/cotizador/assets/unidades/aura/suite-205.jpg',
   'Incluye bodega y parqueadero. Interna 46.35 m² + terraza 12.55 m² = 58.90 m².'),
  ('aura', '504', 'Suite 504', 'Suite', 'Planta Alta 4 · Monoambiente', 34.12, 34.12,
   null, 1, 1, null, null, 84500, 'disponible', '/cotizador/assets/unidades/aura/suite-504.jpg',
   'Incluye bodega y parqueadero. Interna 34.12 m², sin terraza.'),
  ('aura', '505', 'Suite 505', 'Suite', 'Planta Alta 4', 46.35, 46.35,
   1, 1, 1, null, null, 103500, 'disponible', '/cotizador/assets/unidades/aura/suite-505.jpg',
   'Incluye bodega y parqueadero. Interna 46.35 m², sin terraza.')
on conflict (proyecto_id, codigo) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, planta = excluded.planta,
  area_util_m2 = excluded.area_util_m2, area_total_m2 = excluded.area_total_m2,
  dormitorios = excluded.dormitorios, banos = excluded.banos, parqueos = excluded.parqueos,
  bodega_codigo = excluded.bodega_codigo, bodega_area_m2 = excluded.bodega_area_m2,
  precio = excluded.precio, estado = excluded.estado, foto_url = excluded.foto_url,
  nota = excluded.nota;
