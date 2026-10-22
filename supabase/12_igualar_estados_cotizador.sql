-- ============================================================================
-- FORXA · 12 · Iguala de una vez el cotizador con las landings
-- El trigger de 10_sincronizar_estado_cotizador.sql solo copia los cambios
-- hechos DESPUÉS de instalarlo. Las unidades marcadas antes en Álabes y Arcus
-- seguían "disponibles" en el cotizador. Esto copia el estado actual de cada
-- landing a su unidad del cotizador (landing → cotizador, como el trigger).
-- Es seguro volver a ejecutarlo: solo toca las que difieren.
-- ============================================================================

with landing as (
  select 'alabes' as proyecto, code, status from public.units
  union all select 'arcus', code, status from public.arcus_units
  union all select 'porton', code, status from public.lots
)
update public.cotizador_unidades c
   set estado = case l.status when 'vendido' then 'vendida' else l.status end
  from landing l
 where c.proyecto_id = l.proyecto
   and (c.codigo = public.codigo_cotizador(l.proyecto, l.code)
        or (l.proyecto <> 'porton'
            and c.codigo ~ ('^' || public.codigo_cotizador(l.proyecto, l.code) || '-P\d+$'))
        or (l.proyecto = 'porton'
            and c.codigo = regexp_replace(l.code, '^([A-Za-z]+)(\d+)$', '\1-\2')))
   and c.estado is distinct from case l.status when 'vendido' then 'vendida' else l.status end;
