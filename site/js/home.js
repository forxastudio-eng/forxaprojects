/* FORXA · Landing principal: proyectos desde Supabase (tabla "projects").
   Si Supabase aún no está configurado, muestra la lista base de respaldo para
   que el sitio nunca quede vacío. */
(function () {
  "use strict";

  var CFG = window.FORXA_CONFIG || {};
  var FALLBACK = [
    { name: "Álabes", url: "/alabes/", tagline: "Suites, departamentos y locales comerciales en la calle del Batán.", cover_url: "/assets/covers/alabes.jpg", ubicacion: "Cuenca", tipo: "Suites y locales" },
    { name: "Arcus Suites & Lofts", url: "/arcus/", tagline: "Suites, lofts y espacios comerciales sobre la Remigio Tamariz Crespo.", cover_url: "/assets/covers/arcus.jpg", ubicacion: "Cuenca", tipo: "Suites, lofts y locales" },
    { name: "Portón del Valle", url: "/porton/", tagline: "Lotes y desarrollo residencial en el valle de Yunguilla.", cover_url: "/assets/covers/porton-del-valle.jpg", ubicacion: "Yunguilla", tipo: "Lotes" },
    { name: "AURA", url: "https://www.kapitalf.com/", tagline: "Edificio residencial Ordóñez Lasso.", cover_url: "/assets/covers/aura.jpg", ubicacion: "Cuenca", tipo: "Departamentos" }
  ];

  var grid = document.getElementById("grid");
  var filtersEl = document.getElementById("filters");
  var projects = [];
  var activeFilter = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isExternal(url) { return /^https?:\/\//i.test(url || ""); }
  function coverSrc(u) {
    if (!u) return "";
    var abs = (isExternal(u) || u.charAt(0) === "/") ? u : "/" + u;
    // portadas del repo: variante WebP de 640 px (existe junto a cada .jpg)
    return /^\/assets\/covers\/[\w-]+\.jpg$/.test(abs) ? abs.replace(/\.jpg$/, "-640.webp") : abs;
  }
  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join("");
  }

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  function render() {
    var list = projects.filter(function (p) { return !activeFilter || p.ubicacion === activeFilter; });
    if (!list.length) {
      grid.innerHTML = '<div class="state">No hay proyectos publicados en esta ubicación por ahora.</div>';
      return;
    }
    grid.innerHTML = list.map(function (p) {
      var ext = isExternal(p.url);
      var media = p.cover_url
        ? '<img src="' + esc(coverSrc(p.cover_url)) + '" alt="" loading="lazy" width="800" height="600">'
        : '<div class="ph">' + esc(initials(p.name)) + "</div>";
      var chips = [p.ubicacion ? '<span class="chip">' + esc(p.ubicacion) + "</span>" : "",
                   p.tipo ? '<span class="chip chip-muted">' + esc(p.tipo) + "</span>" : "", stockChip(p)].join("");
      return '<a class="card" href="' + esc(p.url) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" +
        '<div class="card-media">' + media + "</div>" +
        '<div class="card-body">' +
          "<h3>" + esc(p.name) + "</h3>" +
          (p.tagline ? '<p class="card-tagline">' + esc(p.tagline) + "</p>" : "") +
          (chips ? '<div class="card-meta">' + chips + "</div>" : "") +
          '<span class="card-cta">' + (ext ? "Visitar sitio" : "Ver proyecto") + ARROW + "</span>" +
        "</div></a>";
    }).join("");
  }

  function renderFilters() {
    var places = projects.map(function (p) { return p.ubicacion; }).filter(Boolean);
    places = places.filter(function (v, i) { return places.indexOf(v) === i; });
    if (places.length < 2) { filtersEl.innerHTML = ""; return; }
    var opts = [""].concat(places);
    filtersEl.innerHTML = opts.map(function (v) {
      return '<button type="button" data-v="' + esc(v) + '" aria-pressed="' + (v === activeFilter) + '">' + (v ? esc(v) : "Todos") + "</button>";
    }).join("");
    filtersEl.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        activeFilter = b.getAttribute("data-v");
        renderFilters();
        render();
      });
    });
  }

  function fillContactSelect() {
    var sel = document.getElementById("c-proyecto");
    projects.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.name; o.textContent = p.name;
      sel.appendChild(o);
    });
  }

  // Disponibilidad en vivo: mismas tablas (y estados) que ya sincronizan panel y cotizador.
  var STOCK = { "/alabes/": "units", "/arcus/": "arcus_units", "/porton/": "lots" };
  var stock = {};
  function money(n) { return "$" + Math.round(n).toLocaleString("es-EC"); }
  function stockChip(p) {
    var st = stock[p.url]; if (!st) return "";
    var label = st.disp === 0 ? "Agotado" : (st.disp <= 10 ? "Quedan " + st.disp : st.disp + " disponibles");
    return '<span class="chip chip-stock' + (st.disp <= 10 ? " is-low" : "") + '">' + label + "</span>" +
      (st.desde ? '<span class="chip chip-muted">Desde ' + money(st.desde) + "</span>" : "");
  }
  function loadStock(sb) {
    return Promise.all(Object.keys(STOCK).map(function (url) {
      var t = STOCK[url];
      return sb.from(t).select(t === "lots" ? "status,price" : "status").then(function (r) {
        if (r.error || !r.data) return;
        var disp = r.data.filter(function (u) { return u.status === "disponible"; });
        var precios = disp.map(function (u) { return +u.price; }).filter(function (n) { return n > 0; });
        stock[url] = { disp: disp.length, desde: precios.length ? Math.min.apply(null, precios) : 0 };
      });
    })).catch(function () { /* sin cifras: las tarjetas se muestran igual */ });
  }

  // Primera pantalla: fotos reales de los proyectos en lugar del isotipo.
  function renderHeroShots() {
    var mark = document.querySelector(".hero-mark");
    var con = projects.filter(function (p) { return p.cover_url; }).slice(0, 3);
    if (!mark || con.length < 2) return;
    mark.removeAttribute("aria-hidden");
    mark.classList.add("hero-shots");
    mark.innerHTML = con.map(function (p, i) {
      var ext = isExternal(p.url);
      return '<a class="shot shot-' + i + '" href="' + esc(p.url) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" +
        '<img src="' + esc(coverSrc(p.cover_url)) + '" alt="" width="800" height="600"' + (i ? ' loading="lazy"' : ' fetchpriority="high"') + ">" +
        '<span class="shot-cap"><strong>' + esc(p.name) + "</strong>" + (p.ubicacion ? "<small>" + esc(p.ubicacion) + "</small>" : "") + stockChip(p) + "</span></a>";
    }).join("");
  }

  function done(list) {
    projects = list;
    renderFilters();
    render();
    renderHeroShots();
    fillContactSelect();
  }

  var configured = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.indexOf("PEGA_AQUI") === -1 && window.supabase;
  if (!configured) {
    done(FALLBACK);
  } else {
    var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    sb.from("projects").select("*").eq("visible", true).order("sort_order", { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        var list = res.data && res.data.length ? res.data : FALLBACK;
        return loadStock(sb).then(function () { done(list); });
      })
      .catch(function (err) {
        console.warn("No se pudieron cargar los proyectos; uso la lista base.", err);
        done(FALLBACK);
      });
  }

  /* Formulario → WhatsApp */
  var WA = CFG.WHATSAPP || "593939087030";
  document.getElementById("contact-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var nombre = document.getElementById("c-nombre").value.trim();
    var proyecto = document.getElementById("c-proyecto").value;
    var mensaje = document.getElementById("c-mensaje").value.trim();
    var err = document.getElementById("c-error");
    var telefono = document.getElementById("c-telefono").value.trim();
    if (!nombre) { err.textContent = "Escribe tu nombre para continuar."; document.getElementById("c-nombre").focus(); return; }
    if (telefono.replace(/\D/g, "").length < 7) { err.textContent = "Escribe tu teléfono para que podamos responderte."; document.getElementById("c-telefono").focus(); return; }
    err.textContent = "";
    if (window.FORXA_LEAD) FORXA_LEAD.send(e.target, { proyecto: "home", nombre: nombre, telefono: telefono, interes: proyecto, mensaje: mensaje });
    var text = "Hola FORXA, soy " + nombre + ". Mi teléfono: " + telefono + "." +
      (proyecto ? " Me interesa " + proyecto + "." : "") +
      (mensaje ? " " + mensaje : "");
    window.open("https://wa.me/" + ((window.CMS && CMS.whatsapp()) || WA) + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  });

  /* Header con borde al hacer scroll */
  var top = document.getElementById("top");
  function onScroll() { top.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.getElementById("year").textContent = new Date().getFullYear();
})();
