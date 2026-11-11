-- ============================================================================
-- FORXA · 15 · 15 Patios: la compra es de CONTADO (proyecto finalizado)
-- El crédito hipotecario solo se simula en la proforma para estimar la cuota
-- mensual; no forma parte de la compra. Corrige el supuesto del archivo 14
-- (que copió la política de cuotas hasta la entrega de Arcus).
--  · tipo_financiamiento = 'contado_simulacion' (nuevo tipo del cotizador)
--  · reserva_pct 2 % (editable por proforma); promesa_pct = 0 (no aplica)
--  · tasa_default / plazo_default_anios: valores de la simulación (10.5 % / 20 años)
-- Es seguro volver a ejecutarlo.
-- ============================================================================
update public.cotizador_proyectos
   set tipo_financiamiento = 'contado_simulacion', promesa_pct = 0
 where id = '15patios';
