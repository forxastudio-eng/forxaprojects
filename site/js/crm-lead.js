/* ==========================================================================
   FORXA · Captura de leads para el CRM
   Guarda en Supabase lo que alguien escribe en un formulario de contacto
   (función pública crm_registrar_lead, supabase/11_crm.sql). Es "dispara y
   olvida": nunca bloquea ni cambia lo que ya hace el formulario (abrir
   WhatsApp); si algo falla, el cliente igual llega a WhatsApp.
   Uso: FORXA_CRM.enviar({ nombre, telefono, correo, proyecto, interes, mensaje, origen })
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.FORXA_CONFIG || {};

  /* "/arcus/" → "arcus" · "https://otro.com/" → "otro-com" */
  function slug(v) {
    if (!v) return "";
    var s = String(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, 40);
  }

  function enviar(d) {
    try {
      if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !d || !d.nombre || !d.telefono) return;
      fetch(CFG.SUPABASE_URL + "/rest/v1/rpc/crm_registrar_lead", {
        method: "POST",
        keepalive: true,                      // sigue aunque la pestaña cambie a WhatsApp
        headers: {
          "Content-Type": "application/json",
          apikey: CFG.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          p_nombre: d.nombre,
          p_telefono: d.telefono,
          p_correo: d.correo || null,
          p_proyecto: slug(d.proyecto) || null,
          p_interes: d.interes || null,
          p_mensaje: d.mensaje || null,
          p_origen: slug(d.origen || d.proyecto) || null
        })
      }).catch(function () {});
    } catch (e) { /* el formulario sigue su curso */ }
  }

  window.FORXA_CRM = { enviar: enviar, slug: slug };
})();
