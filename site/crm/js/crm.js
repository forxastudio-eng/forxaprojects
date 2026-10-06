/* ==========================================================================
   FORXA · CRM — aplicación (PWA).
   Misma cuenta y mismos permisos que el panel: la seguridad real la hace la
   base de datos (RLS, supabase/11_crm.sql); aquí solo se decide qué mostrar.
   La IA (supabase/functions/crm-ia) devuelve sugerencias; nada se guarda
   sin que la persona lo confirme, salvo el resumen/calificación de la tarjeta.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.FORXA_CONFIG || {};
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  var FN_IA = CFG.SUPABASE_URL + "/functions/v1/crm-ia";

  /* ------------------------------------------------------------ catálogos */
  var ETAPAS = [
    { id: "nuevo", t: "Nuevo" }, { id: "contactado", t: "Contactado" }, { id: "cita", t: "Cita" },
    { id: "proforma", t: "Proforma" }, { id: "reserva", t: "Reserva" },
    { id: "vendido", t: "Vendido" }, { id: "perdido", t: "Perdido" }
  ];
  var FUENTES = {
    formulario_web: "Formulario web", whatsapp: "WhatsApp", llamada: "Llamada", facebook: "Facebook",
    instagram: "Instagram", tiktok: "TikTok", google: "Google", marketplace: "Marketplace",
    plusvalia: "Plusvalía", feria: "Feria", cartera: "Cartera del asesor", co_broker: "Asesor externo",
    referido: "Referido", oficina: "Oficina", otro: "Otro"
  };
  var PROYECTOS = { alabes: "Álabes", arcus: "Arcus", porton: "Portón del Valle", aura: "AURA", misicata: "Misicata", home: "FORXA (general)" };
  var TIPOS = {
    nota: ["Nota", "✎"], llamada: ["Llamada", "☎"], whatsapp: ["WhatsApp", "💬"], correo: ["Correo", "✉"],
    visita: ["Visita", "⌂"], tarea: ["Tarea", "☑"], cambio_etapa: ["Etapa", "⇢"], sistema: ["Sistema", "•"], ia: ["IA", "✦"]
  };
  var OBJETIVOS = {
    primer_contacto: "Primer contacto", seguimiento: "Seguimiento", agendar_cita: "Agendar cita",
    enviar_proforma: "Acompañar proforma", reactivar: "Reactivar cliente", cierre: "Cierre / reserva"
  };
  var MOTIVOS_PERDIDA = ["Compró en otro lado", "Precio", "No responde", "Cambió de planes", "No califica / financiamiento", "Otro"];
  var CERRADAS = ["vendido", "perdido"];

  /* -------------------------------------------------------------- estado */
  var S = {
    user: null, email: "", rol: null,
    ops: [], tareas: [], equipo: [],
    vista: "hoy",
    f: { q: "", proyecto: "", quien: "todos" },
    chat: [], iaOcupada: false,
    metDias: 30, metricas: null,
    det: null,             // lead abierto: { op, contacto, acts }
    modoAct: "nota",       // pestaña activa al registrar: nota | tarea
    prop: null,            // propuesta de la IA para una nota dictada
    cargando: false
  };

  /* ----------------------------------------------------------- utilidades */
  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var P = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    funnel: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 5v4h4M4 13a8 8 0 0 0 14 4M20 19v-4h-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    send: '<path d="m4 12 16-8-6 16-2-7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  function icon(n, cls) { return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || "") + "</svg>"; }

  function toast(msg, error) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (error ? " error" : ""); t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, error ? 5200 : 2800);
  }

  function ms(iso) { return iso ? new Date(iso).getTime() : 0; }
  function hace(iso) {
    var m = Math.round((Date.now() - ms(iso)) / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "hace " + h + " h";
    var d = Math.round(h / 24);
    if (d < 31) return "hace " + d + (d === 1 ? " día" : " días");
    return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
  }
  function diasSin(iso) { return Math.floor((Date.now() - ms(iso)) / 86400000); }
  function inicioDia(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function cuando(iso) {
    if (!iso) return { txt: "Sin fecha", vencida: false };
    var dif = Math.round((inicioDia(iso) - inicioDia(new Date())) / 86400000);
    var hora = new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    if (dif < 0) return { txt: "Vencida " + (dif === -1 ? "ayer" : "hace " + -dif + " días"), vencida: true };
    if (dif === 0) return { txt: "Hoy " + hora, vencida: ms(iso) < Date.now() };
    if (dif === 1) return { txt: "Mañana", vencida: false };
    return { txt: new Date(iso).toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" }), vencida: false };
  }
  function dinero(n) { return n == null || n === "" ? "" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }
  function etapaTxt(id) { var e = ETAPAS.filter(function (x) { return x.id === id; })[0]; return e ? e.t : id; }
  function proyTxt(id) { return id ? (PROYECTOS[id] || id) : "Sin proyecto"; }
  function nombreDe(email) {
    if (!email) return "Sin asignar";
    var e = S.equipo.filter(function (x) { return x.email === email; })[0];
    if (e && e.nombre) return e.nombre;
    return email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function abierta(o) { return CERRADAS.indexOf(o.etapa) === -1; }
  function puedeEscribir() { return ["editor", "administrador", "asesor"].indexOf(S.rol) !== -1; }
  function esGestor() { return S.rol === "editor" || S.rol === "administrador"; }
  function esMia(o) { return o.asignado_a === S.email; }
  function puedeGestionar(o) { return esGestor() || (S.rol === "asesor" && esMia(o)); }
  function opPorId(id) { return S.ops.filter(function (o) { return o.id === id; })[0]; }
  function telHref(c) { return c && c.telefono_norm ? "tel:+" + c.telefono_norm : ""; }
  function waHref(c, texto) { return c && c.telefono_norm ? "https://wa.me/" + c.telefono_norm + (texto ? "?text=" + encodeURIComponent(texto) : "") : ""; }

  function online() { return navigator.onLine !== false; }
  function mensajeError(e) {
    var m = (e && (e.message || e.error_description)) || "Algo salió mal";
    if (e && e.code === "23505") return "Ya existe un contacto con ese teléfono.";
    if (/row-level security|permission denied/i.test(m)) return "Tu rol no permite esta acción.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sin conexión. Inténtalo de nuevo.";
    return m;
  }

  /* Conserva lo que la persona está escribiendo cuando la pantalla se repinta
     (por ejemplo, al llegar un lead nuevo en tiempo real). */
  function claveCampo(el) { return (el.form && el.form.id || "") + "|" + (el.id || el.name || ""); }
  function snap(root) {
    var s = {};
    root.querySelectorAll("input,textarea").forEach(function (el) {
      if (el.type === "checkbox" || el.type === "hidden" || claveCampo(el).slice(-1) === "|") return;
      s[claveCampo(el)] = el.value;
    });
    var d = root.querySelector("details"); s["@open"] = d ? d.open : false;
    var a = document.activeElement;
    if (a && root.contains(a) && a.id) { s["@focus"] = a.id; try { s["@sel"] = [a.selectionStart, a.selectionEnd]; } catch (e) { /* sin selección */ } }
    return s;
  }
  function restore(root, s) {
    root.querySelectorAll("input,textarea").forEach(function (el) {
      var k = claveCampo(el);
      if (el.type !== "checkbox" && el.type !== "hidden" && k in s && el.value !== s[k]) el.value = s[k];
    });
    var d = root.querySelector("details"); if (d && s["@open"]) d.open = true;
    if (s["@focus"]) {
      var f = document.getElementById(s["@focus"]);
      if (f) { f.focus(); if (s["@sel"] && f.setSelectionRange) { try { f.setSelectionRange(s["@sel"][0], s["@sel"][1]); } catch (e) { /* tipo sin selección */ } } }
    }
  }
  function autorDe(email) {
    if (!email || email === "sistema") return "Sistema";
    if (email === "web") return "Formulario web";
    return nombreDe(email);
  }

  /* ------------------------------------------------------------ servidor */
  async function upd(tabla, id, patch) {
    var r = await sb.from(tabla).update(patch).eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw new Error("Tu rol no permite esta acción.");
  }

  async function llamarIA(payload) {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) throw new Error("Tu sesión venció. Vuelve a entrar.");
    var r = await fetch(FN_IA, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token, apikey: CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify(payload)
    });
    var j = {};
    try { j = await r.json(); } catch (e) { /* respuesta vacía */ }
    if (!r.ok || !j.ok) throw new Error(j.error || (r.status === 404 ? "La IA aún no está instalada en el servidor." : "No se pudo consultar a la IA."));
    return j;
  }

  var OP_SELECT = "*, contacto:crm_contactos(id,nombre,telefono,telefono_norm,correo)";
  async function cargar(silencioso) {
    if (S.cargando) return;
    S.cargando = true;
    if (!silencioso) $("btn-refresh").classList.add("girando");
    try {
      var r = await Promise.all([
        sb.from("crm_oportunidades").select(OP_SELECT).order("updated_at", { ascending: false }).limit(1000),
        sb.from("crm_actividades").select("id,oportunidad_id,contenido,vence_at").eq("tipo", "tarea").is("hecha_at", null)
          .order("vence_at", { ascending: true, nullsFirst: false }).limit(300)
      ]);
      if (r[0].error) throw r[0].error;
      if (r[1].error) throw r[1].error;
      S.ops = r[0].data || [];
      S.tareas = r[1].data || [];
      if (S.det) { var fresh = opPorId(S.det.op.id); if (fresh) S.det.op = fresh; }
      render();
      if (S.det) pintarHoja();
    } catch (e) {
      if (!silencioso) toast(mensajeError(e), true);
    } finally {
      S.cargando = false;
      $("btn-refresh").classList.remove("girando");
    }
  }

  var recargar = (function () {
    var t;
    return function () { clearTimeout(t); t = setTimeout(function () { cargar(true); if (S.det) cargarDetalle(S.det.op.id, true); }, 600); };
  })();

  /* --------------------------------------------------------- acceso / boot */
  function mostrar(que) {
    $("boot").hidden = true;
    $("auth").hidden = que !== "login";
    $("app").hidden = que !== "app";
  }
  function loginMsg(id, txt) { var n = $(id); n.textContent = txt || ""; n.hidden = !txt; }

  async function entrar(user) {
    var r = await sb.rpc("mi_rol");
    if (r.error || !r.data) {
      await sb.auth.signOut();
      mostrar("login");
      loginMsg("login-error", "Tu cuenta aún no tiene un rol asignado. Pídele al editor que te lo asigne.");
      return;
    }
    S.user = user; S.email = (user.email || "").toLowerCase(); S.rol = r.data;
    if (S.rol === "asesor") S.f.quien = "mios";
    if (S.rol !== "asesor") {
      var eq = await sb.rpc("crm_equipo");
      S.equipo = eq.data || [];
    }
    mostrar("app");
    pintarIconos();
    await cargar(true);
    suscribir();
    if (new URLSearchParams(location.search).get("nuevo") === "1" && puedeEscribir()) abrirNuevo();
  }

  function pintarIconos() {
    $("btn-refresh").innerHTML = icon("refresh");
    $("btn-menu").innerHTML = icon("user");
    $("fab").innerHTML = icon("plus");
  }

  var canal = null;
  function suscribir() {
    if (canal) return;
    canal = sb.channel("crm-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_oportunidades" }, function (p) {
        if (p.eventType === "INSERT") toast("Entró un nuevo lead");
        recargar();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_actividades" }, recargar)
      .subscribe();
  }

  /* ---------------------------------------------------------- navegación */
  var TABS = [
    { id: "hoy", t: "Hoy", i: "home" }, { id: "embudo", t: "Embudo", i: "funnel" },
    { id: "ia", t: "Asistente", i: "sparkle" }, { id: "metricas", t: "Métricas", i: "chart" }
  ];
  var TITULOS = { hoy: "Hoy", embudo: "Embudo", ia: "Asistente IA", metricas: "Métricas" };

  function conteos() {
    var abiertas = S.ops.filter(abierta);
    var sin = abiertas.filter(function (o) { return !o.asignado_a; }).length;
    var venc = S.tareas.filter(function (t) { return t.vence_at && ms(t.vence_at) < Date.now(); }).length;
    return { abiertas: abiertas.length, sin: sin, venc: venc };
  }

  function render() {
    var c = conteos();
    $("top-title").textContent = TITULOS[S.vista];
    $("tabbar").innerHTML = TABS.map(function (t) {
      var b = t.id === "hoy" && c.sin + c.venc ? '<span class="badge">' + (c.sin + c.venc) + "</span>" : "";
      return '<button class="tab" data-action="vista" data-v="' + t.id + '"' + (S.vista === t.id ? ' aria-current="page"' : "") + ">" +
        icon(t.i) + "<span>" + t.t + "</span>" + b + "</button>";
    }).join("");
    $("fab").hidden = !(puedeEscribir() && (S.vista === "hoy" || S.vista === "embudo"));
    var v = $("view"), ss = snap(v), sc = v.querySelector(".board"), x = sc ? sc.scrollLeft : 0;
    if (S.vista === "hoy") v.innerHTML = vistaHoy(c);
    else if (S.vista === "embudo") v.innerHTML = vistaEmbudo();
    else if (S.vista === "ia") v.innerHTML = vistaIA();
    else v.innerHTML = vistaMetricas();
    restore(v, ss);
    var n = v.querySelector(".board"); if (n) n.scrollLeft = x;
    if (S.vista === "metricas" && !S.metricas) cargarMetricas();
  }

  function cambiarVista(v) {
    S.vista = v;
    render();
    window.scrollTo(0, 0);
    if (v === "ia") { var ta = $("ia-input"); if (ta && window.innerWidth > 900) ta.focus(); }
  }

  /* ------------------------------------------------------------ tarjetas */
  function badgeEtapa(o) {
    var cls = o.etapa === "vendido" ? "green" : o.etapa === "perdido" ? "red" : "";
    return '<span class="chip ' + cls + '">' + esc(etapaTxt(o.etapa)) + "</span>";
  }
  function cardLead(o, opts) {
    opts = opts || {};
    var c = o.contacto || {};
    var tel = telHref(c), wa = waHref(c);
    var acciones = "";
    if (!o.asignado_a && abierta(o) && puedeEscribir())
      acciones += '<button class="btn btn-primary btn-sm" data-action="tomar" data-id="' + esc(o.id) + '">Tomar lead</button>';
    if (wa) acciones += '<a class="btn btn-sm btn-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon("chat", "icon-sm") + " WhatsApp</a>";
    if (tel) acciones += '<a class="btn btn-sm" href="' + esc(tel) + '">' + icon("phone", "icon-sm") + " Llamar</a>";
    if (opts.avanzar && abierta(o) && puedeGestionar(o)) {
      var i = ETAPAS.map(function (e) { return e.id; }).indexOf(o.etapa);
      if (i >= 0 && i < 4) acciones += '<button class="btn btn-sm" data-action="avanzar" data-id="' + esc(o.id) + '">→ ' + esc(ETAPAS[i + 1].t) + "</button>";
    }
    return '<div class="card lead" role="button" tabindex="0" data-action="abrir" data-id="' + esc(o.id) + '">' +
      '<div class="lead-top"><span class="dot ' + esc(o.calificacion || "") + '" title="' + esc(o.calificacion || "sin calificar") + '"></span>' +
      '<span class="lead-name">' + esc(c.nombre || "Sin nombre") + "</span>" + (opts.sinEtapa ? "" : badgeEtapa(o)) + "</div>" +
      '<div class="lead-sub"><span>' + esc(proyTxt(o.proyecto)) + (o.unidad_interes ? " · " + esc(o.unidad_interes) : "") + "</span>" +
      "<span>" + esc(FUENTES[o.fuente] || o.fuente) + "</span><span>" + esc(hace(o.updated_at)) + "</span>" +
      (opts.asesor ? "<span>" + esc(nombreDe(o.asignado_a)) + "</span>" : "") + "</div>" +
      (acciones ? '<div class="lead-actions">' + acciones + "</div>" : "") + "</div>";
  }

  /* ---------------------------------------------------------------- Hoy */
  function vistaHoy(c) {
    var abiertas = S.ops.filter(abierta);
    var sin = abiertas.filter(function (o) { return !o.asignado_a; });
    var nuevos24 = S.ops.filter(function (o) { return Date.now() - ms(o.created_at) < 86400000; }).length;
    var tareas = S.tareas.slice(0, 40);
    var estancados = abiertas.filter(function (o) { return o.asignado_a && (esGestor() || esMia(o)) && diasSin(o.updated_at) >= 3; })
      .sort(function (a, b) { return ms(a.updated_at) - ms(b.updated_at); }).slice(0, 8);

    var h = '<div class="stats">' +
      '<div class="stat"><b>' + c.abiertas + "</b><span>Leads abiertos</span></div>" +
      '<div class="stat' + (c.sin ? " alert" : "") + '"><b>' + c.sin + "</b><span>Sin asignar</span></div>" +
      '<div class="stat' + (c.venc ? " alert" : "") + '"><b>' + c.venc + "</b><span>Tareas vencidas</span></div>" +
      '<div class="stat good"><b>' + nuevos24 + "</b><span>Nuevos en 24 h</span></div></div>";

    if (sin.length) {
      h += '<div class="sec"><h2>Sin asignar (' + sin.length + ")</h2></div><div class=\"list\">" +
        sin.slice(0, 15).map(function (o) { return cardLead(o); }).join("") + "</div>";
    }
    h += '<div class="sec"><h2>' + (esGestor() ? "Tareas pendientes" : "Mis tareas") + "</h2></div>";
    if (!tareas.length) h += '<div class="empty">No tienes tareas pendientes. Abre un lead para crear una.</div>';
    else h += '<div class="list">' + tareas.map(function (t) {
      var op = opPorId(t.oportunidad_id), cu = cuando(t.vence_at);
      return '<div class="card task' + (cu.vencida ? " vencida" : "") + '">' +
        '<input type="checkbox" aria-label="Marcar como hecha" data-action="tarea-hecha" data-id="' + esc(t.id) + '">' +
        '<div class="task-body" data-action="abrir" data-id="' + esc(t.oportunidad_id) + '"><b>' + esc(t.contenido) + "</b>" +
        '<small class="cuando">' + esc(cu.txt) + "</small> <small>· " + esc(op && op.contacto ? op.contacto.nombre : "") + "</small></div></div>";
    }).join("") + "</div>";

    if (estancados.length) {
      h += '<div class="sec"><h2>Sin movimiento (3+ días)</h2></div><div class="list">' +
        estancados.map(function (o) { return cardLead(o, { asesor: esGestor() }); }).join("") + "</div>";
    }
    if (!S.ops.length) h += '<div class="empty" style="margin-top:14px">Aún no hay leads. Los del formulario web aparecerán aquí solos' + (puedeEscribir() ? ", o crea uno con el botón +" : "") + ".</div>";
    return h;
  }

  /* -------------------------------------------------------------- Embudo */
  function filtrar() {
    var q = S.f.q.trim().toLowerCase();
    return S.ops.filter(function (o) {
      var c = o.contacto || {};
      if (S.f.proyecto && (o.proyecto || "") !== S.f.proyecto) return false;
      if (S.f.quien === "mios" && !esMia(o)) return false;
      if (S.f.quien === "sin" && o.asignado_a) return false;
      if (q) {
        var blob = [c.nombre, c.telefono, c.correo, o.unidad_interes, proyTxt(o.proyecto)].join(" ").toLowerCase();
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
  }
  function vistaEmbudo() {
    var proys = {};
    Object.keys(PROYECTOS).forEach(function (k) { proys[k] = PROYECTOS[k]; });
    S.ops.forEach(function (o) { if (o.proyecto && !proys[o.proyecto]) proys[o.proyecto] = o.proyecto; });
    var lista = filtrar();
    var h = '<div class="filters"><input class="inp" type="search" id="f-q" placeholder="Buscar nombre, teléfono, proyecto…" value="' + esc(S.f.q) + '" aria-label="Buscar">' +
      '<select class="inp" id="f-proyecto" aria-label="Proyecto"><option value="">Todos los proyectos</option>' +
      Object.keys(proys).map(function (k) { return '<option value="' + esc(k) + '"' + (S.f.proyecto === k ? " selected" : "") + ">" + esc(proys[k]) + "</option>"; }).join("") + "</select>" +
      '<select class="inp" id="f-quien" aria-label="Responsable">' +
      [["todos", "Todos"], ["mios", "Solo míos"], ["sin", "Sin asignar"]].map(function (p) { return '<option value="' + p[0] + '"' + (S.f.quien === p[0] ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></div>";
    if (S.f.q.trim()) {
      h += '<div class="sec"><h2>Resultados (' + lista.length + ")</h2></div>" +
        (lista.length ? '<div class="list">' + lista.slice(0, 50).map(function (o) { return cardLead(o, { asesor: esGestor() }); }).join("") + "</div>" : '<div class="empty">Nada coincide con tu búsqueda.</div>');
      return h;
    }
    h += '<div class="jump">' + ETAPAS.map(function (e) {
      return '<button data-action="ir-col" data-e="' + e.id + '">' + esc(e.t) + "<b>" + lista.filter(function (o) { return o.etapa === e.id; }).length + "</b></button>";
    }).join("") + "</div>";
    h += '<div class="board">' + ETAPAS.map(function (e) {
      var items = lista.filter(function (o) { return o.etapa === e.id; });
      var total = items.length;
      if (CERRADAS.indexOf(e.id) !== -1) items = items.slice(0, 25);
      return '<section class="col" id="col-' + e.id + '" aria-label="' + esc(e.t) + '"><div class="col-head"><span>' + esc(e.t) + '</span><span class="n">' + total + "</span></div>" +
        (items.length ? items.map(function (o) { return cardLead(o, { sinEtapa: true, avanzar: true, asesor: esGestor() }); }).join("") : '<div class="col-empty">Sin leads</div>') +
        (total > items.length ? '<div class="col-empty">+' + (total - items.length) + " más (usa la búsqueda)</div>" : "") + "</section>";
    }).join("") + "</div>";
    return h;
  }

  /* ----------------------------------------------------------- Asistente */
  var SUGERENCIAS = [
    "¿A quién debo llamar hoy?", "¿Qué leads calientes llevan días sin seguimiento?",
    "Resume cómo va mi embudo esta semana", "¿Qué leads de Arcus están más cerca de cerrar?"
  ];
  function vistaIA() {
    var h = '<div class="chat">';
    if (!S.chat.length) {
      h += '<div class="card"><h3>' + icon("sparkle", "icon-sm") + " Pregúntale a tu embudo</h3>" +
        '<p class="muted" style="margin:0 0 10px">Responde solo con los leads que tú puedes ver. Prueba con:</p>' +
        '<div class="suggest">' + SUGERENCIAS.map(function (s) { return '<button data-action="sugerencia" data-q="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div></div>";
    }
    S.chat.forEach(function (m) {
      h += '<div class="msg ' + m.de + '">' + esc(m.txt);
      if (m.ops && m.ops.length) {
        h += '<div class="links">' + m.ops.map(function (id) { var o = opPorId(id); return o ? cardLead(o, { asesor: esGestor() }) : ""; }).join("") + "</div>";
      }
      h += "</div>";
    });
    if (S.iaOcupada) h += '<div class="msg ia"><span class="typing"><i></i><i></i><i></i></span></div>';
    h += "</div>" +
      '<form class="composer" id="ia-form"><textarea class="inp" id="ia-input" rows="1" placeholder="Escribe tu pregunta…" aria-label="Pregunta"></textarea>' +
      '<button type="button" class="icon-btn mic" id="ia-mic" data-action="dictar" data-target="ia-input" aria-label="Dictar">' + icon("mic") + "</button>" +
      '<button class="btn btn-primary" type="submit"' + (S.iaOcupada ? " disabled" : "") + ' aria-label="Enviar">' + icon("send") + "</button></form>";
    return h;
  }
  async function preguntar(q) {
    q = (q || "").trim();
    if (!q || S.iaOcupada) return;
    S.chat.push({ de: "yo", txt: q });
    S.iaOcupada = true; render();
    try {
      var r = await llamarIA({ accion: "consulta", pregunta: q });
      S.chat.push({ de: "ia", txt: r.respuesta, ops: r.oportunidades });
    } catch (e) {
      S.chat.push({ de: "ia", txt: "⚠ " + mensajeError(e) });
    }
    S.iaOcupada = false; render();
    window.scrollTo(0, document.body.scrollHeight);
  }

  /* ------------------------------------------------------------- Métricas */
  async function cargarMetricas() {
    try {
      var r = await sb.rpc("crm_metricas", { p_dias: S.metDias });
      if (r.error) throw r.error;
      S.metricas = r.data;
      if (S.vista === "metricas") render();
    } catch (e) { toast(mensajeError(e), true); }
  }
  function vistaMetricas() {
    var m = S.metricas;
    var h = '<div class="row" style="margin-bottom:10px"><div class="seg" style="flex:1">' +
      [7, 30, 90].map(function (d) { return '<button data-action="periodo" data-d="' + d + '" class="' + (S.metDias === d ? "on" : "") + '">' + d + " días</button>"; }).join("") + "</div></div>";
    if (!m) return h + '<div class="empty"><span class="spin dark"></span></div>';
    var conv = m.nuevos ? Math.round((m.vendidos / m.nuevos) * 100) : 0;
    h += '<div class="stats">' +
      '<div class="stat"><b>' + m.nuevos + "</b><span>Leads nuevos</span></div>" +
      '<div class="stat good"><b>' + m.vendidos + "</b><span>Vendidos</span></div>" +
      '<div class="stat"><b>' + conv + "%</b><span>Conversión lead → venta</span></div>" +
      '<div class="stat"><b>' + m.perdidos + "</b><span>Perdidos</span></div>" +
      '<div class="stat"><b>' + m.abiertas + "</b><span>Abiertos ahora</span></div>" +
      '<div class="stat' + (m.sin_asignar ? " alert" : "") + '"><b>' + m.sin_asignar + "</b><span>Sin asignar</span></div>" +
      '<div class="stat' + (m.tareas_vencidas ? " alert" : "") + '"><b>' + m.tareas_vencidas + "</b><span>Tareas vencidas</span></div></div>";
    var max = Math.max.apply(null, ETAPAS.map(function (e) { return m.por_etapa[e.id] || 0; }).concat([1]));
    h += '<div class="sec"><h2>Embudo actual</h2></div><div class="card bars">' + ETAPAS.map(function (e) {
      var n = m.por_etapa[e.id] || 0;
      return '<div class="bar"><span>' + esc(e.t) + '</span><div class="track"><div class="fill" style="width:' + Math.round((n / max) * 100) + '%"></div></div><b>' + n + "</b></div>";
    }).join("") + "</div>";
    if (m.por_fuente.length) {
      h += '<div class="sec"><h2>Por fuente (' + m.dias + ' días)</h2></div><div class="card"><table class="tbl"><thead><tr><th>Fuente</th><th>Leads</th><th>Ventas</th></tr></thead><tbody>' +
        m.por_fuente.map(function (f) { return "<tr><td>" + esc(FUENTES[f.fuente] || f.fuente) + "</td><td>" + f.leads + "</td><td>" + f.vendidos + "</td></tr>"; }).join("") + "</tbody></table></div>";
    }
    if (m.por_asesor.length && S.rol !== "asesor") {
      h += '<div class="sec"><h2>Por asesor</h2></div><div class="card"><table class="tbl"><thead><tr><th>Asesor</th><th>Abiertos</th><th>Ventas</th></tr></thead><tbody>' +
        m.por_asesor.map(function (a) { return "<tr><td>" + esc(nombreDe(a.email)) + "</td><td>" + a.abiertas + "</td><td>" + a.vendidos + "</td></tr>"; }).join("") + "</tbody></table></div>";
    }
    return h;
  }

  /* ------------------------------------------------------- Detalle del lead */
  async function abrirHoja(id) {
    var op = opPorId(id);
    if (!op) return;
    S.det = { op: op, contacto: op.contacto || {}, acts: [] };
    S.prop = null; S.modoAct = "nota";
    $("sheet").hidden = false;
    document.body.style.overflow = "hidden";
    try { history.pushState({ hoja: id }, ""); } catch (e) { /* sin historial */ }
    pintarHoja();
    cargarDetalle(id);
  }
  async function cargarDetalle(id, silencioso) {
    var r = await Promise.all([
      sb.from("crm_contactos").select("*").eq("id", S.det ? S.det.op.contacto_id : "").maybeSingle(),
      sb.from("crm_actividades").select("*").eq("oportunidad_id", id).order("created_at", { ascending: false }).limit(100)
    ]);
    if (!S.det || S.det.op.id !== id) return;
    if (r[0].data) S.det.contacto = r[0].data;
    S.det.acts = r[1].data || [];
    if (r[1].error && !silencioso) toast(mensajeError(r[1].error), true);
    pintarHoja();
  }
  function cerrarHoja(desdeHistorial) {
    if (!S.det) return;
    S.det = null; S.prop = null;
    $("sheet").hidden = true;
    document.body.style.overflow = "";
    if (!desdeHistorial && history.state && history.state.hoja) history.back();
    render();
  }

  function pintarHoja() {
    var d = S.det; if (!d) return;
    var o = d.op, c = d.contacto, gest = puedeGestionar(o);
    var tel = telHref(c), wa = waHref(c);
    var panel = $("sheet-panel"), scroll = panel.scrollTop, ss = snap(panel);
    var h = '<div class="sh-head"><div class="sh-bar"><button class="icon-btn" data-action="cerrar-hoja" aria-label="Volver">' + icon("left") + "</button>" +
      "<h2>" + esc(c.nombre || "Lead") + "</h2></div>" +
      '<div class="sh-sub">' + (c.telefono ? "<span>" + esc(c.telefono) + "</span>" : "") + (c.correo ? "<span>" + esc(c.correo) + "</span>" : "") +
      "<span>" + esc(proyTxt(o.proyecto)) + (o.unidad_interes ? " · " + esc(o.unidad_interes) : "") + "</span></div></div>";
    h += '<div class="sh-body">';

    // Contacto rápido
    h += '<div class="quick">' +
      (tel ? '<a class="btn" href="' + esc(tel) + '">' + icon("phone") + "Llamar</a>" : '<span class="btn" aria-disabled="true" style="opacity:.5">' + icon("phone") + "Sin teléfono</span>") +
      (wa ? '<a class="btn btn-wa" href="' + esc(wa) + '" target="_blank" rel="noopener" data-action="wa-directo">' + icon("chat") + "WhatsApp</a>" : '<span class="btn" aria-disabled="true" style="opacity:.5">' + icon("chat") + "Sin WhatsApp</span>") +
      (c.correo ? '<a class="btn" href="mailto:' + esc(c.correo) + '">' + icon("mail") + "Correo</a>" : '<span class="btn" aria-disabled="true" style="opacity:.5">' + icon("mail") + "Sin correo</span>") + "</div>";

    // Responsable
    h += '<div class="card"><div class="row" style="justify-content:space-between"><div><small class="muted">Responsable</small><br><b>' + esc(nombreDe(o.asignado_a)) + "</b></div>";
    if (esGestor()) {
      h += '<select class="inp" id="asignar" style="max-width:220px" aria-label="Asignar a"><option value="">Sin asignar</option>' +
        S.equipo.map(function (p) { return '<option value="' + esc(p.email) + '"' + (o.asignado_a === p.email ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("") + "</select>";
    } else if (!o.asignado_a && puedeEscribir() && abierta(o)) {
      h += '<button class="btn btn-primary btn-sm" data-action="tomar" data-id="' + esc(o.id) + '">Tomar lead</button>';
    }
    h += "</div></div>";

    // Etapa
    h += '<div><div class="stages" role="group" aria-label="Etapa">' + ETAPAS.map(function (e) {
      return '<button class="stg ' + e.id + (o.etapa === e.id ? " on" : "") + '" data-action="etapa" data-e="' + e.id + '"' + (gest ? "" : " disabled") + ">" + esc(e.t) + "</button>";
    }).join("") + "</div>" +
      (o.etapa === "perdido" && o.motivo_perdida ? '<small class="muted">Motivo: ' + esc(o.motivo_perdida) + "</small>" : "") + "</div>";

    // IA
    h += '<div class="card ia-card"><h3>' + icon("sparkle", "icon-sm") + " Asistente IA" +
      (o.calificacion ? ' <span class="chip ' + (o.calificacion === "caliente" ? "red" : o.calificacion === "tibio" ? "amber" : "") + '">' + esc(o.calificacion) + "</span>" : "") + "</h3>";
    if (o.ia_resumen) {
      h += "<p>" + esc(o.ia_resumen) + "</p>" + (o.calificacion_motivo ? '<p class="muted"><small>' + esc(o.calificacion_motivo) + "</small></p>" : "") +
        (o.ia_siguiente_accion ? '<div class="ia-next">➜ ' + esc(o.ia_siguiente_accion) + "</div>" : "") +
        '<p class="muted"><small>Actualizado ' + esc(hace(o.ia_actualizado_at)) + "</small></p>";
    } else h += '<p class="muted">Pídele un resumen, la calificación del lead y qué hacer a continuación.</p>';
    if (puedeEscribir()) h += '<div class="row" style="margin-top:8px"><button class="btn btn-sm" data-action="ia-resumen">' + (o.ia_resumen ? "Actualizar análisis" : "Analizar con IA") + "</button>" +
      '<button class="btn btn-sm" data-action="ia-mensaje">Redactar mensaje</button></div>';
    h += "</div>";

    // Nueva actividad
    if (gest) {
      h += '<div class="card"><h3>Registrar</h3><div class="seg" id="seg-act" style="margin-bottom:10px"><button class="' + (S.modoAct === "tarea" ? "" : "on") + '" data-action="modo-act" data-m="nota">Nota</button><button class="' + (S.modoAct === "tarea" ? "on" : "") + '" data-action="modo-act" data-m="tarea">Tarea</button></div>' +
        '<form class="form" id="form-nota" data-form="nota"' + (S.modoAct === "tarea" ? " hidden" : "") + '><select class="inp" name="tipo" aria-label="Tipo">' +
        ["nota", "llamada", "whatsapp", "correo", "visita"].map(function (t) { return '<option value="' + t + '">' + TIPOS[t][0] + "</option>"; }).join("") + "</select>" +
        '<textarea class="inp" id="nota-texto" name="texto" placeholder="¿Qué pasó? Escribe o dicta (🎤) y la IA lo ordena y crea los pendientes." required></textarea>' +
        '<div class="row"><button type="button" class="icon-btn mic" data-action="dictar" data-target="nota-texto" aria-label="Dictar">' + icon("mic") + "</button>" +
        '<button type="button" class="btn btn-sm" data-action="ia-nota">✦ Ordenar con IA</button><span style="flex:1"></span><button class="btn btn-primary btn-sm" type="submit">Guardar</button></div></form>' +
        '<form class="form" id="form-tarea" data-form="tarea"' + (S.modoAct === "tarea" ? "" : " hidden") + '><input class="inp" name="titulo" placeholder="Ej. Llamar para confirmar la cita" required>' +
        '<div class="form2"><input class="inp" type="date" name="fecha" value="' + fechaInput(1) + '" required aria-label="Fecha"><input class="inp" type="time" name="hora" value="09:00" aria-label="Hora"></div>' +
        '<div class="row end"><button class="btn btn-primary btn-sm" type="submit">Crear tarea</button></div></form>';
      if (S.prop) h += propuestaHtml(S.prop);
      h += "</div>";
    }

    // Datos
    h += '<details class="card"><summary><b>Datos del lead</b></summary>' + (gest ? formDatos(o, c) : '<p class="muted">Solo lectura para tu rol.</p>') + "</details>";

    // Línea de tiempo
    h += '<div class="card"><h3>Historial</h3><div class="tl">' + (d.acts.length ? d.acts.map(itemTl).join("") : '<p class="muted" style="margin:0">Sin actividad todavía.</p>') + "</div></div>";
    h += "</div>";
    panel.innerHTML = h;
    restore(panel, ss);
    panel.scrollTop = scroll;
  }

  function fechaInput(dias) {
    var d = new Date(); d.setDate(d.getDate() + dias);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function venceDe(dias) { return new Date(fechaInput(dias) + "T09:00:00").toISOString(); }

  function itemTl(a) {
    var t = TIPOS[a.tipo] || TIPOS.nota, sis = a.tipo === "cambio_etapa" || a.tipo === "sistema";
    var extra = "";
    if (a.tipo === "tarea") {
      var cu = cuando(a.vence_at);
      extra = a.hecha_at ? '<br><small>✔ Hecha ' + esc(hace(a.hecha_at)) + "</small>" :
        '<br><label><input type="checkbox" data-action="tarea-hecha" data-id="' + esc(a.id) + '"> <small' + (cu.vencida ? ' style="color:var(--fx-red-600);font-weight:700"' : "") + ">" + esc(cu.txt) + " · marcar hecha</small></label>";
    }
    return '<div class="tl-item' + (sis ? " sis" : "") + '"><div class="tl-ico" aria-hidden="true">' + t[1] + '</div><div class="tl-body"><p>' +
      (a.hecha_at ? "<s>" + esc(a.contenido) + "</s>" : esc(a.contenido)) + "</p><small>" + esc(t[0]) + " · " + esc(autorDe(a.creado_por)) + " · " + esc(hace(a.created_at)) + "</small>" + extra + "</div></div>";
  }

  function formDatos(o, c) {
    var proys = {}; Object.keys(PROYECTOS).forEach(function (k) { proys[k] = PROYECTOS[k]; });
    if (o.proyecto && !proys[o.proyecto]) proys[o.proyecto] = o.proyecto;
    return '<form class="form" id="form-datos" style="margin-top:10px">' +
      '<label class="fld"><span>Nombre</span><input name="nombre" value="' + esc(c.nombre) + '" required minlength="2" maxlength="120"></label>' +
      '<div class="form2"><label class="fld"><span>Teléfono</span><input name="telefono" type="tel" value="' + esc(c.telefono) + '"></label>' +
      '<label class="fld"><span>Correo</span><input name="correo" type="email" value="' + esc(c.correo) + '"></label></div>' +
      '<div class="form2"><label class="fld"><span>Proyecto</span><select name="proyecto"><option value="">—</option>' +
      Object.keys(proys).map(function (k) { return '<option value="' + esc(k) + '"' + (o.proyecto === k ? " selected" : "") + ">" + esc(proys[k]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span>Unidad de interés</span><input name="unidad_interes" value="' + esc(o.unidad_interes) + '" maxlength="120"></label></div>' +
      '<div class="form2"><label class="fld"><span>Fuente</span><select name="fuente">' +
      Object.keys(FUENTES).map(function (k) { return '<option value="' + k + '"' + (o.fuente === k ? " selected" : "") + ">" + esc(FUENTES[k]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span>Valor estimado (USD)</span><input name="valor_estimado" type="number" min="0" step="1" value="' + esc(o.valor_estimado == null ? "" : o.valor_estimado) + '"></label></div>' +
      '<label class="fld"><span>N.º de proforma (cotizador)</span><input name="proforma_numero" value="' + esc(o.proforma_numero) + '" placeholder="Ej. ARC-0007" maxlength="30"></label>' +
      '<div class="row end"><button class="btn btn-primary btn-sm" type="submit">Guardar datos</button></div></form>';
  }

  function propuestaHtml(p) {
    return '<div class="proposal" style="margin-top:12px"><b>✦ Propuesta de la IA — revísala antes de guardar</b>' +
      "<div><small class=\"muted\">" + esc(TIPOS[p.tipo][0]) + "</small><br>" + esc(p.nota) + "</div>" +
      (p.tareas.length ? "<div><small class=\"muted\">Tareas a crear</small><ul>" + p.tareas.map(function (t) { return "<li>" + esc(t.titulo) + " <small>(" + (t.dias === 0 ? "hoy" : t.dias === 1 ? "mañana" : "en " + t.dias + " días") + ")</small></li>"; }).join("") + "</ul></div>" : "") +
      (p.etapa_sugerida !== "ninguna" ? "<div><small class=\"muted\">Mover a etapa</small><br><b>" + esc(etapaTxt(p.etapa_sugerida)) + "</b>" + (p.motivo_perdida ? " · " + esc(p.motivo_perdida) : "") + "</div>" : "") +
      '<div class="row end"><button class="btn btn-sm" data-action="prop-descartar">Descartar</button><button class="btn btn-primary btn-sm" data-action="prop-guardar">Guardar todo</button></div></div>';
  }

  /* --------------------------------------------------------------- acciones */
  async function conBoton(btn, fn) {
    if (btn && btn.disabled) return;
    var txt = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin dark"></span>'; }
    try { return await fn(); }
    catch (e) { toast(mensajeError(e), true); }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = txt; } }
  }

  async function guardarActividad(tipo, contenido, vence) {
    var d = S.det;
    var r = await sb.from("crm_actividades").insert({
      oportunidad_id: d.op.id, contacto_id: d.op.contacto_id, tipo: tipo, contenido: contenido,
      vence_at: vence || null, creado_por: S.email
    });
    if (r.error) throw r.error;
  }

  async function cambiarEtapa(id, etapa, motivo) {
    var o = opPorId(id); if (!o || o.etapa === etapa) return;
    var antes = { etapa: o.etapa, motivo: o.motivo_perdida };
    o.etapa = etapa; if (motivo) o.motivo_perdida = motivo;
    render(); if (S.det) pintarHoja();
    try {
      await upd("crm_oportunidades", id, motivo ? { etapa: etapa, motivo_perdida: motivo } : { etapa: etapa });
      if (S.det && S.det.op.id === id) cargarDetalle(id, true);
      toast("Etapa: " + etapaTxt(etapa));
    } catch (e) {
      o.etapa = antes.etapa; o.motivo_perdida = antes.motivo;
      render(); if (S.det) pintarHoja();
      toast(mensajeError(e), true);
    }
  }

  function pedirMotivoPerdida(id) {
    abrirModal('<h2>¿Por qué se perdió?</h2><div class="form">' +
      '<select class="inp" id="mp-sel" aria-label="Motivo">' + MOTIVOS_PERDIDA.map(function (m) { return "<option>" + esc(m) + "</option>"; }).join("") + "</select>" +
      '<input class="inp" id="mp-txt" placeholder="Detalle (opcional)" maxlength="150"></div>' +
      '<div class="row end"><button class="btn" data-action="cerrar-modal">Cancelar</button><button class="btn btn-primary" data-action="perdido-ok" data-id="' + esc(id) + '">Marcar como perdido</button></div>');
  }

  /* ----------------------------------------------------------------- modales */
  function abrirModal(html) { $("modal-card").innerHTML = html; $("modal").hidden = false; var f = $("modal-card").querySelector("input,select,textarea"); if (f && window.innerWidth > 900) f.focus(); }
  function cerrarModal() { $("modal").hidden = true; $("modal-card").innerHTML = ""; }

  function abrirNuevo() {
    var proys = Object.keys(PROYECTOS).filter(function (k) { return k !== "home"; });
    abrirModal('<h2>Nuevo lead</h2><form class="form" id="form-nuevo">' +
      '<label class="fld"><span>Nombre *</span><input name="nombre" required minlength="2" maxlength="120" autocomplete="off"></label>' +
      '<div class="form2"><label class="fld"><span>Teléfono / WhatsApp</span><input name="telefono" type="tel" inputmode="tel" placeholder="09XXXXXXXX"></label>' +
      '<label class="fld"><span>Correo</span><input name="correo" type="email"></label></div>' +
      '<div class="form2"><label class="fld"><span>Proyecto</span><select name="proyecto"><option value="">—</option>' +
      proys.map(function (k) { return '<option value="' + k + '">' + esc(PROYECTOS[k]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span>Unidad de interés</span><input name="interes" maxlength="120" placeholder="Ej. Suite 102"></label></div>' +
      '<label class="fld"><span>¿De dónde llegó?</span><select name="fuente">' +
      Object.keys(FUENTES).map(function (k) { return '<option value="' + k + '"' + (k === "whatsapp" ? " selected" : "") + ">" + esc(FUENTES[k]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="fld"><span>Nota</span><textarea name="nota" maxlength="1000" placeholder="Lo que conversaron, presupuesto, urgencia…"></textarea></label>' +
      (esGestor() ? '<label class="fld"><span>Asignar a</span><select name="asignado"><option value="">Sin asignar</option>' +
        S.equipo.map(function (p) { return '<option value="' + esc(p.email) + '"' + (p.email === S.email ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("") + "</select></label>" : "") +
      '<div class="row end"><button type="button" class="btn" data-action="cerrar-modal">Cancelar</button><button class="btn btn-primary" type="submit">Crear lead</button></div></form>');
  }

  function abrirMensaje() {
    var c = S.det.contacto;
    abrirModal('<h2>Redactar mensaje con IA</h2><div class="form">' +
      '<div class="seg" id="seg-canal"><button class="on" data-action="canal" data-c="whatsapp">WhatsApp</button><button data-action="canal" data-c="correo"' + (c.correo ? "" : " disabled") + ">Correo</button></div>" +
      '<select class="inp" id="msg-obj" aria-label="Objetivo">' + Object.keys(OBJETIVOS).map(function (k) { return '<option value="' + k + '"' + (k === "seguimiento" ? " selected" : "") + ">" + esc(OBJETIVOS[k]) + "</option>"; }).join("") + "</select>" +
      '<button class="btn btn-primary" data-action="msg-generar">✦ Generar borrador</button>' +
      '<div id="msg-out" hidden class="form"><input class="inp" id="msg-asunto" placeholder="Asunto" hidden><textarea class="inp" id="msg-texto" rows="7"></textarea>' +
      '<div class="row end"><button class="btn btn-sm" data-action="msg-copiar">Copiar</button><button class="btn btn-wa btn-sm" data-action="msg-enviar" id="msg-enviar">Abrir WhatsApp</button></div></div>' +
      '<p class="muted" style="margin:0"><small>Revisa y ajusta el texto antes de enviarlo. La IA no conoce precios ni disponibilidad: confírmalos tú.</small></p></div>');
    abrirMensaje.canal = "whatsapp";
  }

  function abrirCuenta() {
    var rol = { editor: "Editor", administrador: "Administrador", marketing: "Marketing", asesor: "Asesor" }[S.rol] || S.rol;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    abrirModal('<h2>Mi cuenta</h2><div class="card"><b>' + esc(S.email) + "</b><br><small class=\"muted\">Rol: " + esc(rol) + "</small></div>" +
      (instalada ? "" : '<div class="card"><h3>Instalar en tu celular</h3>' + (instalarEvento ?
        '<p class="muted" style="margin:0 0 8px">Ábrelo como una app, a pantalla completa.</p><button class="btn btn-primary btn-block" data-action="instalar">Instalar FORXA CRM</button>' :
        '<p class="muted" style="margin:0">' + (ios ? "En Safari toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>." : "En el menú del navegador (⋮) elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.") + "</p>") + "</div>") +
      '<div class="row">' + (S.rol !== "asesor" ? '<a class="btn" href="/admin/">Panel</a>' : "") + '<a class="btn" href="/cotizador/">Cotizador</a></div>' +
      '<div class="row end"><button class="btn" data-action="cerrar-modal">Cerrar</button><button class="btn btn-primary" data-action="salir">Cerrar sesión</button></div>');
  }

  /* ----------------------------------------------------------------- dictado */
  var rec = null;
  function dictar(btn, targetId) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Tu navegador no dicta aquí. Usa el micrófono del teclado del celular.", true); return; }
    if (rec) { rec.stop(); return; }
    var ta = $(targetId); if (!ta) return;
    var base = ta.value ? ta.value.replace(/\s*$/, " ") : "";
    rec = new SR(); rec.lang = "es-EC"; rec.interimResults = true; rec.continuous = true;
    btn.classList.add("on");
    rec.onresult = function (ev) {
      var t = ""; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      ta.value = base + t;
    };
    rec.onerror = function (ev) { if (ev.error === "not-allowed") toast("Permite el micrófono para dictar.", true); };
    rec.onend = function () { btn.classList.remove("on"); rec = null; };
    rec.start();
  }

  /* --------------------------------------------------------------- PWA / SW */
  var instalarEvento = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); instalarEvento = e; });
  window.addEventListener("appinstalled", function () { instalarEvento = null; toast("FORXA CRM instalada"); });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/crm/sw.js", { scope: "/crm/" }).catch(function () {}); });
  }
  function estadoRed() { $("offline").hidden = online(); }
  window.addEventListener("online", function () { estadoRed(); if (S.user) cargar(true); });
  window.addEventListener("offline", estadoRed);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && S.user && online()) cargar(true); });
  window.addEventListener("popstate", function () { if (S.det && !(history.state && history.state.hoja)) cerrarHoja(true); });

  /* --------------------------------------------------- eventos (delegación) */
  var ACC = {
    "vista": function (el) { cambiarVista(el.dataset.v); },
    "abrir": function (el) { abrirHoja(el.dataset.id); },
    "cerrar-hoja": function () { cerrarHoja(); },
    "cerrar-modal": function () { cerrarModal(); },
    "sugerencia": function (el) { preguntar(el.dataset.q); },
    "ir-col": function (el) {
      var c = $("col-" + el.dataset.e); if (c) c.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    },
    "periodo": function (el) { S.metDias = +el.dataset.d; S.metricas = null; render(); },
    "tomar": function (el) {
      return conBoton(el, async function () {
        var r = await sb.rpc("crm_tomar_lead", { p_op: el.dataset.id }); if (r.error) throw r.error;
        var mio = opPorId(el.dataset.id); if (mio) mio.asignado_a = S.email;
        toast("Es tuyo. ¡A darle seguimiento!"); await cargar(true);
        if (!S.det || S.det.op.id !== el.dataset.id) abrirHoja(el.dataset.id); else cargarDetalle(el.dataset.id, true);
      });
    },
    "avanzar": function (el) {
      var o = opPorId(el.dataset.id); if (!o) return;
      var i = ETAPAS.map(function (e) { return e.id; }).indexOf(o.etapa);
      cambiarEtapa(o.id, ETAPAS[i + 1].id);
    },
    "etapa": function (el) {
      var id = S.det.op.id;
      if (el.dataset.e === "perdido") pedirMotivoPerdida(id); else cambiarEtapa(id, el.dataset.e);
    },
    "perdido-ok": function (el) {
      var motivo = $("mp-sel").value + ($("mp-txt").value.trim() ? " — " + $("mp-txt").value.trim() : "");
      cerrarModal(); cambiarEtapa(el.dataset.id, "perdido", motivo);
    },
    "tarea-hecha": function (el) {
      var id = el.dataset.id;
      return upd("crm_actividades", id, { hecha_at: new Date().toISOString() }).then(function () {
        S.tareas = S.tareas.filter(function (t) { return t.id !== id; });
        render(); if (S.det) cargarDetalle(S.det.op.id, true);
        toast("Tarea completada");
      }).catch(function (e) { el.checked = false; toast(mensajeError(e), true); });
    },
    "modo-act": function (el) {
      var m = el.dataset.m; S.modoAct = m;
      document.querySelectorAll("#seg-act button").forEach(function (b) { b.classList.toggle("on", b === el); });
      $("form-nota").hidden = m !== "nota"; $("form-tarea").hidden = m !== "tarea";
    },
    "dictar": function (el) { dictar(el, el.dataset.target); },
    "ia-resumen": function (el) {
      return conBoton(el, async function () {
        var r = await llamarIA({ accion: "resumen", oportunidad_id: S.det.op.id });
        var o = opPorId(S.det.op.id) || S.det.op;
        o.ia_resumen = r.resumen; o.ia_siguiente_accion = r.siguiente_accion; o.calificacion = r.calificacion;
        o.calificacion_motivo = r.motivo; o.ia_actualizado_at = r.ia_actualizado_at;
        S.det.op = o; pintarHoja(); render();
      });
    },
    "ia-nota": function (el) {
      var txt = $("nota-texto").value.trim();
      if (txt.length < 3) { toast("Escribe o dicta la nota primero", true); return; }
      return conBoton(el, async function () {
        var r = await llamarIA({ accion: "nota", oportunidad_id: S.det.op.id, texto: txt });
        S.prop = r; pintarHoja();
      });
    },
    "prop-descartar": function () { S.prop = null; pintarHoja(); },
    "prop-guardar": function (el) {
      var p = S.prop, id = S.det.op.id;
      return conBoton(el, async function () {
        await guardarActividad(p.tipo, p.nota);
        for (var i = 0; i < p.tareas.length; i++) await guardarActividad("tarea", p.tareas[i].titulo, venceDe(p.tareas[i].dias));
        S.prop = null;
        if (p.etapa_sugerida !== "ninguna") await cambiarEtapa(id, p.etapa_sugerida, p.motivo_perdida || undefined);
        await cargarDetalle(id, true); cargar(true);
        toast("Nota y pendientes guardados");
      });
    },
    "ia-mensaje": function () { abrirMensaje(); },
    "canal": function (el) {
      abrirMensaje.canal = el.dataset.c;
      document.querySelectorAll("#seg-canal button").forEach(function (b) { b.classList.toggle("on", b === el); });
      $("msg-asunto").hidden = el.dataset.c !== "correo";
      $("msg-enviar").textContent = el.dataset.c === "correo" ? "Abrir correo" : "Abrir WhatsApp";
      $("msg-enviar").className = "btn btn-sm " + (el.dataset.c === "correo" ? "btn-primary" : "btn-wa");
      $("msg-out").hidden = true;
    },
    "msg-generar": function (el) {
      return conBoton(el, async function () {
        var r = await llamarIA({ accion: "mensaje", oportunidad_id: S.det.op.id, canal: abrirMensaje.canal, objetivo: $("msg-obj").value });
        $("msg-out").hidden = false; $("msg-texto").value = r.mensaje; $("msg-asunto").value = r.asunto || "";
        $("msg-asunto").hidden = abrirMensaje.canal !== "correo";
      });
    },
    "msg-copiar": function () {
      var t = $("msg-texto").value;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("Copiado"); }, function () { $("msg-texto").select(); toast("Selecciona y copia el texto", true); });
    },
    "msg-enviar": function () {
      var t = $("msg-texto").value.trim(), c = S.det.contacto, correo = abrirMensaje.canal === "correo";
      if (!t) return;
      var url = correo ? "mailto:" + encodeURIComponent(c.correo || "") + "?subject=" + encodeURIComponent($("msg-asunto").value) + "&body=" + encodeURIComponent(t) : waHref(c, t);
      if (!url) { toast("Este contacto no tiene " + (correo ? "correo" : "teléfono"), true); return; }
      window.open(url, correo ? "_self" : "_blank", "noopener");
      guardarActividad(correo ? "correo" : "whatsapp", "Mensaje enviado: " + t).then(function () { cargarDetalle(S.det.op.id, true); }).catch(function () {});
      cerrarModal();
    },
    "instalar": function () {
      if (!instalarEvento) return;
      instalarEvento.prompt(); instalarEvento.userChoice.finally(function () { instalarEvento = null; cerrarModal(); });
    },
    "salir": async function () { await sb.auth.signOut(); location.reload(); }
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest("a[href]") && !e.target.closest("a[data-action]")) return;
    var el = e.target.closest("[data-action]");
    if (!el || !ACC[el.dataset.action]) return;
    if (el.tagName === "BUTTON" && el.type !== "submit") e.preventDefault();
    ACC[el.dataset.action](el, e);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-action]')) { e.preventDefault(); ACC[e.target.dataset.action](e.target, e); }
    if (e.key === "Escape") { if (!$("modal").hidden) cerrarModal(); else if (S.det) cerrarHoja(); }
    if (e.key === "Enter" && !e.shiftKey && e.target.id === "ia-input") { e.preventDefault(); $("ia-form").requestSubmit(); }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "f-proyecto") { S.f.proyecto = t.value; render(); }
    else if (t.id === "f-quien") { S.f.quien = t.value; render(); }
    else if (t.id === "asignar") {
      var id = S.det.op.id;
      sb.rpc("crm_asignar", { p_op: id, p_email: t.value }).then(function (r) {
        if (r.error) throw r.error;
        var o = opPorId(id); if (o) o.asignado_a = t.value || null;
        S.det.op.asignado_a = t.value || null; toast("Responsable actualizado"); pintarHoja(); render(); cargarDetalle(id, true);
      }).catch(function (er) { toast(mensajeError(er), true); pintarHoja(); });
    }
  });
  var busqueda;
  document.addEventListener("input", function (e) {
    if (e.target.id === "f-q") {
      S.f.q = e.target.value; clearTimeout(busqueda);
      busqueda = setTimeout(render, 200);
    }
    if (e.target.id === "ia-input") { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }
  });

  document.addEventListener("submit", async function (e) {
    var f = e.target; e.preventDefault();
    var btn = f.querySelector('button[type="submit"]');
    var fd = Object.fromEntries(new FormData(f).entries());
    if (f.id === "login-form") return login();
    if (f.id === "ia-form") { var q = $("ia-input").value; $("ia-input").value = ""; return preguntar(q); }
    if (f.id === "form-nuevo") {
      return conBoton(btn, async function () {
        var r = await sb.rpc("crm_crear_lead", {
          p_nombre: fd.nombre, p_telefono: fd.telefono || null, p_correo: fd.correo || null, p_proyecto: fd.proyecto || null,
          p_interes: fd.interes || null, p_nota: fd.nota || null, p_fuente: fd.fuente || "otro", p_asignado: fd.asignado || null
        });
        if (r.error) throw r.error;
        cerrarModal(); await cargar(true); toast(r.data && r.data.nuevo ? "Lead creado" : "Ese cliente ya existía: se actualizó su ficha");
        if (r.data && r.data.oportunidad_id) abrirHoja(r.data.oportunidad_id);
      });
    }
    if (!S.det) return;
    if (f.id === "form-nota") {
      return conBoton(btn, async function () {
        await guardarActividad(fd.tipo, fd.texto.trim()); f.reset(); S.prop = null;
        await cargarDetalle(S.det.op.id, true); toast("Guardado");
      });
    }
    if (f.id === "form-tarea") {
      return conBoton(btn, async function () {
        await guardarActividad("tarea", fd.titulo.trim(), new Date(fd.fecha + "T" + (fd.hora || "09:00") + ":00").toISOString());
        await cargarDetalle(S.det.op.id, true); cargar(true); toast("Tarea creada");
      });
    }
    if (f.id === "form-datos") {
      return conBoton(btn, async function () {
        var o = S.det.op;
        await upd("crm_contactos", o.contacto_id, { nombre: fd.nombre.trim(), telefono: fd.telefono.trim() || null, correo: fd.correo.trim().toLowerCase() || null });
        await upd("crm_oportunidades", o.id, {
          proyecto: fd.proyecto || null, unidad_interes: fd.unidad_interes.trim() || null, fuente: fd.fuente,
          valor_estimado: fd.valor_estimado === "" ? null : Number(fd.valor_estimado), proforma_numero: fd.proforma_numero.trim() || null
        });
        await cargar(true); await cargarDetalle(o.id, true); toast("Datos guardados");
      });
    }
  });

  async function login() {
    loginMsg("login-error", ""); loginMsg("login-info", "");
    var btn = $("login-btn"); btn.disabled = true; btn.textContent = "Entrando…";
    try {
      var r = await sb.auth.signInWithPassword({ email: $("login-email").value.trim(), password: $("login-password").value });
      if (r.error) throw r.error;
      await entrar(r.data.user);
    } catch (e) {
      loginMsg("login-error", /invalid/i.test(e.message || "") ? "Correo o contraseña incorrectos." : mensajeError(e));
    } finally { btn.disabled = false; btn.textContent = "Entrar"; }
  }
  $("forgot-btn").addEventListener("click", async function () {
    var email = $("login-email").value.trim();
    if (!email) { loginMsg("login-error", "Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña»."); return; }
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/admin/" });
    if (r.error) loginMsg("login-error", mensajeError(r.error));
    else { loginMsg("login-error", ""); loginMsg("login-info", "Si el correo existe, te enviamos un enlace para crear una nueva contraseña."); }
  });
  $("btn-refresh").addEventListener("click", function () { cargar(false).then(function () { if (S.vista === "metricas") { S.metricas = null; render(); } toast("Actualizado"); }); });
  $("btn-menu").addEventListener("click", abrirCuenta);
  $("fab").addEventListener("click", abrirNuevo);

  /* ------------------------------------------------------------------ inicio */
  (async function () {
    estadoRed();
    try {
      var s = (await sb.auth.getSession()).data.session;
      if (s) await entrar(s.user); else mostrar("login");
    } catch (e) { mostrar("login"); loginMsg("login-error", mensajeError(e)); }
  })();
})();
