-- ============================================================================
-- FORXA · 09 · Contenido editable de las landings (textos, fotos, botones…)
-- Cada fila es un valor que reemplaza al contenido original de la página:
--   page  = landing ('home', 'arcus', 'alabes', 'porton')
--   key   = identificador del campo (lo define el atributo data-cms de la página)
--   value = texto / URL (jsonb string) o lista de elementos (jsonb array)
-- Sin fila => la landing muestra su contenido original. Borrar la fila =
-- "restablecer". Lectura pública (la ven los visitantes); escritura: editor.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

create table if not exists public.site_content (
  page text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (page, key)
);
alter table public.site_content enable row level security;

drop policy if exists "contenido: lectura publica" on public.site_content;
drop policy if exists "contenido: editor inserta" on public.site_content;
drop policy if exists "contenido: editor actualiza" on public.site_content;
drop policy if exists "contenido: editor elimina" on public.site_content;

create policy "contenido: lectura publica"
  on public.site_content for select to anon, authenticated using (true);
create policy "contenido: editor inserta"
  on public.site_content for insert to authenticated with check (public.tiene_rol('editor'));
create policy "contenido: editor actualiza"
  on public.site_content for update to authenticated
  using (public.tiene_rol('editor')) with check (public.tiene_rol('editor'));
create policy "contenido: editor elimina"
  on public.site_content for delete to authenticated using (public.tiene_rol('editor'));
