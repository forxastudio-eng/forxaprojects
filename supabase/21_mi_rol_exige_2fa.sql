-- ============================================================================
-- FORXA · 21 · Verificación en dos pasos exigida por la base de datos.
-- Si la cuenta activó 2FA, la sesión debe haber pasado el código (aal2) para tener
-- rol; con solo la contraseña (aal1) no hay ningún permiso. Sin 2FA, nada cambia.
-- Aplicado en Supabase. Idempotente.
-- RECUPERACIÓN si alguien pierde el teléfono: Supabase → Authentication → Users →
-- la persona → borrar su factor MFA. Luego entra solo con contraseña y lo vuelve a activar.
-- ============================================================================
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path to 'public' as $function$
  select r.role from public.user_roles r
  where r.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f
                        where f.user_id = (select auth.uid()) and f.status = 'verified'))
$function$;
revoke execute on function public.mi_rol() from public, anon;
grant execute on function public.mi_rol() to authenticated;
