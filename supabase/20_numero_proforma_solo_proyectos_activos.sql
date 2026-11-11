-- ============================================================================
-- FORXA · 20 · Hallazgo de la prueba de ataque: siguiente_numero_proforma aceptaba
-- cualquier id y creaba contadores basura. Ahora solo proyectos reales y activos.
-- Aplicado en Supabase. Idempotente.
-- ============================================================================
create or replace function public.siguiente_numero_proforma(p_proyecto_id text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_prefijo text;
  v_siguiente integer;
begin
  if public.mi_rol() is null then
    raise exception 'Sin permiso para generar proformas';
  end if;
  select coalesce(prefijo_proforma, upper(left(id, 3))) into v_prefijo
  from public.cotizador_proyectos where id = p_proyecto_id and activo;
  if v_prefijo is null then
    raise exception 'Proyecto no válido';
  end if;

  insert into public.cotizador_contador_proforma (proyecto_id, ultimo)
  values (p_proyecto_id, 1)
  on conflict (proyecto_id) do update set ultimo = cotizador_contador_proforma.ultimo + 1
  returning ultimo into v_siguiente;

  return v_prefijo || '-' || lpad(v_siguiente::text, 4, '0');
end;
$function$;
revoke execute on function public.siguiente_numero_proforma(text) from public, anon;
grant execute on function public.siguiente_numero_proforma(text) to authenticated;
