-- ============================================================================
-- FORXA · 15 · Arcus: landing según el brochure A8 (noviembre 2026)
-- Contraste A8 vs landing (62 unidades residenciales; el A8 no trae locales ni
-- islas): las 58 suites y lofts ya coincidían, salvo 209, 210, 306, 307 y 411,
-- donde se mantiene el área útil corregida (el A8 repite el error del brochure).
-- Faltaba el Departamento 603, y el 403 y el 607 eran Suite 403 / Loft 607.
--   403 = Suite 403 + Loft 404 · 607 = Loft 607 + Suite 608 (como el 303).
-- El plano del 403 muestra 2 dormitorios y 2 baños aunque su tabla dice 1 y 1:
-- se usa 2 y 2 (también corregido en su ficha). Área útil del 403: 81.49 tal
-- como dice el brochure (no suma el balcón, a diferencia del 303).
-- DEPTO-* ahora se asocia a su código del cotizador (ver 10).
-- Pendiente de borrar a mano: LOFT-304, LOFT-404 y SUITE-608 (ya no están en
-- el A8). Respaldo previo: migracion.respaldo_arcus_units_20261106.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

create or replace function public.codigo_cotizador(p_proyecto text, p_code text)
returns text language sql immutable as $$
  select case p_proyecto
    when 'alabes' then case when p_code ~ '^LOCAL\d+$' then 'L' || substring(p_code from 6) else p_code end
    when 'arcus' then case
      when p_code ~ '^(SUITE|LOFT|DEPTO)-\d+$' then substring(p_code from '\d+$')
      when p_code ~ '^LOCAL-\d+$' then lpad(substring(p_code from '\d+$'), 3, '0')
      when p_code ~ '^ISLA-\d+$' then 'I' || substring(p_code from '\d+$')
      else p_code end
    else p_code
  end
$$;

update public.arcus_units set kind = 'departamento', title = 'Departamento 403', area = '81.49',
  extra = 'Balcón 13.50 m² · Lavandería', dorm = '2', banos = '2', thumb = 'img/portadas/suite.jpg'
 where code = 'SUITE-403';
update public.arcus_units set kind = 'departamento', title = 'Departamento 607', area = '88.13',
  extra = 'Jardinera 12.64 m² · Lavandería', dorm = '2', banos = '2', thumb = 'img/portadas/suite.jpg'
 where code = 'LOFT-607';
insert into public.arcus_units (code, kind, grupo, title, tag, area, status, dorm, banos, extra, ficha, thumb, sort_order)
values ('DEPTO-603', 'departamento', 'p6', 'Departamento 603', '6° Planta Alta', '82.28', 'vendido', '2', '2',
        'Jardinera 9.09 m² · Lavandería', 'img/fichas/DEPTO-603.jpg', 'img/portadas/suite.jpg', 74)
on conflict (code) do update set kind = excluded.kind, title = excluded.title, area = excluded.area,
  status = excluded.status, dorm = excluded.dorm, banos = excluded.banos, extra = excluded.extra,
  ficha = excluded.ficha, thumb = excluded.thumb;
