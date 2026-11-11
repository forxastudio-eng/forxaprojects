-- ============================================================================
-- FORXA · 18 · Compartir proforma (PDF con enlace firmado) y retención de leads.
-- Aplicado en Supabase. Idempotente.
-- ============================================================================
-- Bucket privado para los PDF que el asesor comparte con el cliente (enlace firmado de 7 días).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proformas-compartidas', 'proformas-compartidas', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists "proformas-compartidas: equipo sube lo suyo" on storage.objects;
create policy "proformas-compartidas: equipo sube lo suyo" on storage.objects for insert to authenticated
  with check (bucket_id = 'proformas-compartidas' and mi_rol() is not null
              and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "proformas-compartidas: equipo lee" on storage.objects;
create policy "proformas-compartidas: equipo lee" on storage.objects for select to authenticated
  using (bucket_id = 'proformas-compartidas' and mi_rol() is not null);
drop policy if exists "proformas-compartidas: editor elimina" on storage.objects;
create policy "proformas-compartidas: editor elimina" on storage.objects for delete to authenticated
  using (bucket_id = 'proformas-compartidas' and tiene_rol(variadic array['editor']));

-- Retención (plan S11): el día 1 de cada mes (05:00 UTC) se anonimizan los leads de más de 24 meses.
create extension if not exists pg_cron;
select cron.schedule('anonimizar-leads', '0 5 1 * *', 'select public.anonimizar_leads_viejos()');
