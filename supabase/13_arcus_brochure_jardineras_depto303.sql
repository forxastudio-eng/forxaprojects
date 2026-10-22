-- ============================================================================
-- FORXA · 13 · Arcus: fichas del brochure "Arcus A7" (octubre 2026)
--  1. Muchas unidades ya no tienen balcón sino jardinera. La jardinera NO suma
--     al área útil: área útil = interno (+ balcón / terraza cuando los hay).
--     Ojo: el brochure trae 209, 210, 306, 307 y 411 con un área útil que no
--     sigue esa regla; aquí se usa la regla.
--  2. La Suite 303 y el Loft 304 se fusionan en el Departamento 303
--     (51.69 + 29.80 = 81.49 m² internos, 2 dormitorios, 2 baños), con su
--     propia sección "Departamentos" en la landing (kind = 'departamento').
--     Se conserva el código SUITE-303 para que la sincronización siga igual.
--  3. Cotizador: Departamento 303 en tres opciones (sin parqueadero, con 1 y
--     con 2) y las fotos de todas las unidades pasan a las fichas nuevas que
--     publica el sitio en /arcus/img/fichas/.
--  4. Loft 401 y Suite 403 vendidos (el trigger de 10 lo copia al cotizador).
-- El resto de estados no se toca: se manejan en el panel.
-- Respaldo previo: migracion.respaldo_arcus_units_20261022 y
-- migracion.respaldo_cotizador_arcus_20261022.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

alter table public.arcus_units drop constraint if exists arcus_units_kind_check;
alter table public.arcus_units add constraint arcus_units_kind_check
  check (kind in ('suite', 'loft', 'departamento', 'local', 'isla'));

-- Landing -------------------------------------------------------------------
with b(code, area, extra, dorm, banos) as (values
  ('SUITE-102', '60.95', 'Balcón 14.24 m² · Lavandería', '1', '1.5'),
  ('SUITE-103', '97.86', 'Balcón 7.77 m² · Terraza 38.40 m² · Lavandería', '1', '1'),
  ('SUITE-109', '120.52', 'Terraza 71.22 m² · Lavandería', '1', '1'),
  ('SUITE-110', '123.47', 'Terraza 75.24 m² · Lavandería', '1', '1.5'),
  ('LOFT-101', '98.42', 'Terraza 66.44 m² · Lavandería', '1', '1'),
  ('LOFT-104', '59.42', 'Terraza 29.62 m² · Lavandería', '1', '1'),
  ('LOFT-105', '60.89', 'Terraza 29.22 m² · Lavandería', '1', '1'),
  ('LOFT-106', '64.13', 'Terraza 29.69 m² · Lavandería', '1', '1'),
  ('LOFT-107', '66.84', 'Terraza 29.63 m² · Lavandería', '1', '1'),
  ('LOFT-108', '67.74', 'Terraza 28.84 m² · Lavandería', '1', '1'),
  ('LOFT-111', '78.23', 'Terraza 54.43 m² · Lavandería', '1', '1'),
  ('SUITE-202', '60.57', 'Balcón 13.88 m² · Lavandería', '1', '1'),
  ('SUITE-203', '65.19', 'Balcón 13.50 m² · Lavandería', '1', '1'),
  ('SUITE-209', '49.30', 'Jardinera 8.00 m² · Lavandería', '1', '1'),
  ('SUITE-210', '48.23', 'Jardinera 10.53 m² · Lavandería', '1', '1'),
  ('LOFT-201', '31.98', 'Jardinera 4.45 m² · Lavandería', '1', '1'),
  ('LOFT-204', '29.80', 'Jardinera 5.51 m² · Lavandería', '1', '1'),
  ('LOFT-205', '31.67', 'Jardinera 4.54 m² · Lavandería', '1', '1'),
  ('LOFT-206', '34.54', 'Jardinera 5.36 m² · Lavandería', '1', '1'),
  ('LOFT-207', '37.21', 'Jardinera 4.57 m² · Lavandería', '1', '1'),
  ('LOFT-208', '38.90', 'Jardinera 4.64 m² · Lavandería', '1', '1'),
  ('LOFT-211', '23.80', 'Jardinera 4.28 m² · Lavandería', '1', '1'),
  ('SUITE-303', '95.02', 'Balcón 13.53 m² · Lavandería', '2', '2'),
  ('SUITE-302', '61.87', 'Balcón 15.18 m² · Lavandería', '1', '1'),
  ('SUITE-309', '49.30', 'Jardinera 9.95 m² · Lavandería', '1', '1'),
  ('SUITE-310', '48.23', 'Jardinera 10.30 m² · Lavandería', '1', '1'),
  ('LOFT-301', '31.98', 'Jardinera 4.46 m² · Lavandería', '1', '1'),
  ('LOFT-305', '31.67', 'Jardinera 5.21 m² · Lavandería', '1', '1'),
  ('LOFT-306', '34.54', 'Jardinera 5.72 m² · Lavandería', '1', '1'),
  ('LOFT-307', '37.21', 'Jardinera 5.35 m² · Lavandería', '1', '1'),
  ('LOFT-308', '38.90', 'Jardinera 4.92 m² · Lavandería', '1', '1'),
  ('LOFT-311', '23.80', 'Jardinera 4.22 m² · Lavandería', '1', '1'),
  ('SUITE-402', '60.57', 'Balcón 13.88 m² · Lavandería', '1', '1'),
  ('SUITE-403', '65.19', 'Balcón 13.50 m² · Lavandería', '1', '1'),
  ('SUITE-409', '49.30', 'Jardinera 8.00 m² · Lavandería', '1', '1'),
  ('SUITE-410', '48.23', 'Jardinera 10.53 m² · Lavandería', '1', '1'),
  ('LOFT-401', '31.98', 'Jardinera 4.45 m² · Lavandería', '1', '1'),
  ('LOFT-404', '29.80', 'Jardinera 5.51 m² · Lavandería', '1', '1'),
  ('LOFT-405', '31.67', 'Jardinera 4.54 m² · Lavandería', '1', '1'),
  ('LOFT-406', '34.54', 'Jardinera 5.36 m² · Lavandería', '1', '1'),
  ('LOFT-407', '37.21', 'Jardinera 4.57 m² · Lavandería', '1', '1'),
  ('LOFT-408', '38.90', 'Jardinera 4.64 m² · Lavandería', '1', '1'),
  ('LOFT-411', '23.80', 'Jardinera 4.28 m² · Lavandería', '1', '1'),
  ('SUITE-502', '61.87', 'Balcón 15.18 m² · Lavandería', '1', '1'),
  ('SUITE-503', '65.22', 'Balcón 13.53 m² · Lavandería', '1', '1'),
  ('SUITE-509', '49.30', 'Jardinera 9.95 m² · Lavandería', '1', '1'),
  ('SUITE-510', '48.23', 'Jardinera 10.30 m² · Lavandería', '1', '1'),
  ('LOFT-501', '31.98', 'Jardinera 4.46 m² · Lavandería', '1', '1'),
  ('LOFT-504', '29.80', 'Jardinera 5.08 m² · Lavandería', '1', '1'),
  ('LOFT-505', '31.67', 'Jardinera 5.21 m² · Lavandería', '1', '1'),
  ('LOFT-506', '34.54', 'Jardinera 5.72 m² · Lavandería', '1', '1'),
  ('LOFT-507', '37.21', 'Jardinera 5.35 m² · Lavandería', '1', '1'),
  ('LOFT-508', '38.90', 'Jardinera 4.92 m² · Lavandería', '1', '1'),
  ('LOFT-511', '23.80', 'Jardinera 4.22 m² · Lavandería', '1', '1'),
  ('SUITE-602', '60.57', 'Balcón 13.88 m² · Lavandería', '1', '1'),
  ('SUITE-608', '49.23', 'Jardinera 8.00 m² · Lavandería', '1', '1'),
  ('SUITE-609', '48.30', 'Jardinera 10.47 m² · Lavandería', '1', '1'),
  ('LOFT-601', '31.98', 'Jardinera 4.45 m² · Lavandería', '1', '1'),
  ('LOFT-604', '30.83', 'Jardinera 4.45 m² · Lavandería', '1', '1'),
  ('LOFT-605', '34.54', 'Jardinera 5.36 m² · Lavandería', '1', '1'),
  ('LOFT-606', '37.21', 'Jardinera 4.57 m² · Lavandería', '1', '1'),
  ('LOFT-607', '38.90', 'Jardinera 4.64 m² · Lavandería', '1', '1'),
  ('LOFT-610', '23.80', 'Jardinera 4.28 m² · Lavandería', '1', '1'))
update public.arcus_units u
   set area = b.area, extra = b.extra, dorm = b.dorm, banos = b.banos,
       ficha = 'img/fichas/' || u.code || '.jpg'
  from b
 where u.code = b.code;

update public.arcus_units set title = 'Departamento 303', kind = 'departamento' where code = 'SUITE-303';
delete from public.arcus_units where code = 'LOFT-304';
update public.arcus_units set status = 'vendido' where code in ('LOFT-401', 'SUITE-403');

-- Cotizador -----------------------------------------------------------------
delete from public.cotizador_unidades where proyecto_id = 'arcus' and codigo = '304';

update public.cotizador_unidades c
   set area_util_m2 = case when u.extra like 'Jardinera%' then u.area::numeric else c.area_util_m2 end,
       area_total_m2 = u.area::numeric,
       foto_url = '/arcus/img/fichas/' || u.code || '.jpg'
  from public.arcus_units u
 where c.proyecto_id = 'arcus' and c.codigo = public.codigo_cotizador('arcus', u.code);

insert into public.cotizador_unidades
  (proyecto_id, codigo, nombre, tipo, planta, area_util_m2, area_total_m2, dormitorios, banos,
   parqueos, bodega_codigo, precio, estado, foto_url, nota)
select 'arcus', v.codigo, v.nombre, 'Departamento', 'Piso 3 · Departamento', 81.49, 95.02, 2, 2,
       v.parqueos, null, v.precio,
       (select case status when 'vendido' then 'vendida' else status end
          from public.arcus_units where code = 'SUITE-303'),
       '/arcus/img/fichas/SUITE-303.jpg', v.nota
  from (values
    ('303',    'Departamento 303',                  null::int, 182328.50, 'Sin parqueadero y sin bodega. Fusión de Suite 303 + Loft 304.'),
    ('303-P1', 'Departamento 303 + 1 parqueadero',  1,         198828.50, 'Con 1 parqueadero, sin bodega. Precio del parqueadero asumido: $16.500 (la mitad de la diferencia con la opción de 2).'),
    ('303-P2', 'Departamento 303 + 2 parqueaderos', 2,         215328.50, 'Con 2 parqueaderos, sin bodega.')
  ) as v(codigo, nombre, parqueos, precio, nota)
on conflict (proyecto_id, codigo) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, planta = excluded.planta,
  area_util_m2 = excluded.area_util_m2, area_total_m2 = excluded.area_total_m2,
  dormitorios = excluded.dormitorios, banos = excluded.banos, parqueos = excluded.parqueos,
  bodega_codigo = excluded.bodega_codigo, precio = excluded.precio,
  foto_url = excluded.foto_url, nota = excluded.nota;
