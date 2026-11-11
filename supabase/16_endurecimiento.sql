-- ============================================================================
-- FORXA · 16 · Endurecimiento (plan S6–S9 y R9). Idempotente y solo aditivo.
-- Las landings solo leen (rol anon): projects, units, arcus_units, lots,
-- slider_images y site_content con la política "lectura publica" (using true).
-- Todo lo demás exige sesión iniciada.
-- ============================================================================

-- S6 · Funciones: quitar EXECUTE a PUBLIC/anon (PUBLIC es el grant por defecto).
revoke execute on function public.mi_rol() from public, anon;
revoke execute on function public.tiene_rol(text[]) from public, anon;
revoke execute on function public.siguiente_numero_proforma(text) from public, anon;
revoke execute on function public.sincronizar_estado_cotizador() from public, anon, authenticated; -- es trigger
grant  execute on function public.mi_rol() to authenticated;
grant  execute on function public.tiene_rol(text[]) to authenticated;
grant  execute on function public.siguiente_numero_proforma(text) to authenticated;

-- S7 · Tablas internas: anon no necesita ningún permiso.
revoke all on public.user_roles, public.actividad, public.dashboard_content,
  public.cotizador_asesores, public.cotizador_contador_proforma, public.cotizador_historial,
  public.cotizador_inventario_extra, public.cotizador_proyectos, public.cotizador_unidades
  from anon;
-- Tablas de las landings: anon solo lee.
revoke insert, update, delete, truncate, references, trigger on
  public.projects, public.units, public.arcus_units, public.lots,
  public.slider_images, public.site_content from anon;

-- S8 · search_path fijo.
alter function public.set_updated_at() set search_path = public;
alter function public.codigo_cotizador(text, text) set search_path = public;
alter function migracion.reasociar_autores() set search_path = public;

-- R9 · Índices de las claves foráneas del historial.
create index if not exists cotizador_historial_creado_por_idx on public.cotizador_historial (creado_por);
create index if not exists cotizador_historial_proyecto_id_idx on public.cotizador_historial (proyecto_id);

-- R9 · (select auth.xxx()) en las 3 políticas, y sin políticas permisivas duplicadas.
drop policy if exists "actividad: registrar propia" on public.actividad;
create policy "actividad: registrar propia" on public.actividad for insert to authenticated
  with check (tiene_rol(variadic array['editor','marketing']) and email = (select auth.jwt() ->> 'email'));

drop policy if exists "historial: cualquier rol guarda sus proformas" on public.cotizador_historial;
create policy "historial: cualquier rol guarda sus proformas" on public.cotizador_historial for insert to authenticated
  with check (mi_rol() is not null and creado_por = (select auth.uid()));

-- user_roles: la política SELECT ya incluye al editor; "administra" pasa a escritura.
drop policy if exists "roles: cada quien ve el suyo, el editor ve todos" on public.user_roles;
create policy "roles: cada quien ve el suyo, el editor ve todos" on public.user_roles for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')) or tiene_rol(variadic array['editor']));
drop policy if exists "roles: solo editor administra" on public.user_roles;
drop policy if exists "roles: editor inserta" on public.user_roles;
drop policy if exists "roles: editor actualiza" on public.user_roles;
drop policy if exists "roles: editor elimina" on public.user_roles;
create policy "roles: editor inserta" on public.user_roles for insert to authenticated
  with check (tiene_rol(variadic array['editor']));
create policy "roles: editor actualiza" on public.user_roles for update to authenticated
  using (tiene_rol(variadic array['editor'])) with check (tiene_rol(variadic array['editor']));
create policy "roles: editor elimina" on public.user_roles for delete to authenticated
  using (tiene_rol(variadic array['editor']));

-- cotizador_contador_proforma: lectura para todo el equipo; escritura solo editor.
drop policy if exists "contador: editor" on public.cotizador_contador_proforma;
drop policy if exists "contador: editor inserta" on public.cotizador_contador_proforma;
drop policy if exists "contador: editor actualiza" on public.cotizador_contador_proforma;
drop policy if exists "contador: editor elimina" on public.cotizador_contador_proforma;
create policy "contador: editor inserta" on public.cotizador_contador_proforma for insert to authenticated
  with check (tiene_rol(variadic array['editor']));
create policy "contador: editor actualiza" on public.cotizador_contador_proforma for update to authenticated
  using (tiene_rol(variadic array['editor'])) with check (tiene_rol(variadic array['editor']));
create policy "contador: editor elimina" on public.cotizador_contador_proforma for delete to authenticated
  using (tiene_rol(variadic array['editor']));

-- S9 · Buckets con límite de tamaño y tipo (solo afecta subidas nuevas).
update storage.buckets set file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']
  where id = 'site-images';
update storage.buckets set file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
  where id = 'cotizador-media';
