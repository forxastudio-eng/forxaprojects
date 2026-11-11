-- ============================================================================
-- FORXA · 17 · Leads: lo que los visitantes envían en los formularios.
-- Solo aditivo e idempotente. El sitio publicado hoy no usa esta tabla, así que
-- aplicarlo no cambia nada hasta que se publique el front nuevo.
-- Escritura: SOLO la Edge Function "lead" (service role, valida Turnstile).
-- Lectura y seguimiento: editor, administrador y marketing. Borrar: editor.
-- ============================================================================
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  tipo         text not null default 'informacion' check (tipo in ('informacion','visita')),
  proyecto     text not null,
  nombre       text not null check (char_length(nombre) between 1 and 120),
  telefono     text not null check (char_length(telefono) between 5 and 30),
  email        text check (email is null or char_length(email) <= 160),
  interes      text check (interes is null or char_length(interes) <= 160),
  mensaje      text check (mensaje is null or char_length(mensaje) <= 2000),
  fecha_visita date,
  fuente       text check (fuente is null or char_length(fuente) <= 500),
  estado       text not null default 'nuevo' check (estado in ('nuevo','contactado','visita','cerrado','descartado')),
  nota         text,
  updated_at   timestamptz not null default now()
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_proyecto_idx on public.leads (proyecto);

alter table public.leads enable row level security;
revoke all on public.leads from anon;

drop policy if exists "leads: equipo lee" on public.leads;
create policy "leads: equipo lee" on public.leads for select to authenticated
  using (tiene_rol(variadic array['editor','administrador','marketing']));
drop policy if exists "leads: equipo da seguimiento" on public.leads;
create policy "leads: equipo da seguimiento" on public.leads for update to authenticated
  using (tiene_rol(variadic array['editor','administrador','marketing']))
  with check (tiene_rol(variadic array['editor','administrador','marketing']));
drop policy if exists "leads: editor elimina" on public.leads;
create policy "leads: editor elimina" on public.leads for delete to authenticated
  using (tiene_rol(variadic array['editor']));

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- Retención (plan S11): los leads de más de 24 meses se anonimizan con esta
-- función. Ejecutarla a mano o programarla con pg_cron.
create or replace function public.anonimizar_leads_viejos()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update public.leads set nombre = 'anonimizado', telefono = '00000', email = null, mensaje = null, nota = null
    where created_at < now() - interval '24 months' and nombre <> 'anonimizado'
    returning 1)
  select count(*)::int from x;
$$;
revoke execute on function public.anonimizar_leads_viejos() from public, anon, authenticated;
