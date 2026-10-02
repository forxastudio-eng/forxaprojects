-- ============================================================================
-- FORXA · 10 · La disponibilidad de las landings también cambia en el cotizador
-- Cuando cambia el estado de una unidad/lote en Álabes (units), Arcus
-- (arcus_units) o Portón (lots) —desde el panel, desde "cambiar_estado" o
-- directamente en la base— se actualiza el estado de la misma unidad en
-- cotizador_unidades. Un solo sentido: landing → cotizador.
--
-- Códigos que difieren entre ambos sistemas:
--   Álabes : LOCAL01 → L01
--   Arcus  : SUITE-102 → 102 · LOFT-101 → 101 · LOCAL-1 → 001 · ISLA-1 → I1
--   Portón : A64 → A-64 (el cotizador a veces lleva guion)
-- Estados: vendido → vendida; el resto se llama igual.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

create or replace function public.codigo_cotizador(p_proyecto text, p_code text)
returns text language sql immutable as $$
  select case p_proyecto
    when 'alabes' then case when p_code ~ '^LOCAL\d+$' then 'L' || substring(p_code from 6) else p_code end
    when 'arcus' then case
      when p_code ~ '^(SUITE|LOFT)-\d+$' then substring(p_code from '\d+$')
      when p_code ~ '^LOCAL-\d+$' then lpad(substring(p_code from '\d+$'), 3, '0')
      when p_code ~ '^ISLA-\d+$' then 'I' || substring(p_code from '\d+$')
      else p_code end
    else p_code
  end
$$;

create or replace function public.sincronizar_estado_cotizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proyecto text;
  v_estado text;
begin
  if new.status is not distinct from old.status then return new; end if;

  v_proyecto := case tg_table_name
    when 'units' then 'alabes'
    when 'arcus_units' then 'arcus'
    when 'lots' then 'porton' end;
  v_estado := case new.status when 'vendido' then 'vendida' else new.status end;

  if v_proyecto = 'porton' then
    update public.cotizador_unidades set estado = v_estado
     where proyecto_id = 'porton'
       and (codigo = new.code or codigo = regexp_replace(new.code, '^([A-Za-z]+)(\d+)$', '\1-\2'));
  else
    update public.cotizador_unidades set estado = v_estado
     where proyecto_id = v_proyecto and codigo = public.codigo_cotizador(v_proyecto, new.code);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_estado_cotizador on public.units;
create trigger sync_estado_cotizador after update of status on public.units
  for each row execute function public.sincronizar_estado_cotizador();
drop trigger if exists sync_estado_cotizador on public.arcus_units;
create trigger sync_estado_cotizador after update of status on public.arcus_units
  for each row execute function public.sincronizar_estado_cotizador();
drop trigger if exists sync_estado_cotizador on public.lots;
create trigger sync_estado_cotizador after update of status on public.lots
  for each row execute function public.sincronizar_estado_cotizador();
