-- Portadas de las tarjetas de Arcus: una foto para todas las suites y otra
-- para todos los lofts. Solo cambia "thumb" (la portada); "ficha" no se toca.
-- Respeta las portadas subidas a mano desde el panel (URLs de Storage).
update public.arcus_units set thumb = 'img/portadas/suite.jpg'
  where kind = 'suite' and thumb like 'img/%';
update public.arcus_units set thumb = 'img/portadas/loft.jpg'
  where kind = 'loft' and thumb like 'img/%';
