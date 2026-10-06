-- ============================================================================
-- FORXA · 11 · CRM (contactos, oportunidades, actividades y asistente de IA)
-- Ejecutar después de 01–10. Es seguro volver a ejecutarlo.
--
-- Modelo:
--   crm_contactos      una persona (un teléfono = un contacto).
--   crm_oportunidades  su interés en un proyecto; es la tarjeta del embudo.
--   crm_actividades    línea de tiempo: notas, llamadas, tareas, cambios de etapa.
--   crm_ia_uso         registro de llamadas a la IA (control de costo).
--
-- Quién ve y hace qué (lo hace cumplir la base de datos, no solo la pantalla):
--                          editor   administrador   marketing   asesor
--   Ver oportunidades        todas       todas          todas     las suyas + sin asignar
--   Crear / editar           ✓            ✓              –        las suyas
--   Asignar a otra persona   ✓            ✓              –         –
--   Tomar un lead sin dueño  ✓            ✓              –         ✓
--   Eliminar                 ✓            –              –         –
--   Métricas                 todas       todas          todas     las suyas
--
-- Los formularios de las landings entran por crm_registrar_lead() (única
-- puerta para el público: valida, normaliza y evita duplicados).
-- ============================================================================

-- ------------------------------------------------------------- utilidades ---
create or replace function public.crm_mi_correo()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Solo dígitos, con prefijo de país. 0991234567 → 593991234567
create or replace function public.crm_normalizar_telefono(p text)
returns text language sql immutable as $$
  select case
    when d = '' then ''
    when d ~ '^593' then d
    when d ~ '^0\d{9}$' then '593' || substr(d, 2)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) t
$$;

-- ----------------------------------------------------------------- tablas ---
create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 120),
  telefono text,
  telefono_norm text not null default '',
  correo text check (correo is null or correo = lower(correo)),
  ciudad text,
  notas text,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_contactos_telefono_uq
  on public.crm_contactos (telefono_norm) where telefono_norm <> '';
create index if not exists crm_contactos_correo_ix
  on public.crm_contactos (correo) where correo is not null;

create table if not exists public.crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  proyecto text check (proyecto is null or proyecto ~ '^[a-z0-9_-]{1,40}$'),
  unidad_interes text,
  etapa text not null default 'nuevo'
    check (etapa in ('nuevo','contactado','cita','proforma','reserva','vendido','perdido')),
  fuente text not null default 'otro'
    check (fuente in ('formulario_web','whatsapp','llamada','facebook','instagram','tiktok','google',
                      'marketplace','plusvalia','feria','cartera','co_broker','referido','oficina','otro')),
  origen text,                                   -- landing o campaña de donde llegó
  asignado_a text check (asignado_a is null or asignado_a = lower(asignado_a)),
  valor_estimado numeric,
  proforma_numero text,                          -- ej. ARC-0007 (se liga a mano o desde el cotizador)
  motivo_perdida text,
  -- Asistente de IA
  calificacion text check (calificacion is null or calificacion in ('caliente','tibio','frio')),
  calificacion_motivo text,
  ia_resumen text,
  ia_siguiente_accion text,
  ia_actualizado_at timestamptz,
  cerrado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_op_contacto_ix on public.crm_oportunidades (contacto_id);
create index if not exists crm_op_etapa_ix    on public.crm_oportunidades (etapa);
create index if not exists crm_op_asignado_ix on public.crm_oportunidades (asignado_a);

create table if not exists public.crm_actividades (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.crm_oportunidades(id) on delete cascade,
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  tipo text not null
    check (tipo in ('nota','llamada','whatsapp','correo','visita','tarea','cambio_etapa','sistema','ia')),
  contenido text not null check (char_length(contenido) between 1 and 4000),
  vence_at timestamptz,                          -- solo tareas
  hecha_at timestamptz,                          -- solo tareas
  creado_por text,
  created_at timestamptz not null default now()
);
create index if not exists crm_act_op_ix on public.crm_actividades (oportunidad_id, created_at desc);
create index if not exists crm_act_tareas_ix on public.crm_actividades (vence_at)
  where tipo = 'tarea' and hecha_at is null;

create table if not exists public.crm_ia_uso (
  id bigint generated always as identity primary key,
  email text not null,
  accion text not null,
  created_at timestamptz not null default now()
);
create index if not exists crm_ia_uso_ix on public.crm_ia_uso (email, created_at desc);

alter table public.crm_contactos     enable row level security;
alter table public.crm_oportunidades enable row level security;
alter table public.crm_actividades   enable row level security;
alter table public.crm_ia_uso        enable row level security;

revoke all on public.crm_contactos, public.crm_oportunidades,
              public.crm_actividades, public.crm_ia_uso from anon;

drop trigger if exists crm_contactos_updated_at on public.crm_contactos;
create trigger crm_contactos_updated_at before update on public.crm_contactos
  for each row execute function public.set_updated_at();
drop trigger if exists crm_oportunidades_updated_at on public.crm_oportunidades;
create trigger crm_oportunidades_updated_at before update on public.crm_oportunidades
  for each row execute function public.set_updated_at();

-- Teléfono y correo siempre normalizados (también cuando se editan desde la app).
create or replace function public.crm_contacto_antes()
returns trigger language plpgsql as $$
begin
  new.nombre := btrim(new.nombre);
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.telefono_norm := public.crm_normalizar_telefono(new.telefono);
  new.correo := nullif(lower(btrim(coalesce(new.correo, ''))), '');
  return new;
end;
$$;
drop trigger if exists crm_contacto_antes on public.crm_contactos;
create trigger crm_contacto_antes before insert or update on public.crm_contactos
  for each row execute function public.crm_contacto_antes();

-- cerrado_at sigue a la etapa
create or replace function public.crm_oportunidad_antes()
returns trigger language plpgsql as $$
begin
  if new.etapa in ('vendido','perdido') then
    if tg_op = 'INSERT' or old.etapa not in ('vendido','perdido') then new.cerrado_at := now(); end if;
  else
    new.cerrado_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists crm_oportunidad_antes on public.crm_oportunidades;
create trigger crm_oportunidad_antes before insert or update on public.crm_oportunidades
  for each row execute function public.crm_oportunidad_antes();

-- Cada cambio de etapa o de dueño queda en la línea de tiempo.
create or replace function public.crm_oportunidad_despues()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_quien text := coalesce(nullif(public.crm_mi_correo(), ''), 'sistema');
begin
  if new.etapa is distinct from old.etapa then
    insert into public.crm_actividades (oportunidad_id, contacto_id, tipo, contenido, creado_por)
    values (new.id, new.contacto_id, 'cambio_etapa', old.etapa || ' → ' || new.etapa, v_quien);
  end if;
  if new.asignado_a is distinct from old.asignado_a then
    insert into public.crm_actividades (oportunidad_id, contacto_id, tipo, contenido, creado_por)
    values (new.id, new.contacto_id, 'sistema',
            'Asignado a ' || coalesce(new.asignado_a, 'nadie (sin asignar)'), v_quien);
  end if;
  return new;
end;
$$;
drop trigger if exists crm_oportunidad_despues on public.crm_oportunidades;
create trigger crm_oportunidad_despues after update on public.crm_oportunidades
  for each row execute function public.crm_oportunidad_despues();

-- El contacto de una actividad siempre es el de su oportunidad (no se confía en el cliente).
create or replace function public.crm_actividad_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select contacto_id into new.contacto_id from public.crm_oportunidades where id = new.oportunidad_id;
  return new;
end;
$$;
drop trigger if exists crm_actividad_antes on public.crm_actividades;
create trigger crm_actividad_antes before insert on public.crm_actividades
  for each row execute function public.crm_actividad_antes();

-- ------------------------------------------------- permisos (funciones) ---
-- security definer: leen las tablas sin pasar por su propio RLS (evita recursión).
create or replace function public.crm_puede_ver_op(p_op uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.tiene_rol('editor','administrador','marketing') then exists (select 1 from public.crm_oportunidades where id = p_op)
    when public.mi_rol() = 'asesor' then exists (
      select 1 from public.crm_oportunidades
      where id = p_op and (asignado_a = public.crm_mi_correo() or asignado_a is null))
    else false
  end
$$;

create or replace function public.crm_puede_gestionar_op(p_op uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.tiene_rol('editor','administrador') then exists (select 1 from public.crm_oportunidades where id = p_op)
    when public.mi_rol() = 'asesor' then exists (
      select 1 from public.crm_oportunidades
      where id = p_op and asignado_a = public.crm_mi_correo())
    else false
  end
$$;

create or replace function public.crm_puede_ver_contacto(p_contacto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.tiene_rol('editor','administrador','marketing') then true
    when public.mi_rol() = 'asesor' then
      exists (select 1 from public.crm_contactos where id = p_contacto and creado_por = public.crm_mi_correo())
      or exists (select 1 from public.crm_oportunidades
                 where contacto_id = p_contacto
                   and (asignado_a = public.crm_mi_correo() or asignado_a is null))
    else false
  end
$$;

grant execute on function public.crm_puede_ver_op(uuid), public.crm_puede_gestionar_op(uuid),
                          public.crm_puede_ver_contacto(uuid) to authenticated;
revoke execute on function public.crm_puede_ver_op(uuid), public.crm_puede_gestionar_op(uuid),
                           public.crm_puede_ver_contacto(uuid) from anon, public;

-- --------------------------------------------------------------- políticas ---
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('crm_contactos','crm_oportunidades','crm_actividades','crm_ia_uso')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- contactos
create policy "crm contactos: ver"
  on public.crm_contactos for select to authenticated
  using (public.crm_puede_ver_contacto(id));
create policy "crm contactos: crear"
  on public.crm_contactos for insert to authenticated
  with check (public.tiene_rol('editor','administrador','asesor') and creado_por = public.crm_mi_correo());
create policy "crm contactos: editar"
  on public.crm_contactos for update to authenticated
  using (
    public.tiene_rol('editor','administrador')
    or (public.mi_rol() = 'asesor' and (
          creado_por = public.crm_mi_correo()
          or exists (select 1 from public.crm_oportunidades o
                     where o.contacto_id = crm_contactos.id and o.asignado_a = public.crm_mi_correo())))
  )
  with check (true);
create policy "crm contactos: solo editor elimina"
  on public.crm_contactos for delete to authenticated
  using (public.tiene_rol('editor'));

-- oportunidades
create policy "crm oportunidades: ver"
  on public.crm_oportunidades for select to authenticated
  using (public.tiene_rol('editor','administrador','marketing')
         or (public.mi_rol() = 'asesor' and (asignado_a = public.crm_mi_correo() or asignado_a is null)));
create policy "crm oportunidades: crear"
  on public.crm_oportunidades for insert to authenticated
  with check (public.tiene_rol('editor','administrador')
              or (public.mi_rol() = 'asesor' and asignado_a = public.crm_mi_correo()));
create policy "crm oportunidades: editar"
  on public.crm_oportunidades for update to authenticated
  using (public.tiene_rol('editor','administrador')
         or (public.mi_rol() = 'asesor' and asignado_a = public.crm_mi_correo()))
  with check (public.tiene_rol('editor','administrador')
              or (public.mi_rol() = 'asesor' and asignado_a = public.crm_mi_correo()));
create policy "crm oportunidades: solo editor elimina"
  on public.crm_oportunidades for delete to authenticated
  using (public.tiene_rol('editor'));

-- actividades
create policy "crm actividades: ver"
  on public.crm_actividades for select to authenticated
  using (public.crm_puede_ver_op(oportunidad_id));
create policy "crm actividades: crear"
  on public.crm_actividades for insert to authenticated
  with check (public.crm_puede_gestionar_op(oportunidad_id) and creado_por = public.crm_mi_correo());
create policy "crm actividades: editar (completar tareas)"
  on public.crm_actividades for update to authenticated
  using (public.crm_puede_gestionar_op(oportunidad_id))
  with check (public.crm_puede_gestionar_op(oportunidad_id));
create policy "crm actividades: solo editor elimina"
  on public.crm_actividades for delete to authenticated
  using (public.tiene_rol('editor'));

-- uso de IA
create policy "crm ia: registrar el propio"
  on public.crm_ia_uso for insert to authenticated
  with check (public.mi_rol() is not null and email = public.crm_mi_correo());
create policy "crm ia: ver"
  on public.crm_ia_uso for select to authenticated
  using (public.tiene_rol('editor','administrador') or email = public.crm_mi_correo());

-- ------------------------------------------------------- alta de leads ---
-- Núcleo común: busca/crea el contacto, reutiliza la oportunidad abierta del
-- mismo proyecto (para no duplicar tarjetas) y deja la consulta en la línea de
-- tiempo. No es invocable desde fuera; solo lo usan las dos funciones de abajo.
create or replace function public.crm_alta_lead(
  p_nombre text, p_telefono text, p_correo text, p_proyecto text, p_interes text,
  p_mensaje text, p_fuente text, p_origen text, p_asignar text, p_quien text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_norm text := public.crm_normalizar_telefono(p_telefono);
  v_correo text := nullif(lower(btrim(coalesce(p_correo, ''))), '');
  v_contacto uuid;
  v_op uuid;
  v_asig text;
  v_nuevo boolean := false;
begin
  if v_norm <> '' then
    select id into v_contacto from public.crm_contactos where telefono_norm = v_norm;
  end if;
  if v_contacto is null and v_correo is not null then
    select id into v_contacto from public.crm_contactos where correo = v_correo limit 1;
  end if;

  if v_contacto is null then
    insert into public.crm_contactos (nombre, telefono, telefono_norm, correo, creado_por)
    values (btrim(p_nombre), nullif(btrim(coalesce(p_telefono, '')), ''), v_norm, v_correo, p_quien)
    returning id into v_contacto;
  else
    update public.crm_contactos
       set correo = coalesce(correo, v_correo),
           telefono = coalesce(telefono, nullif(btrim(coalesce(p_telefono, '')), '')),
           telefono_norm = case when telefono_norm = '' then v_norm else telefono_norm end
     where id = v_contacto;
  end if;

  select id into v_op from public.crm_oportunidades
   where contacto_id = v_contacto
     and coalesce(proyecto, '') = coalesce(p_proyecto, '')
     and etapa not in ('vendido','perdido')
   order by created_at desc limit 1;

  if v_op is null then
    -- Un cliente que ya tiene asesor sigue con ese asesor.
    select asignado_a into v_asig from public.crm_oportunidades
     where contacto_id = v_contacto and asignado_a is not null
     order by created_at desc limit 1;
    insert into public.crm_oportunidades (contacto_id, proyecto, unidad_interes, fuente, origen, asignado_a)
    values (v_contacto, p_proyecto, nullif(btrim(coalesce(p_interes, '')), ''), p_fuente, p_origen,
            coalesce(p_asignar, v_asig))
    returning id into v_op;
    v_nuevo := true;
  end if;

  if coalesce(btrim(p_mensaje), '') <> '' or not v_nuevo then
    insert into public.crm_actividades (oportunidad_id, contacto_id, tipo, contenido, creado_por)
    values (v_op, v_contacto, case when v_nuevo then 'nota' else 'sistema' end,
            case when v_nuevo then left(btrim(p_mensaje), 4000)
                 else 'Volvió a escribir' || coalesce(' desde ' || p_origen, '') ||
                      case when coalesce(btrim(p_mensaje), '') <> '' then ': ' || left(btrim(p_mensaje), 3800) else '.' end
            end,
            p_quien);
  end if;

  return jsonb_build_object('oportunidad_id', v_op, 'contacto_id', v_contacto, 'nuevo', v_nuevo);
end;
$$;
revoke all on function public.crm_alta_lead(text,text,text,text,text,text,text,text,text,text)
  from public, anon, authenticated;

-- Puerta pública: formularios de las landings (rol anon).
create or replace function public.crm_registrar_lead(
  p_nombre text, p_telefono text, p_correo text default null, p_proyecto text default null,
  p_interes text default null, p_mensaje text default null, p_origen text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_proyecto text := nullif(lower(btrim(coalesce(p_proyecto, ''))), '');
  v_norm text := public.crm_normalizar_telefono(p_telefono);
begin
  if char_length(btrim(coalesce(p_nombre, ''))) not between 2 and 120 then
    raise exception 'Nombre no válido';
  end if;
  if char_length(v_norm) not between 9 and 15 then
    raise exception 'Teléfono no válido';
  end if;
  if v_proyecto is not null and v_proyecto !~ '^[a-z0-9_-]{1,40}$' then
    v_proyecto := null;
  end if;
  if p_correo is not null and btrim(p_correo) <> '' and btrim(p_correo) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    p_correo := null;
  end if;
  -- Freno contra inundación de formularios.
  if (select count(*) from public.crm_actividades
      where creado_por = 'web' and created_at > now() - interval '1 hour') > 300 then
    raise exception 'Demasiadas solicitudes, intenta más tarde';
  end if;

  perform public.crm_alta_lead(
    p_nombre, p_telefono, left(p_correo, 160), v_proyecto, left(p_interes, 120),
    left(p_mensaje, 1000), 'formulario_web', left(coalesce(p_origen, v_proyecto), 40), null, 'web');
  return true;
end;
$$;
revoke all on function public.crm_registrar_lead(text,text,text,text,text,text,text) from public;
grant execute on function public.crm_registrar_lead(text,text,text,text,text,text,text) to anon, authenticated;

-- Alta desde la app (asesor, administrador, editor).
create or replace function public.crm_crear_lead(
  p_nombre text, p_telefono text, p_correo text default null, p_proyecto text default null,
  p_interes text default null, p_nota text default null, p_fuente text default 'otro',
  p_asignado text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_yo text := public.crm_mi_correo();
  v_asignar text;
begin
  if not public.tiene_rol('editor','administrador','asesor') then
    raise exception 'Tu rol no permite crear leads';
  end if;
  if char_length(btrim(coalesce(p_nombre, ''))) not between 2 and 120 then
    raise exception 'Escribe el nombre del cliente';
  end if;
  if p_fuente not in ('formulario_web','whatsapp','llamada','facebook','instagram','tiktok','google',
                      'marketplace','plusvalia','feria','cartera','co_broker','referido','oficina','otro') then
    p_fuente := 'otro';
  end if;
  -- Asesor: siempre para sí mismo. Gestor: quien indique, o nadie.
  if public.mi_rol() = 'asesor' then v_asignar := v_yo;
  else v_asignar := nullif(lower(btrim(coalesce(p_asignado, ''))), ''); end if;

  return public.crm_alta_lead(
    p_nombre, p_telefono, left(p_correo, 160), nullif(lower(btrim(coalesce(p_proyecto, ''))), ''),
    left(p_interes, 120), left(p_nota, 1000), p_fuente, 'app', v_asignar, v_yo);
end;
$$;
revoke all on function public.crm_crear_lead(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.crm_crear_lead(text,text,text,text,text,text,text,text) to authenticated;

-- Un asesor toma un lead que nadie tiene.
create or replace function public.crm_tomar_lead(p_op uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.tiene_rol('editor','administrador','asesor') then
    raise exception 'Tu rol no permite tomar leads';
  end if;
  update public.crm_oportunidades
     set asignado_a = public.crm_mi_correo()
   where id = p_op and asignado_a is null;
  if not found then
    raise exception 'Este lead ya tiene responsable';
  end if;
end;
$$;
revoke all on function public.crm_tomar_lead(uuid) from public, anon;
grant execute on function public.crm_tomar_lead(uuid) to authenticated;

-- Editor/administrador reasignan.
create or replace function public.crm_asignar(p_op uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if not public.tiene_rol('editor','administrador') then
    raise exception 'Tu rol no permite asignar leads';
  end if;
  if v_email is not null and not exists (
       select 1 from public.user_roles where email = v_email and role in ('editor','administrador','asesor')) then
    raise exception 'Esa persona no puede recibir leads';
  end if;
  update public.crm_oportunidades set asignado_a = v_email where id = p_op;
  if not found then raise exception 'No se encontró el lead'; end if;
end;
$$;
revoke all on function public.crm_asignar(uuid, text) from public, anon;
grant execute on function public.crm_asignar(uuid, text) to authenticated;

-- Personas a las que se puede asignar (con su nombre del cotizador si existe).
create or replace function public.crm_equipo()
returns table (email text, nombre text, rol text)
language sql stable security definer set search_path = public as $$
  select r.email,
         coalesce(nullif(r.nombre, ''), a.nombre, initcap(replace(split_part(r.email, '@', 1), '.', ' '))) as nombre,
         r.role
  from public.user_roles r
  left join public.cotizador_asesores a on lower(a.correo) = r.email
  where r.role in ('editor','administrador','asesor')
    and public.tiene_rol('editor','administrador','marketing')
  order by 2
$$;
revoke all on function public.crm_equipo() from public, anon;
grant execute on function public.crm_equipo() to authenticated;

-- ---------------------------------------------------------------- métricas ---
-- security invoker: cada persona obtiene los números de lo que puede ver.
create or replace function public.crm_metricas(p_dias integer default 30)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
begin
  return jsonb_build_object(
    'dias', v_dias,
    'abiertas',    (select count(*) from public.crm_oportunidades where etapa not in ('vendido','perdido')),
    'sin_asignar', (select count(*) from public.crm_oportunidades where asignado_a is null and etapa not in ('vendido','perdido')),
    'nuevos',      (select count(*) from public.crm_oportunidades where created_at >= v_desde),
    'vendidos',    (select count(*) from public.crm_oportunidades where etapa = 'vendido' and cerrado_at >= v_desde),
    'perdidos',    (select count(*) from public.crm_oportunidades where etapa = 'perdido' and cerrado_at >= v_desde),
    'tareas_vencidas', (select count(*) from public.crm_actividades
                         where tipo = 'tarea' and hecha_at is null and vence_at < now()),
    'por_etapa', coalesce((
      select jsonb_object_agg(etapa, n)
      from (select etapa, count(*) as n from public.crm_oportunidades group by etapa) x), '{}'::jsonb),
    'por_fuente', coalesce((
      select jsonb_agg(jsonb_build_object('fuente', fuente, 'leads', leads, 'vendidos', vendidos) order by leads desc, vendidos desc)
      from (select fuente,
                   count(*) filter (where created_at >= v_desde) as leads,
                   count(*) filter (where etapa = 'vendido' and cerrado_at >= v_desde) as vendidos
            from public.crm_oportunidades group by fuente) f
      where leads > 0 or vendidos > 0), '[]'::jsonb),
    'por_asesor', coalesce((
      select jsonb_agg(jsonb_build_object('email', asignado_a, 'abiertas', abiertas, 'vendidos', vendidos) order by abiertas desc)
      from (select asignado_a,
                   count(*) filter (where etapa not in ('vendido','perdido')) as abiertas,
                   count(*) filter (where etapa = 'vendido' and cerrado_at >= v_desde) as vendidos
            from public.crm_oportunidades where asignado_a is not null group by asignado_a) a), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.crm_metricas(integer) from public, anon;
grant execute on function public.crm_metricas(integer) to authenticated;

-- ---------------------------------------------------------- tiempo real ---
-- La app se actualiza sola cuando entra un lead (Realtime respeta el RLS).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['crm_oportunidades','crm_actividades'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
