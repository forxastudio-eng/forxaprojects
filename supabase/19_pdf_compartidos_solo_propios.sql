-- ============================================================================
-- FORXA · 19 · Hallazgo de la prueba de ataque (11/11/2026): cualquier miembro del
-- equipo podía listar y abrir los PDF compartidos de los demás (datos de clientes
-- ajenos). Ahora cada quien ve los suyos; editor y administrador, todos. Aplicado.
-- ============================================================================
drop policy if exists "proformas-compartidas: equipo lee" on storage.objects;
drop policy if exists "proformas-compartidas: cada quien lee lo suyo" on storage.objects;
create policy "proformas-compartidas: cada quien lee lo suyo" on storage.objects for select to authenticated
  using (bucket_id = 'proformas-compartidas' and mi_rol() is not null
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or tiene_rol(variadic array['editor','administrador'])));
