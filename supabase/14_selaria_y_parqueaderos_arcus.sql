-- ============================================================================
-- FORXA · 14 · Cotizador: proyecto Selaria + parqueaderos de Arcus (nov 2026)
--  1. Selaria (Av. Primero de Mayo): 29 unidades del Excel PRECIOS_SELARIA, que
--     manda sobre el brochure en áreas, precios, estados y numeración. El precio
--     incluye parqueadero y bodega (los que digan P-xx / B-xx). area_util_m2 =
--     interna; area_total_m2 = interna + terraza. No se cargan clientes ni
--     promesas del Excel. Planos y portada se publican con el sitio en
--     /cotizador/assets/. Financiamiento igual que Arcus.
--  2. Arcus: parqueaderos según el Excel PRECIOS_ARCUS (hoja "Inventario
--     Arcus"). Suites 103, 109 y 110 ahora incluyen 1 parqueadero (+$15.000);
--     lo pierden 201-210, 301, 305, 306, 307 y 311 (-$15.000). El parqueadero
--     vale $15.000, así que el Depto 303 con 1 parqueadero es $197.328,50.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

insert into public.cotizador_proyectos
  (id, nombre, tagline, ubicacion, color_primario, color_acento, cover_url, tipo_financiamiento,
   prefijo_proforma, reserva_pct, promesa_pct, tasa_default, plazo_default_anios,
   permite_descuento_manual, monto_descuento_clic, permite_multi_seleccion, activo, sort_order)
values
  ('selaria', 'Selaria', 'Suites y departamentos · Av. Primero de Mayo', 'Cuenca, Ecuador', '#2b3e38', '#ecdbbd',
   '/cotizador/assets/proyectos/selaria-cover.jpg', 'cuotas_entrega', 'SEL', 0.02, 0.08, 8.5, 20, true, 0, true, true, 6)
on conflict (id) do update set
  nombre = excluded.nombre, tagline = excluded.tagline, ubicacion = excluded.ubicacion,
  color_primario = excluded.color_primario, color_acento = excluded.color_acento,
  cover_url = excluded.cover_url;

insert into public.cotizador_unidades
  (proyecto_id, codigo, nombre, tipo, planta, area_util_m2, area_total_m2, dormitorios, banos,
   parqueos, bodega_codigo, bodega_area_m2, precio, estado, foto_url, nota)
select 'selaria', v.* from (values
  ('101', 'Local comercial 101', 'Local comercial', 'Planta baja', 79.91, 133.17, null, null, 1, 'B-20 (5.31 m²)', 5.31, 219000, 'disponible', '/cotizador/assets/unidades/selaria/101.jpg', 'Parqueadero P-23; Bodega B-20'),
  ('102', 'Local comercial 102', 'Local comercial', 'Planta baja', 52.88, 88.43, null, 1, 1, 'B-17 (4.87 m²)', 4.87, 149000, 'reservado', '/cotizador/assets/unidades/selaria/102.jpg', 'Parqueadero P-20; Bodega B-17'),
  ('103', 'Local comercial 103', 'Local comercial', 'Planta baja', 115.06, 170.14, null, 1, 1, 'B-21 (6.16 m²)', 6.16, 283000, 'disponible', '/cotizador/assets/unidades/selaria/103.jpg', 'Parqueadero P-10; Bodega B-21'),
  ('104', 'Suite 104', 'Suite', 'Planta baja', 62.73, 88.81, 1, 1, 1, null, null, 133000, 'disponible', '/cotizador/assets/unidades/selaria/104.jpg', 'Parqueadero P-26; Sin bodega'),
  ('105', 'Suite 105', 'Suite', 'Planta baja', 75.54, 96.26, 1, 1, 1, null, null, 145000, 'disponible', '/cotizador/assets/unidades/selaria/105.jpg', 'Parqueadero P-12; Sin bodega'),
  ('201', 'Departamento 201', 'Departamento', 'Planta alta 1', 111.94, 161.98, 3, 2.5, 1, 'B-03 (5.39 m²)', 5.39, 324000, 'disponible', '/cotizador/assets/unidades/selaria/201.jpg', 'Parqueadero P-04; Bodega B-03'),
  ('202', 'Departamento 202', 'Departamento', 'Planta alta 1', 85.51, 115.03, 2, 2, 1, 'B-06 (5.09 m²)', 5.09, 172000, 'disponible', '/cotizador/assets/unidades/selaria/202.jpg', 'Parqueadero P-13; Bodega B-06'),
  ('203', 'Suite 203', 'Suite', 'Planta alta 1', 57.64, 84.5, 1, 1, null, null, null, 124000, 'disponible', '/cotizador/assets/unidades/selaria/203.jpg', 'Sin parqueadero; Sin bodega'),
  ('204', 'Suite 204', 'Suite', 'Planta alta 1', 53.24, 77.81, 1, 1, 1, null, null, 115000, 'disponible', '/cotizador/assets/unidades/selaria/204.jpg', 'Parqueadero P-25; Sin bodega'),
  ('205', 'Departamento 205', 'Departamento', 'Planta alta 1', 97.55, 116.74, 2, 2, 1, 'B-02 (5.74 m²)', 5.74, 183000, 'disponible', '/cotizador/assets/unidades/selaria/205.jpg', 'Parqueadero P-05; Bodega B-02 (el Excel repite P-05 en 205 y 504; por confirmar)'),
  ('301', 'Departamento 301', 'Departamento', 'Planta alta 2', 107.24, 121.96, 3, 2, 1, 'B-05 (7.42 m²)', 7.42, 200000, 'disponible', '/cotizador/assets/unidades/selaria/301.jpg', 'Parqueadero P-07; Bodega B-05'),
  ('302', 'Departamento 302', 'Departamento', 'Planta alta 2', 86.19, 93.57, 2, 2, 1, 'B-14 (4.93 m²)', 4.93, 160000, 'disponible', '/cotizador/assets/unidades/selaria/302.jpg', 'Parqueadero P-28; Bodega B-14'),
  ('303', 'Suite 303', 'Suite', 'Planta alta 2', 57.64, 57.64, 1, 1, 1, 'B-15 (4.91 m²)', 4.91, 108000, 'disponible', '/cotizador/assets/unidades/selaria/303.jpg', 'Parqueadero P-27; Bodega B-15'),
  ('304', 'Suite 304', 'Suite', 'Planta alta 2', 53.24, 53.24, 1, 1, 1, 'B-19 (4.82 m²)', 4.82, 101000, 'disponible', '/cotizador/assets/unidades/selaria/304.jpg', 'Parqueadero P-11; Bodega B-19'),
  ('305', 'Departamento 305', 'Departamento', 'Planta alta 2', 97.56, 116.34, 2, 2, 1, 'B-13 (4.95 m²)', 4.95, 185000, 'disponible', '/cotizador/assets/unidades/selaria/305.jpg', 'Parqueadero P-03; Bodega B-13'),
  ('401', 'Departamento 401', 'Departamento', 'Planta alta 3', 78.22, 120.09, 2, 2, 1, 'B-22 (4.26 m²)', 4.26, 173000, 'disponible', '/cotizador/assets/unidades/selaria/401.jpg', 'Parqueadero P-24; Bodega B-22'),
  ('402', 'Suite 402', 'Suite', 'Planta alta 3', 46.88, 46.88, 1, 1, 1, 'B-24 (5.31 m²)', 5.31, 93000, 'reservado', '/cotizador/assets/unidades/selaria/402.jpg', 'Parqueadero P-16; Bodega B-24'),
  ('403', 'Suite 403', 'Suite', 'Planta alta 3', 33.34, 33.34, 1, 1, 1, 'B-18 (4.85 m²)', 4.85, 70000, 'reservado', '/cotizador/assets/unidades/selaria/403.jpg', 'Parqueadero P-21; Bodega B-18'),
  ('404', 'Departamento 404', 'Departamento', 'Planta alta 3', 100.21, 169.2, 3, 2, 1, 'B-16 (4.89 m²)', 4.89, 231000, 'disponible', '/cotizador/assets/unidades/selaria/404.jpg', 'Parqueadero P-08; Bodega B-16'),
  ('501', 'Departamento 501', 'Departamento', 'Planta alta 4', 76.58, 86.3, 2, 2, 1, 'B-11 (5.00 m²)', 5, 149000, 'disponible', '/cotizador/assets/unidades/selaria/501.jpg', 'Parqueadero P-15; Bodega B-11'),
  ('502', 'Suite 502', 'Suite', 'Planta alta 4', 46.79, 46.79, 1, 1.5, 1, 'B-23 (3.04 m²)', 3.04, 91000, 'reservado', '/cotizador/assets/unidades/selaria/502.jpg', 'Parqueadero P-22; Bodega B-23'),
  ('503', 'Suite 503', 'Suite', 'Planta alta 4', 33.41, 33.41, 1, 1, 1, 'B-25 (5.82 m²)', 5.82, 72000, 'reservado', '/cotizador/assets/unidades/selaria/503.jpg', 'Parqueadero P-17; Bodega B-25'),
  ('504', 'Departamento 504', 'Departamento', 'Planta alta 4', 98.1, 119.3, 3, 2, 1, 'B-10 (5.00 m²)', 5, 194000, 'disponible', '/cotizador/assets/unidades/selaria/504.jpg', 'Parqueadero P-05; Bodega B-10 (el Excel repite P-05 en 205 y 504; por confirmar)'),
  ('601', 'Departamento 601', 'Departamento', 'Planta alta 5', 76.8, 85.45, 2, 2, 1, 'B-04 (9.41 m²)', 9.41, 156000, 'disponible', '/cotizador/assets/unidades/selaria/601.jpg', 'Parqueadero P-02; Bodega B-04'),
  ('602', 'Suite 602', 'Suite', 'Planta alta 5', 46.54, 46.54, 1, 1, 1, 'B-09 (5.03 m²)', 5.03, 95000, 'reservado', '/cotizador/assets/unidades/selaria/602.jpg', 'Parqueadero P-19; Bodega B-09'),
  ('603', 'Departamento 603', 'Departamento', 'Planta alta 5', 116.28, 138.43, 3, 3, 1, 'B-12 (4.97 m²)', 4.97, 230000, 'disponible', '/cotizador/assets/unidades/selaria/603.jpg', 'Parqueadero P-01; Bodega B-12'),
  ('701', 'Departamento 701', 'Departamento', 'Planta alta 6', 78.93, 85.98, 2, 2, 1, 'B-08 (5.05 m²)', 5.05, 158000, 'reservado', '/cotizador/assets/unidades/selaria/701.jpg', 'Parqueadero P-18; Bodega B-08'),
  ('702', 'Suite 702', 'Suite', 'Planta alta 6', 46.4, 46.4, 1, 1, 1, 'B-07 (5.07 m²)', 5.07, 100000, 'reservado', '/cotizador/assets/unidades/selaria/702.jpg', 'Parqueadero P-09; Bodega B-07'),
  ('703', 'Departamento 703', 'Departamento', 'Planta alta 6', 97.05, 116.68, 2, 2, 1, 'B-01 (7.8 m²)', 7.8, 204000, 'reservado', '/cotizador/assets/unidades/selaria/703.jpg', 'Parqueadero P-14; Bodega B-01')
) as v(codigo, nombre, tipo, planta, area_util_m2, area_total_m2, dormitorios, banos,
       parqueos, bodega_codigo, bodega_area_m2, precio, estado, foto_url, nota)
on conflict (proyecto_id, codigo) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, planta = excluded.planta,
  area_util_m2 = excluded.area_util_m2, area_total_m2 = excluded.area_total_m2,
  dormitorios = excluded.dormitorios, banos = excluded.banos, parqueos = excluded.parqueos,
  bodega_codigo = excluded.bodega_codigo, bodega_area_m2 = excluded.bodega_area_m2,
  precio = excluded.precio, estado = excluded.estado, foto_url = excluded.foto_url, nota = excluded.nota;

-- Arcus · parqueaderos -------------------------------------------------------
update public.cotizador_unidades c set precio = v.precio, parqueos = v.parqueos
  from (values
    ('103', 134247.9, 1), ('109', 128884.6, 1), ('110', 127414.7, 1),
    ('201', 68364, null::int), ('202', 105522.05, null), ('203', 115660.5, null), ('204', 64808.1, null),
    ('205', 67809.15, null), ('206', 74285.1, null), ('207', 79051.95, null), ('208', 82530.9, null),
    ('209', 108937.5, null), ('210', 106632.18, null), ('301', 69216.2, null), ('305', 69195.7, null),
    ('306', 75497.4, null), ('307', 80667.5, null), ('311', 52250.4, null)
  ) as v(codigo, precio, parqueos)
 where c.proyecto_id = 'arcus' and c.codigo = v.codigo;

update public.cotizador_unidades
   set precio = 197328.50,
       nota = 'Con 1 parqueadero ($15.000), sin bodega.'
 where proyecto_id = 'arcus' and codigo = '303-P1';
