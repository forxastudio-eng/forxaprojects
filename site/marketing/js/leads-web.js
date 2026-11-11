// Leads reales de los formularios de la web (tabla leads) y su conversión a
// proforma (mismo teléfono en el historial del cotizador). Últimos 30 días.
(async function () {
  const sb = window.FORXA_SUPABASE;
  const wrap = document.getElementById("leads-web-wrap");
  if (!wrap || !sb || !sb.isConfigured) return;
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [l, h] = await Promise.all([
    sb.client.from("leads").select("proyecto,tipo,estado,telefono,created_at").gte("created_at", desde),
    sb.client.from("cotizador_historial").select("cliente_telefono").gte("created_at", desde),
  ]);
  if (l.error) { wrap.innerHTML = '<p class="sub">No se pudieron leer los leads: ' + escapeHtml(l.error.message) + "</p>"; return; }
  const digits = (t) => String(t || "").replace(/\D/g, "").slice(-9); // ignora 0 / +593 inicial
  const conProforma = new Set((h.data || []).map((r) => digits(r.cliente_telefono)).filter(Boolean));
  const leads = l.data || [];
  const convertidos = leads.filter((r) => conProforma.has(digits(r.telefono))).length;
  const NOMBRES = { home: "Landing principal", alabes: "Álabes", arcus: "Arcus", porton: "Portón del Valle" };
  const porProyecto = {};
  leads.forEach((r) => { porProyecto[r.proyecto] = (porProyecto[r.proyecto] || 0) + 1; });
  const card = (label, num, ctx) =>
    '<div class="kpi-card"><div class="label">' + label + '</div><div class="num">' + num + '</div><div class="foot"><span class="ctx">' + ctx + "</span></div></div>";
  wrap.innerHTML =
    card("Leads de la web", leads.length, "últimos 30 días") +
    card("Visitas agendadas", leads.filter((r) => r.tipo === "visita").length, "pidieron fecha de visita") +
    card("Sin contactar", leads.filter((r) => r.estado === "nuevo").length, '<a href="/admin/#/leads">abrir bandeja</a>') +
    card("Lead → proforma", leads.length ? Math.round((convertidos / leads.length) * 100) + "%" : "—", convertidos + " con proforma generada") +
    '<div class="kpi-card" style="grid-column:1/-1"><div class="label">Por proyecto</div><div class="foot" style="gap:14px">' +
      (Object.keys(porProyecto).length
        ? Object.keys(porProyecto).sort((a, b) => porProyecto[b] - porProyecto[a]).map((k) => "<span><strong>" + porProyecto[k] + "</strong> " + escapeHtml(NOMBRES[k] || k) + "</span>").join("")
        : '<span class="ctx">Todavía no llegan leads desde los formularios.</span>') +
    "</div></div>";
})();
