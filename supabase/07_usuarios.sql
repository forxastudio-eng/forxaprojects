-- ============================================================================
-- FORXA · 07 · Roles del equipo
-- Asigna el rol por correo. Las CUENTAS (correo + contraseña) se crean aparte
-- con scripts/crear_usuarios.mjs o en Authentication → Users → Add user.
-- Después, el editor puede agregar/cambiar roles desde el panel.
-- ============================================================================

insert into public.user_roles (email, role, nombre) values
  ('gabichopalomeque@gmail.com',       'editor',        null),
  ('ceo@forxainmobiliaria.com',        'administrador', null),
  ('info@forxainmobiliaria.com',       'administrador', null),
  ('marketing@forxainmobiliaria.com',  'marketing',     null),
  ('prodriguez@forxainmobiliaria.com', 'asesor',        null),
  ('psacaquirin@forxainmobiliaria.com','asesor',        null),
  ('dmolina@forxainmobiliaria.com',    'asesor',        null),
  ('vponce@forxainmobiliaria.com',     'asesor',        null),
  ('vgranja@forxainmobiliaria.com',    'asesor',        null),
  ('dpalacios@forxainmobiliaria.com',  'asesor',        null),
  ('acardenas@forxainmobiliaria.com',  'asesor',        null)
on conflict (email) do update set role = excluded.role;
