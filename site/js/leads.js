/* FORXA · Captura de leads. Cada <form data-lead> recibe un campo trampa
   (honeypot) y el widget de Cloudflare Turnstile. FORXA_LEAD.send() guarda el
   lead en Supabase (Edge Function "lead") sin bloquear: WhatsApp se abre igual
   aunque el guardado falle, para no perder nunca la venta. */
(function () {
  "use strict";
  var C = window.FORXA_CONFIG || {};
  var forms = document.querySelectorAll("form[data-lead]");
  if (!forms.length) return;

  forms.forEach(function (form) {
    var hp = document.createElement("div");
    hp.setAttribute("aria-hidden", "true");
    hp.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
    hp.innerHTML = '<label>No llenar<input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(hp);
    var visit = form.querySelector('input[type="date"][name="visit"]');
    if (visit) visit.min = new Date().toISOString().slice(0, 10);
    if (C.TURNSTILE_SITE_KEY) {
      var ts = document.createElement("div");
      ts.className = "cf-turnstile";
      ts.setAttribute("data-sitekey", C.TURNSTILE_SITE_KEY);
      ts.setAttribute("data-language", "es");
      ts.setAttribute("data-size", "flexible");
      ts.style.margin = "12px 0";
      var btn = form.querySelector('[type="submit"]');
      btn ? btn.parentNode.insertBefore(ts, btn) : form.appendChild(ts);
    }
  });
  if (C.TURNSTILE_SITE_KEY) {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  function val(form, sel) { var el = form.querySelector(sel); return el ? String(el.value || "").trim() : ""; }

  // data: { proyecto, nombre, telefono, email?, interes?, mensaje?, fecha_visita? }
  function send(form, data) {
    if (!C.SUPABASE_URL || !data || !data.nombre || !data.telefono) return;
    data.website = val(form, 'input[name="website"]');
    data.turnstile = val(form, '[name="cf-turnstile-response"]');
    data.fuente = (location.pathname + location.search).slice(0, 500);
    try {
      fetch(C.SUPABASE_URL + "/functions/v1/lead", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY },
        body: JSON.stringify(data)
      }).catch(function () {});
    } catch (e) { /* sin red: WhatsApp sigue funcionando */ }
    if (window.umami && window.umami.track) { try { window.umami.track("lead", { proyecto: data.proyecto, visita: !!data.fecha_visita }); } catch (e) {} }
    // El token de Turnstile sirve una sola vez: se pide otro para un segundo envío.
    if (window.turnstile) { try { window.turnstile.reset(form.querySelector(".cf-turnstile")); } catch (e) {} }
  }

  window.FORXA_LEAD = { send: send };
})();
