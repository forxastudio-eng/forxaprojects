-- ============================================================================
-- FORXA · 14 · Cotizador: proyecto 15 PATIOS (Misicata, Cuenca) — 5 viviendas
-- Unidades en exclusividad del contratista, entrega enero de 2027.
--
-- Supuestos (la política de pago se corrigió en el archivo 15: es de contado):
--  · Política de pago: aquí se copió la de Arcus (cuotas hasta la entrega) por
--    falta de datos; el archivo 15 la corrige a CONTADO + simulación de crédito.
--  · Vivienda 3 queda "no_disponible" porque así figura en el brochure
--    (la tabla de precios la lista como disponible y con exclusividad).
--  · Total de la tabla de precios: dice $685.000 pero la suma de las cinco
--    viviendas es $684.500. Se cargaron los precios por vivienda.
--  · Propietario y exclusividad van en "nota" (interna, no se imprime).
-- Portada y logo se publican con el sitio: /assets/covers/15-patios.jpg y
-- /assets/logos/15patios.png. Los planos: /cotizador/assets/unidades/15patios/.
-- Es seguro volver a ejecutarlo.
-- ============================================================================

insert into public.cotizador_proyectos
  (id, nombre, tagline, ubicacion, color_primario, color_acento, cover_url,
   tipo_financiamiento, prefijo_proforma, reserva_pct, promesa_pct, tasa_default,
   plazo_default_anios, permite_descuento_manual, monto_descuento_clic,
   permite_multi_seleccion, sort_order)
values
  ('15patios', '15 Patios', 'Vivir sin prisas · 5 viviendas de 3 patios entre los cerros de Misicata',
   'Misicata, Cuenca, Ecuador', '#352B23', '#BD603F', '/assets/covers/15-patios.jpg',
   'cuotas_entrega', '15PATIOS', 0.02, 0.08, 10.5, 20, false, 0, false, 6)
on conflict (id) do update set
  nombre = excluded.nombre, tagline = excluded.tagline, ubicacion = excluded.ubicacion,
  color_primario = excluded.color_primario, color_acento = excluded.color_acento,
  cover_url = excluded.cover_url;

insert into public.cotizador_unidades
  (proyecto_id, codigo, nombre, tipo, planta, terreno_m2, construccion_m2,
   dormitorios, banos, parqueos, precio, estado, foto_url, nota, sort_order)
values
  ('15patios', '1', 'Vivienda 1', 'Casa', 'Parcela 1 · Tipología A', 132.48, 167.48, 3, 2, 1, 135000, 'disponible',
   '/cotizador/assets/unidades/15patios/vivienda-1.jpg',
   'Entrega enero 2027. Propietario: Juan Pablo Astudillo Cordero. Sin exclusividad FORXA.', 1),
  ('15patios', '2', 'Vivienda 2', 'Casa', 'Parcela 2 · Tipología A', 133.02, 167.48, 3, 2, 1, 135000, 'disponible',
   '/cotizador/assets/unidades/15patios/vivienda-2.jpg',
   'Entrega enero 2027. Propietario: Jaime Sebastián Astudillo Cordero. Exclusividad FORXA.', 2),
  ('15patios', '3', 'Vivienda 3', 'Casa', 'Parcela 3 · Tipología A', 133.19, 167.48, 3, 2, 1, 135000, 'no_disponible',
   '/cotizador/assets/unidades/15patios/vivienda-3.jpg',
   'Entrega enero 2027. Propietario: Juan Pablo Astudillo Cordero. Exclusividad FORXA. El brochure la marca "No disponible".', 3),
  ('15patios', '4', 'Vivienda 4', 'Casa', 'Parcela 4 · Tipología A', 132.55, 167.48, 3, 2, 1, 135000, 'disponible',
   '/cotizador/assets/unidades/15patios/vivienda-4.jpg',
   'Entrega enero 2027. Propietario: Jaime Sebastián Astudillo Cordero. Exclusividad FORXA.', 4),
  ('15patios', '5', 'Vivienda 5', 'Casa', 'Parcela 5 · Tipología B', 190.71, 146.65, 3, 2, 1, 144500, 'disponible',
   '/cotizador/assets/unidades/15patios/vivienda-5.jpg',
   'Entrega enero 2027. Propietario: Juan Pablo Astudillo Cordero. Exclusividad FORXA.', 5)
on conflict (proyecto_id, codigo) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, planta = excluded.planta,
  terreno_m2 = excluded.terreno_m2, construccion_m2 = excluded.construccion_m2,
  dormitorios = excluded.dormitorios, banos = excluded.banos, parqueos = excluded.parqueos,
  precio = excluded.precio, estado = excluded.estado, foto_url = excluded.foto_url,
  nota = excluded.nota, sort_order = excluded.sort_order;
