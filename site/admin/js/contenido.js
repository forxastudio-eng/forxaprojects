/* FORXA · Panel — editor de contenido de las landings.
   Lee la propia página pública (sus atributos data-cms*), arma el formulario
   de cada sección y guarda los cambios en la tabla "site_content". El motor
   que los muestra a los visitantes es /js/cms.js.

   Qué se guarda: solo lo que difiere del contenido original de la página.
   Volver al original = borrar la fila ("Restablecer"). */
(function () {
  "use strict";
  var sb = FX.sb, icon = FX.icon;

  /* Páginas editables. url: dónde vive en el sitio. */
  var SITIOS = {
    home:      { label: "Landing principal", url: "/",         desc: "La portada de FORXA con todos los proyectos." },
    arcus:     { label: "Arcus Suites & Lofts", url: "/arcus/", desc: "Landing del proyecto Arcus." },
    alabes:    { label: "Álabes", url: "/alabes/",             desc: "Landing del proyecto Álabes." },
    porton:    { label: "Portón del Valle", url: "/porton/",   desc: "Landing del proyecto Portón del Valle." },
    privacidad:{ label: "Política de privacidad", url: "/privacidad/", desc: "Texto legal sobre el tratamiento de datos personales." },
    cookies:   { label: "Política de cookies", url: "/cookies/",       desc: "Texto legal sobre el uso de cookies y almacenamiento local." }
  };

  /* ------------------------------------------------------------ utilidades */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }
  function eq(a, b) { return stable(a) === stable(b); }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function resolve(url, base) { return FX.resolveImg(url, base); }

  /* Reduce fotos grandes antes de subirlas (JPEG/WebP): máx. 2200 px de ancho. */
  function optimizeImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|webp)$/.test(file.type) || file.size < 400 * 1024) return resolve(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var max = 2200, w = img.naturalWidth, hh = img.naturalHeight;
        if (w <= max && file.size < 1.5 * 1024 * 1024) return resolve(file);
        var sc = Math.min(1, max / w), c = document.createElement("canvas");
        c.width = Math.round(w * sc); c.height = Math.round(hh * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function pickFiles(accept, multiple) {
    return new Promise(function (resolve) {
      var i = h("input", { type: "file", accept: accept, multiple: multiple ? "" : false, style: "position:fixed;left:-9999px" });
      i.addEventListener("change", function () { var f = Array.prototype.slice.call(i.files || []); i.remove(); resolve(f); });
      i.addEventListener("cancel", function () { i.remove(); resolve([]); });
      document.body.appendChild(i); i.click();
    });
  }

  /* ------------------------------------------------- lectura de la página */
  var SEL = "[data-cms],[data-cms-html],[data-cms-img],[data-cms-href],[data-cms-attr],[data-cms-icon]";

  function fieldsOf(el, rel) {
    var out = [], k, lab = el.getAttribute("data-cms-label") || "";
    if ((k = el.getAttribute("data-cms"))) {
      out.push({ kind: "text", key: k, label: lab || "Texto", type: (el.getAttribute("data-cms-type") === "textarea" && (/^(P|BLOCKQUOTE)$/.test(el.tagName) || norm(el.textContent).length > 60)) ? "textarea" : "text", def: norm(el.textContent) });
    }
    if ((k = el.getAttribute("data-cms-html"))) {
      out.push({ kind: "html", key: k, label: lab || "Texto", type: "html", def: el.innerHTML.trim() });
    }
    if ((k = el.getAttribute("data-cms-img"))) {
      out.push({ kind: "img", key: k, label: lab || "Imagen", type: "image", altKey: k + "@alt", def: el.getAttribute("src") || "", defAlt: el.getAttribute("alt") || "",
        contain: /logo|brand/i.test(lab) });
    }
    if ((k = el.getAttribute("data-cms-href"))) {
      out.push({ kind: "link", key: k, label: (lab ? lab + " · " : "") + "Enlace de destino", type: "link", def: el.getAttribute("href") || "" });
    }
    if ((k = el.getAttribute("data-cms-icon"))) {
      out.push({ kind: "icon", key: k, label: lab || "Ícono", type: "icon", def: (el.getAttribute("href") || "").replace(/^#/, "") });
    }
    if ((k = el.getAttribute("data-cms-attr"))) {
      var t = el.getAttribute("data-cms-type") || "text";
      k.split(",").forEach(function (pair) {
        var i = pair.indexOf(":"); if (i < 1) return;
        var name = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
        out.push({ kind: "attr", key: key, label: lab || name, type: t === "image" ? "image-url" : t, def: el.getAttribute(name) || "" });
      });
    }
    return out;
  }

  function readSchema(doc) {
    var spriteEl = doc.querySelector('svg[style*="display:none"]');
    var groups = [], wa = null, seen = {};

    function dedupe(f) { if (seen[f.key]) return false; seen[f.key] = 1; return true; }

    function readList(c) {
      var key = c.getAttribute("data-cms-list"), rep = parseInt(c.getAttribute("data-cms-repeat"), 10) || 1;
      var opts = (c.getAttribute("data-cms-cls") || "").split(",").map(function (s) { var p = s.split(":"); return p[0].trim() ? { v: p[0].trim(), l: (p[1] || p[0]).trim() } : null; }).filter(Boolean);
      var kids = Array.prototype.slice.call(c.children);
      var uniq = kids.slice(0, Math.ceil(kids.length / rep));
      function scopeFields(node) {
        var all = [], q = Array.prototype.slice.call(node.querySelectorAll(SEL));
        if (node.matches(SEL)) q.unshift(node);
        q.forEach(function (n) { all = all.concat(fieldsOf(n, true)); });
        return all;
      }
      var fields = uniq.length ? scopeFields(uniq[0]) : [];
      var items = uniq.map(function (node) {
        var entry = {};
        scopeFields(node).forEach(function (f) {
          if (f.kind === "img") { entry[f.key] = f.def; entry[f.altKey] = f.defAlt; } else entry[f.key] = f.def;
        });
        if (opts.length) entry._cls = opts.filter(function (o) { return node.classList.contains(o.v); }).map(function (o) { return o.v; });
        return entry;
      });
      return { kind: "list", key: key, label: c.getAttribute("data-cms-label") || "Lista", noun: c.getAttribute("data-cms-noun") || "Elemento", fields: fields, opts: opts, def: items };
    }

    function walk(el, group) {
      Array.prototype.slice.call(el.children).forEach(function (ch) {
        if (ch.hasAttribute("data-cms-list")) { group.items.push(readList(ch)); return; }
        if (ch.hasAttribute("data-cms-wa") && !wa) {
          var m = /^https?:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/i.exec(ch.getAttribute("href") || "");
          if (m) { var msg = ""; try { msg = decodeURIComponent(m[2] || ""); } catch (e) {} wa = { num: m[1], msg: msg }; }
        }
        fieldsOf(ch).forEach(function (f) { if (dedupe(f)) group.items.push(f); });
        walk(ch, group);
      });
    }

    // grupos del <body>
    var order = 0;
    Array.prototype.slice.call(doc.querySelectorAll("body [data-cms-group]")).forEach(function (g) {
      var group = { id: "g" + (order++), label: g.getAttribute("data-cms-group"), showKey: g.getAttribute("data-cms-show"), items: [] };
      var self = fieldsOf(g); self.forEach(function (f) { if (dedupe(f)) group.items.push(f); });
      walk(g, group);
      groups.push(group);
    });
    // fuera de grupos (botón flotante de WhatsApp, etc.): solo se necesita el enlace de WhatsApp
    Array.prototype.slice.call(doc.querySelectorAll("body [data-cms-wa]")).forEach(function (a) {
      if (wa) return;
      var m = /^https?:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/i.exec(a.getAttribute("href") || "");
      if (m) { var msg = ""; try { msg = decodeURIComponent(m[2] || ""); } catch (e) {} wa = { num: m[1], msg: msg }; }
    });
    // <head>
    var head = { id: "seo", label: (doc.head.getAttribute("data-cms-group") || "Pestaña del navegador y buscadores"), items: [], seo: true };
    Array.prototype.slice.call(doc.head.querySelectorAll(SEL)).forEach(function (n) { fieldsOf(n).forEach(function (f) { if (dedupe(f)) head.items.push(f); }); });
    // Nombres más claros para los campos genéricos de menú y pie de página
    groups.forEach(function (g) {
      var menu = /Menú/i.test(g.label), pie = /Pie de página/i.test(g.label);
      if (!menu && !pie) return;
      g.items.forEach(function (f) {
        if (f.kind === "list") return;
        f.label = f.label.replace(/^Enlace( \d+)?$/, (menu ? "Opción del menú" : "Enlace del pie") + "$1").replace(/^Botón( \d+)?$/, "Botón del menú$1");
      });
    });
    var out = groups.filter(function (g) { return g.items.length || g.showKey; });
    if (wa) {
      out.push({ id: "wa", label: "Contacto y WhatsApp", wa: true, items: [
        { kind: "text", key: "config.whatsapp", label: "Número de WhatsApp", type: "tel", def: wa.num, hint: "Con código de país y sin signos. Ej. 593939087030. Cambia todos los botones de WhatsApp de esta página." },
        { kind: "text", key: "config.whatsapp_msg", label: "Mensaje inicial de WhatsApp", type: "textarea", def: wa.msg, hint: "Texto que aparece escrito cuando alguien abre el chat. Se usa en todos los botones de esta página." }
      ] });
    }
    if (head.items.length) out.push(head);
    return { groups: out, sprite: spriteEl ? spriteEl.outerHTML : "", symbols: spriteEl ? Array.prototype.slice.call(spriteEl.querySelectorAll("symbol")).map(function (s) { return s.id; }) : [] };
  }

  /* ================================================================ vista */
  async function contenido(el, pageKey) {
    var cfg = SITIOS[pageKey];
    if (!cfg) { el.innerHTML = '<div class="panel empty">Página desconocida.</div>'; return; }
    var canEdit = FX.can("editar");
    el.innerHTML = '<div class="panel empty">Cargando la página…</div>';

    var schema, rows;
    try {
      var res = await Promise.all([
        fetch(cfg.url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("No se pudo leer la página (" + r.status + ")"); return r.text(); }),
        sb.from("site_content").select("key,value").eq("page", pageKey)
      ]);
      if (res[1].error) throw res[1].error;
      schema = readSchema(new DOMParser().parseFromString(res[0], "text/html"));
      rows = res[1].data || [];
    } catch (e) {
      el.innerHTML = '<div class="panel empty">' + FX.esc(FX.errMsg(e)) + "</div>"; return;
    }

    /* ---- estado ---- */
    var def = {}, over = {}, savedRows = {};
    schema.groups.forEach(function (g) {
      if (g.showKey) def[g.showKey] = true;
      g.items.forEach(function (f) {
        if (f.kind === "list") def[f.key] = f.def;
        else { def[f.key] = f.def; if (f.altKey) def[f.altKey] = f.defAlt; }
      });
    });
    rows.forEach(function (r) { savedRows[r.key] = clone(r.value); over[r.key] = clone(r.value); });
    var base = cfg.url;
    var disabled = !canEdit;

    function val(k) { return k in over ? over[k] : def[k]; }
    function modified(k) { return k in over && !eq(over[k], def[k]); }
    function dirtyKeys() {
      var ks = {};
      function eff(map, k, isOver) { return (k in map && (!isOver || !eq(map[k], def[k]))) ? map[k] : undefined; }
      Object.keys(over).concat(Object.keys(savedRows)).forEach(function (k) {
        if (!eq(eff(over, k, true), eff(savedRows, k, false))) ks[k] = 1;
      });
      return Object.keys(ks);
    }

    /* ---- estructura de la vista ---- */
    var previewOpen = false, device = "desktop";
    el.innerHTML = "";
    var root = h("div", { class: "ed" });
    var spriteHost = h("div", { style: "display:none", html: schema.sprite });
    var hero = h("section", { class: "ed-hero" }, [
      h("div", null, [
        h("span", { class: "eyebrow", text: "Contenido del sitio" }),
        h("h2", { text: cfg.label }),
        h("p", { text: cfg.desc + " Cambia textos, fotos, botones y enlaces; lo que no toques se queda como está." })
      ]),
      h("div", { class: "ed-hero-btns" }, [
        h("button", { class: "btn btn-ghost", id: "ed-prev-btn", "aria-pressed": "false", html: icon("eye") + "Vista previa" }),
        h("a", { class: "btn btn-ghost", href: cfg.url, target: "_blank", rel: "noopener", html: icon("ext") + "Abrir sitio" })
      ])
    ]);
    var shell = h("div", { class: "ed-shell" });
    var nav = h("nav", { class: "ed-nav", "aria-label": "Secciones" });
    var main = h("div", { class: "ed-main" });
    var preview = null;
    shell.appendChild(nav); shell.appendChild(main);
    var bar = h("div", { class: "ed-savebar", role: "status" });
    root.appendChild(spriteHost); root.appendChild(hero);
    if (!canEdit) root.appendChild(h("div", { class: "notice notice-warn", text: "Tu rol puede ver este contenido pero no editarlo. Solo el editor puede guardar cambios." }));
    root.appendChild(shell); root.appendChild(bar);
    el.appendChild(root);

    /* ---- vista previa en vivo ---- */
    var iframe = null;
    var sendPreview = debounce(function () {
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage({ type: "forxa-cms-preview", values: clone(over) }, location.origin);
    }, 220);
    function togglePreview() {
      previewOpen = !previewOpen;
      hero.querySelector("#ed-prev-btn").setAttribute("aria-pressed", String(previewOpen));
      shell.classList.toggle("has-preview", previewOpen);
      if (previewOpen) {
        iframe = h("iframe", { title: "Vista previa", src: cfg.url + (cfg.url.indexOf("?") > -1 ? "&" : "?") + "cmspreview=1" });
        iframe.addEventListener("load", function () { sendPreview(); setTimeout(sendPreview, 700); setTimeout(sendPreview, 2200); });
        var seg = h("div", { class: "seg" }, [
          h("button", { "aria-pressed": "true", "data-d": "desktop", html: icon("desktop") + "Escritorio" }),
          h("button", { "aria-pressed": "false", "data-d": "mobile", html: icon("phone") + "Móvil" })
        ]);
        preview = h("aside", { class: "ed-preview", "aria-label": "Vista previa" }, [
          h("div", { class: "ed-preview-bar" }, [h("div", { class: "dots" }, [h("i"), h("i"), h("i")]), h("span", { text: "Vista previa en vivo" }), seg,
            h("button", { class: "icon-btn", "aria-label": "Cerrar vista previa", style: "width:28px;height:28px;background:transparent;border-color:rgba(255,255,255,.18);color:#fff", html: icon("x"), onclick: togglePreview })]),
          h("div", { class: "ed-preview-stage" }, [iframe])
        ]);
        seg.addEventListener("click", function (e) {
          var b = e.target.closest("button"); if (!b) return;
          device = b.dataset.d;
          seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          preview.classList.toggle("mobile", device === "mobile");
        });
        shell.appendChild(preview);
        window.addEventListener("message", onPreviewMsg);
      } else {
        if (preview) preview.remove(); preview = null; iframe = null;
        window.removeEventListener("message", onPreviewMsg);
      }
    }
    function onPreviewMsg(e) { if (e.origin === location.origin && e.data && e.data.type === "forxa-cms-ready") sendPreview(); }
    hero.querySelector("#ed-prev-btn").addEventListener("click", togglePreview);
    function scrollPreview(label) {
      if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: "forxa-cms-scroll", group: label }, location.origin);
    }

    /* ---- barra de guardado ---- */
    var saving = false;
    function refreshBar() {
      var n = dirtyKeys().length;
      bar.classList.toggle("is-on", n > 0 && !disabled);
      bar.innerHTML = "";
      if (!n) return;
      bar.appendChild(h("span", { html: "<b>" + n + "</b> " + (n === 1 ? "cambio sin guardar" : "cambios sin guardar") }));
      bar.appendChild(h("button", { class: "btn btn-ghost btn-sm", text: "Descartar", onclick: discard }));
      bar.appendChild(h("button", { class: "btn btn-gold btn-sm", html: icon("save") + (saving ? "Guardando…" : "Guardar cambios"), disabled: saving ? "" : false, onclick: save }));
    }
    function touch(keys) { refreshBar(); refreshNav(); sendPreview(); (keys || []).forEach(markField); }

    async function save() {
      var keys = dirtyKeys(); if (!keys.length || saving) return;
      saving = true; refreshBar();
      try {
        var up = [], del = [];
        keys.forEach(function (k) {
          if (k in over && !eq(over[k], def[k])) up.push({ page: pageKey, key: k, value: over[k], updated_at: new Date().toISOString(), updated_by: FX.state.user.email });
          else del.push(k);
        });
        if (up.length) { var r1 = await sb.from("site_content").upsert(up, { onConflict: "page,key" }); if (r1.error) throw r1.error; }
        if (del.length) { var r2 = await sb.from("site_content").delete().eq("page", pageKey).in("key", del); if (r2.error) throw r2.error; }
        // sincroniza el estado local con lo guardado
        keys.forEach(function (k) {
          if (k in over && !eq(over[k], def[k])) savedRows[k] = clone(over[k]);
          else { delete savedRows[k]; delete over[k]; }
        });
        FX.log("editar", "Contenido · " + cfg.label + " · " + keys.length + " cambio(s)");
        FX.toast("Cambios publicados en " + cfg.label);
      } catch (e) { FX.toast(FX.errMsg(e), true); }
      saving = false; refreshBar(); refreshNav(); renderAll();
    }
    function discard() {
      FX.confirmar("Descartar cambios", "Se perderán los cambios que aún no has guardado en esta página.", "Descartar").then(function (ok) {
        if (!ok) return;
        over = {}; Object.keys(savedRows).forEach(function (k) { over[k] = clone(savedRows[k]); });
        renderAll(); refreshBar(); refreshNav(); sendPreview();
      });
    }

    /* ---- controles de cada tipo de campo ---- */
    // ctx: { get(k), set(k,v), reset(k)|null, mod(k) }
    var topCtx = {
      get: val, set: function (k, v) { over[k] = v; }, reset: function (k) { delete over[k]; }, mod: modified, top: true
    };
    var fieldNodes = {};   // key → nodo (para refrescar el estado "modificado")
    function markField(k) {
      var n = fieldNodes[k]; if (!n) return;
      n.classList.toggle("is-mod", modified(k) || (n.__alt && modified(n.__alt)));
    }

    function inputFor(f, ctx) {
      var key = f.key, ro = disabled;
      var wrap = h("div", { class: "ef" + (f.type === "textarea" || f.type === "html" || f.type === "image" || f.type === "icon" ? " span" : "") });
      var top = h("div", { class: "ef-top" }, [h("span", { class: "ef-label", text: f.label }), h("span", { class: "ef-badge", text: "Personalizado" })]);
      if (ctx.top) top.appendChild(h("button", { type: "button", class: "ef-reset", text: "Restablecer", onclick: function () {
        ctx.reset(key); if (f.altKey) ctx.reset(f.altKey); renderField(wrap, f, ctx); touch([key]);
      } }));
      wrap.appendChild(top);
      var body = null;

      function onSet(v) { ctx.set(key, v); touch([key]); }

      if (f.type === "text" || f.type === "tel" || f.type === "number") {
        body = h("input", { type: f.type === "number" ? "number" : f.type === "tel" ? "tel" : "text", value: String(ctx.get(key) == null ? "" : ctx.get(key)), disabled: ro ? "" : false });
        body.addEventListener("input", function () { onSet(body.value); });
        wrap.appendChild(body);
      } else if (f.type === "textarea") {
        body = h("textarea", { rows: 3, disabled: ro ? "" : false }); body.value = String(ctx.get(key) == null ? "" : ctx.get(key));
        body.addEventListener("input", function () { onSet(body.value); });
        wrap.appendChild(body);
      } else if (f.type === "html") {
        body = h("textarea", { rows: 4, disabled: ro ? "" : false }); body.value = String(ctx.get(key) == null ? "" : ctx.get(key));
        body.addEventListener("input", function () { onSet(body.value); });
        var tools = h("div", { class: "ef-tools" }, ["b|<strong>|</strong>|Negrita", "i|<em>|</em>|Cursiva"].map(function (s) {
          var p = s.split("|");
          return h("button", { type: "button", title: p[3], html: p[0] === "b" ? "<b>N</b>" : "<i>C</i>", disabled: ro ? "" : false, onclick: function () {
            var a = body.selectionStart, b = body.selectionEnd, v = body.value;
            body.value = v.slice(0, a) + p[1] + v.slice(a, b) + p[2] + v.slice(b);
            body.focus(); body.setSelectionRange(a + p[1].length, b + p[1].length); onSet(body.value);
          } });
        }));
        wrap.appendChild(tools); wrap.appendChild(body);
        wrap.appendChild(h("span", { class: "ef-hint", text: "Puedes usar negrita y cursiva. Se muestra tal cual en la página." }));
      } else if (f.type === "link") {
        body = h("input", { type: "text", placeholder: "https://… o /ruta/", value: String(ctx.get(key) == null ? "" : ctx.get(key)), disabled: ro ? "" : false });
        body.addEventListener("input", function () { onSet(body.value.trim()); });
        wrap.appendChild(h("div", { class: "ef-link", html: icon("link") }, [body]));
      } else if (f.type === "image" || f.type === "image-url" || f.type === "video") {
        wrap.classList.add("span");
        var isVideo = f.type === "video";
        var cur = ctx.get(key) || "";
        var box = h("div", { class: "ef-img-box" + (f.contain ? " contain" : "") + (isVideo ? " contain" : "") });
        var img = h("img", { alt: "" });
        var over_ = h("div", { class: "over", text: isVideo ? "Subir video" : "Cambiar imagen" });
        var urlIn = h("input", { type: "text", placeholder: isVideo ? "URL del video (.mp4 / .webm)" : "o pega la URL de la imagen", value: cur, disabled: ro ? "" : false });
        function paint() {
          var v = ctx.get(key) || "";
          if (isVideo) { box.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--muted);font-size:12px;padding:8px;text-align:center">' + icon("desktop") + "<br>" + FX.esc((v.split("/").pop() || "Sin video").slice(0, 38)) + "</div>"; box.appendChild(over_); return; }
          if (v) { img.src = resolve(v, base); box.innerHTML = ""; box.appendChild(img); box.appendChild(over_); }
          else { box.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--muted);font-size:12px">Sin imagen</div>'; box.appendChild(over_); }
          urlIn.value = v;
        }
        paint();
        async function pick() {
          if (ro) return;
          var files = await pickFiles(isVideo ? "video/mp4,video/webm" : "image/*", false); if (!files.length) return;
          box.classList.add("busy"); over_.textContent = "Subiendo…";
          try {
            var f0 = isVideo ? files[0] : await optimizeImage(files[0]);
            if (isVideo && f0.size > 45 * 1024 * 1024) throw new Error("El video pesa más de 45 MB. Comprímelo antes de subirlo.");
            var url = await FX.uploadImage(f0, pageKey + "/contenido/");
            onSet(url); paint(); FX.toast(isVideo ? "Video subido" : "Imagen subida");
          } catch (e) { FX.toast(FX.errMsg(e), true); }
          box.classList.remove("busy"); over_.textContent = isVideo ? "Subir video" : "Cambiar imagen";
        }
        box.addEventListener("click", pick);
        urlIn.addEventListener("change", function () { onSet(urlIn.value.trim()); paint(); });
        var ctrl = h("div", { class: "ef-img-ctrl" }, [
          h("div", { class: "row" }, [h("button", { type: "button", class: "btn btn-ghost btn-sm", html: icon("upload") + (isVideo ? "Subir video" : "Subir imagen"), disabled: ro ? "" : false, onclick: pick })]),
          urlIn
        ]);
        if (f.type === "image" && f.altKey) {
          var altIn = h("input", { type: "text", placeholder: "Texto alternativo (describe la imagen)", value: String(ctx.get(f.altKey) == null ? "" : ctx.get(f.altKey)), disabled: ro ? "" : false });
          altIn.addEventListener("input", function () { ctx.set(f.altKey, altIn.value); touch([key]); });
          ctrl.appendChild(altIn);
          ctrl.appendChild(h("span", { class: "mini", text: "El texto alternativo ayuda a Google y a personas con lectores de pantalla." }));
          wrap.__alt = f.altKey;
        }
        wrap.appendChild(h("div", { class: "ef-img" }, [box, ctrl]));
      } else if (f.type === "icon") {
        var cur2 = ctx.get(key) || "";
        var grid = h("div", { class: "ef-icons" });
        var UI = { "i-close": 1, "i-chevron-left": 1, "i-chevron-right": 1, "i-arrow-down": 1, "i-arrow-right": 1, "i-expand": 1, "i-whatsapp": 1 };
        schema.symbols.filter(function (s) { return !UI[s]; }).forEach(function (s) {
          grid.appendChild(h("button", { type: "button", title: s.replace(/^i-/, ""), "aria-pressed": String(s === cur2), disabled: ro ? "" : false, html: '<svg viewBox="0 0 24 24"><use href="#' + s + '"></use></svg>', onclick: function () {
            onSet(s);
            grid.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.title === s.replace(/^i-/, ""))); });
          } }));
        });
        wrap.appendChild(grid);
      }
      if (f.hint) wrap.appendChild(h("span", { class: "ef-hint", text: f.hint }));
      if (ctx.top) fieldNodes[key] = wrap;
      wrap.classList.toggle("is-mod", !!(ctx.top && (modified(key) || (f.altKey && modified(f.altKey)))));
      return wrap;
    }
    function renderField(node, f, ctx) { var n = inputFor(f, ctx); node.replaceWith(n); fieldNodes[f.key] = n; return n; }

    /* ---- listas ---- */
    function isTiles(l) {
      var nonImg = l.fields.filter(function (f) { return f.kind !== "img" && f.kind !== "attr"; });
      return l.fields.some(function (f) { return f.kind === "img"; }) && nonImg.length === 0;
    }
    function itemTitle(l, e) {
      var t = l.fields.filter(function (f) { return f.kind === "text" || f.kind === "html"; }).map(function (f) { return norm(String(e[f.key] || "").replace(/<[^>]+>/g, "")); }).filter(Boolean);
      return t[0] || "(sin título)";
    }
    function itemSub(l, e) {
      var t = l.fields.filter(function (f) { return f.kind === "text" || f.kind === "html"; }).map(function (f) { return norm(String(e[f.key] || "").replace(/<[^>]+>/g, "")); }).filter(Boolean);
      return t.slice(1, 3).join(" · ");
    }
    function imgField(l) { return l.fields.filter(function (f) { return f.kind === "img"; })[0]; }
    function blank(l) {
      var e = {};
      l.fields.forEach(function (f) { if (f.kind === "icon") e[f.key] = (l.def[0] && l.def[0][f.key]) || ""; else e[f.key] = ""; if (f.altKey) e[f.altKey] = ""; });
      if (l.opts.length) e._cls = [];
      return e;
    }

    function editItem(l, idx) {
      var isNew = idx === -1;
      var list = clone(val(l.key)) || [];
      var draft = isNew ? blank(l) : clone(list[idx]);
      var ctx = { get: function (k) { return draft[k]; }, set: function (k, v) { draft[k] = v; }, reset: null, top: false };
      var form = h("div", { class: "form-grid" });
      l.fields.forEach(function (f) { var n = inputFor(f, ctx); if (n.classList.contains("span")) n.classList.add("span-2"); form.appendChild(n); });
      if (l.opts.length) {
        var box = h("div", { class: "ef span-2" }, [h("div", { class: "ef-top" }, [h("span", { class: "ef-label", text: "Tamaño y forma en la cuadrícula" })])]);
        var row = h("div", { class: "chips" });
        l.opts.forEach(function (o) {
          var on = (draft._cls || []).indexOf(o.v) !== -1;
          row.appendChild(h("button", { type: "button", class: "chip", "aria-pressed": String(on), text: o.l, onclick: function () {
            draft._cls = draft._cls || [];
            var i = draft._cls.indexOf(o.v); if (i === -1) draft._cls.push(o.v); else draft._cls.splice(i, 1);
            this.setAttribute("aria-pressed", String(i === -1));
          } }));
        });
        box.appendChild(row); form.appendChild(box);
      }
      return FX.modal({
        title: (isNew ? "Agregar " : "Editar ") + l.noun.toLowerCase(),
        body: "", actions: [{ label: "Cancelar", value: "cancel" }, { label: isNew ? "Agregar" : "Aplicar", value: "ok", cls: "btn-primary" }],
        onOpen: function (body) { body.appendChild(form); },
        onSubmit: function () {
          var cur = clone(val(l.key)) || [];
          if (isNew) cur.push(draft); else cur[idx] = draft;
          over[l.key] = cur; touch([l.key]); renderList(l);
        }
      });
    }

    var listNodes = {};
    function renderList(l) {
      var node = listNodes[l.key];
      var items = val(l.key) || [];
      var tiles = isTiles(l), imf = imgField(l);
      var head = h("div", { class: "el-head" }, [
        h("div", null, [h("strong", { text: l.label }), h("span", { class: "cnt", text: items.length + (items.length === 1 ? " elemento" : " elementos") })]),
        h("div", { style: "display:flex;gap:8px;align-items:center" }, [
          modified(l.key) ? h("button", { type: "button", class: "ef-reset", style: "display:inline-block", text: "Restablecer lista", onclick: function () {
            delete over[l.key]; renderList(l); touch([l.key]);
          } }) : null,
          disabled ? null : (tiles ? h("button", { class: "btn btn-primary btn-sm", html: icon("plus") + "Agregar fotos", onclick: addPhotos }) : h("button", { class: "btn btn-primary btn-sm", html: icon("plus") + "Agregar " + l.noun.toLowerCase(), onclick: function () { editItem(l, -1); } }))
        ])
      ]);
      var body = h("div", { class: "el-body" + (tiles ? " tiles" : "") });

      function commit(next) { over[l.key] = next; touch([l.key]); renderList(l); }
      function move(i, d) { var c = clone(items), j = i + d; if (j < 0 || j >= c.length) return; var t = c[i]; c[i] = c[j]; c[j] = t; commit(c); }
      function dup(i) { var c = clone(items); c.splice(i + 1, 0, clone(c[i])); commit(c); }
      function del(i) {
        FX.confirmar("Quitar " + l.noun.toLowerCase(), "¿Quitar “" + itemTitle(l, items[i]) + "” de la lista? Podrás restablecerla antes de guardar.", "Quitar").then(function (ok) {
          if (!ok) return; var c = clone(items); c.splice(i, 1); commit(c);
        });
      }
      async function addPhotos() {
        var files = await pickFiles("image/*", true); if (!files.length) return;
        FX.toast("Subiendo " + files.length + " foto(s)…");
        var c = clone(items);
        for (var i = 0; i < files.length; i++) {
          try {
            var f0 = await optimizeImage(files[i]);
            var url = await FX.uploadImage(f0, pageKey + "/contenido/");
            var e = blank(l); e[imf.key] = url; e[imf.altKey] = files[i].name.replace(/\.\w+$/, "").replace(/[-_]+/g, " ");
            c.push(e);
          } catch (err) { FX.toast(FX.errMsg(err), true); }
        }
        commit(c);
      }

      // arrastrar para ordenar
      var dragFrom = null;
      function dnd(n, i) {
        if (disabled) return;
        n.draggable = true;
        n.addEventListener("dragstart", function (e) { dragFrom = i; n.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } catch (x) {} });
        n.addEventListener("dragend", function () { n.classList.remove("dragging"); body.querySelectorAll(".drag-over").forEach(function (x) { x.classList.remove("drag-over"); }); });
        n.addEventListener("dragover", function (e) { if (dragFrom === null) return; e.preventDefault(); n.classList.add("drag-over"); });
        n.addEventListener("dragleave", function () { n.classList.remove("drag-over"); });
        n.addEventListener("drop", function (e) {
          e.preventDefault(); if (dragFrom === null || dragFrom === i) return;
          var c = clone(items), it = c.splice(dragFrom, 1)[0]; c.splice(i, 0, it); dragFrom = null; commit(c);
        });
      }

      if (!items.length) body.appendChild(h("div", { class: "el-empty", text: "La lista está vacía." }));
      items.forEach(function (e, i) {
        var thumb = imf ? e[imf.key] : "";
        if (tiles) {
          var t = h("div", { class: "tile", tabindex: "0", title: "Editar", onclick: function (ev) { if (ev.target.closest(".tools")) return; if (!disabled) editItem(l, i); } }, [
            thumb ? h("img", { src: resolve(thumb, base), alt: e[imf.altKey] || "", loading: "lazy" }) : null,
            (e._cls || []).length ? h("span", { class: "badge", text: (e._cls || []).map(function (c) { var o = l.opts.filter(function (x) { return x.v === c; })[0]; return o ? o.l.replace("Doble ", "") : c; }).join(" · ") }) : null,
            disabled ? null : h("div", { class: "tools" }, [
              h("div", { style: "display:flex;gap:4px" }, [
                h("button", { type: "button", title: "Mover antes", html: icon("left"), disabled: i === 0 ? "" : false, onclick: function () { move(i, -1); } }),
                h("button", { type: "button", title: "Mover después", html: icon("right"), disabled: i === items.length - 1 ? "" : false, onclick: function () { move(i, 1); } })]),
              h("div", { style: "display:flex;gap:4px" }, [
                h("button", { type: "button", title: "Duplicar", html: icon("copy"), onclick: function () { dup(i); } }),
                h("button", { type: "button", class: "danger", title: "Quitar", html: icon("trash"), onclick: function () { del(i); } })])
            ])
          ]);
          dnd(t, i); body.appendChild(t);
        } else {
          var r = h("div", { class: "rowi" }, [
            disabled ? null : h("span", { class: "grip", title: "Arrastra para ordenar", html: icon("grip") }),
            thumb ? h("img", { class: "th", src: resolve(thumb, base), alt: "", loading: "lazy" }) : null,
            h("div", { class: "tt" }, [h("b", { text: itemTitle(l, e) }), h("span", { text: itemSub(l, e) })]),
            disabled ? null : h("div", { class: "ops" }, [
              h("button", { type: "button", class: "icon-btn", title: "Subir", html: icon("up"), disabled: i === 0 ? "" : false, onclick: function () { move(i, -1); } }),
              h("button", { type: "button", class: "icon-btn", title: "Bajar", html: icon("down"), disabled: i === items.length - 1 ? "" : false, onclick: function () { move(i, 1); } }),
              h("button", { type: "button", class: "icon-btn", title: "Editar", html: icon("edit"), onclick: function () { editItem(l, i); } }),
              h("button", { type: "button", class: "icon-btn", title: "Duplicar", html: icon("copy"), onclick: function () { dup(i); } }),
              h("button", { type: "button", class: "icon-btn danger", title: "Quitar", html: icon("trash"), onclick: function () { del(i); } })
            ])
          ]);
          dnd(r, i); body.appendChild(r);
        }
      });
      var n2 = h("div", { class: "el" }, [head, body]);
      if (node) node.replaceWith(n2);
      listNodes[l.key] = n2;
      return n2;
    }

    /* ---- tarjetas de sección ---- */
    var cards = {};
    function renderCard(g) {
      var showOn = g.showKey ? val(g.showKey) !== false : true;
      var nFields = g.items.filter(function (i) { return i.kind !== "list"; }).length;
      var title = h("div", null, [h("h3", { text: g.label }), h("div", { class: "sub", text: nFields + " campos" + (g.items.some(function (i) { return i.kind === "list"; }) ? " · con listas" : "") })]);
      var right = h("div", { style: "display:flex;gap:12px;align-items:center" });
      if (!g.seo && !g.wa) right.appendChild(h("button", { type: "button", class: "ef-reset", style: "display:inline-block", text: "Ver en la página", onclick: function () { if (!previewOpen) togglePreview(); scrollPreview(g.label); } }));
      if (g.showKey) {
        var cb = h("input", { type: "checkbox", disabled: disabled ? "" : false }); cb.checked = showOn;
        cb.addEventListener("change", function () { over[g.showKey] = cb.checked; card.classList.toggle("is-off", !cb.checked); touch([g.showKey]); });
        right.appendChild(h("label", { class: "sw", title: "Mostrar u ocultar toda esta sección en la página" }, [cb, h("i"), h("span", { text: "Visible" })]));
      }
      var bodyEl = h("div", { class: "ed-card-body" });
      g.items.forEach(function (it) {
        if (it.kind === "list") { bodyEl.appendChild(renderList(it)); return; }
        bodyEl.appendChild(inputFor(it, topCtx));
      });
      var card = h("section", { class: "ed-card" + (showOn ? "" : " is-off"), id: "sec-" + g.id }, [h("header", { class: "ed-card-head" }, [title, right]), bodyEl]);
      cards[g.id] = card;
      return card;
    }
    function renderAll() {
      main.innerHTML = ""; fieldNodes = {}; listNodes = {};
      schema.groups.forEach(function (g) { main.appendChild(renderCard(g)); });
      refreshNav();
    }

    /* ---- índice lateral ---- */
    function groupMod(g) {
      return g.items.some(function (it) {
        if (it.kind === "list") return modified(it.key);
        return modified(it.key) || (it.altKey && modified(it.altKey));
      }) || (g.showKey && modified(g.showKey));
    }
    function refreshNav() {
      var active = nav.querySelector("a.is-active"); var activeId = active && active.getAttribute("href");
      nav.innerHTML = "";
      nav.appendChild(h("span", { class: "eyebrow", text: "Secciones" }));
      schema.groups.forEach(function (g) {
        var off = g.showKey && val(g.showKey) === false;
        var a = h("a", { href: "#sec-" + g.id, class: (off ? "is-off " : "") + (("#sec-" + g.id) === activeId ? "is-active" : "") }, [h("span", { text: g.label }), groupMod(g) ? h("i", { class: "dot", title: "Con cambios personalizados" }) : null]);
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var c = cards[g.id]; if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
          nav.querySelectorAll("a").forEach(function (x) { x.classList.toggle("is-active", x === a); });
        });
        nav.appendChild(a);
      });
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = "#" + en.target.id;
          nav.querySelectorAll("a").forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("href") === id); });
        });
      }, { rootMargin: "-18% 0px -70% 0px" });
      var obs = function () { Object.keys(cards).forEach(function (k) { io.observe(cards[k]); }); };
      setTimeout(obs, 50);
    }

    renderAll(); refreshBar();

    /* aviso al salir con cambios */
    FX.state.guard = function () { return dirtyKeys().length ? "Hay cambios sin guardar en «" + cfg.label + "». ¿Salir de todos modos?" : null; };
    window.onbeforeunload = function () { return dirtyKeys().length ? "Hay cambios sin guardar." : undefined; };
  }

  window.VIEWS = window.VIEWS || {};
  VIEWS.contenido = contenido;
  VIEWS.SITIOS = SITIOS;
})();
