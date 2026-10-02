/* FORXA · Contenido editable de las landings (motor del lado del visitante).

   Cada landing declara qué puede editarse con atributos data-cms* (los pone
   scripts/etiquetar-landing.mjs). Este archivo lee los valores guardados desde
   el panel (tabla "site_content") y los aplica sobre la página:

     data-cms="clave"            texto
     data-cms-html="clave"       texto con negritas/cursivas
     data-cms-img="clave"        imagen (src) y "clave@alt" (texto alternativo)
     data-cms-href="clave"       destino de un enlace
     data-cms-attr="a:k,b:k2"    cualquier atributo (poster, src, content, data-count…)
     data-cms-icon="clave"       ícono del sprite SVG (<use href="#i-…">)
     data-cms-wa                 enlace de WhatsApp (usa config.whatsapp / config.whatsapp_msg)
     data-cms-show="clave"       mostrar/ocultar un bloque (valor false = oculto)
     data-cms-list="clave"       lista repetible: el valor es un arreglo de elementos

   Si no hay nada guardado, la página se ve exactamente como está escrita en
   su HTML (no depende de este script para mostrarse).
   Se aplica primero lo último que se guardó en el navegador (sin parpadeo) y
   luego se actualiza con lo más reciente de la base de datos. */
(function () {
  "use strict";
  var root = document.documentElement;
  var page = root.getAttribute("data-cms-page");
  if (!page) return;

  var CFG = window.FORXA_CONFIG || {};
  var CACHE_KEY = "forxa-cms:" + page;
  var store = {};                    // clave → valor
  var SEL = "[data-cms],[data-cms-html],[data-cms-img],[data-cms-href],[data-cms-attr],[data-cms-icon]";

  /* ------------------------------------------------------------ utilidades */
  function has(v) { return v !== undefined && v !== null; }
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    return /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/|data:image\/|[a-z0-9_\-]+(\/|\.))/i.test(u) && !/^javascript:/i.test(u) ? u : "";
  }
  var OK_TAGS = { STRONG: 1, B: 1, EM: 1, I: 1, U: 1, BR: 1, MARK: 1, SUP: 1, SUB: 1 };
  function sanitize(html) {
    var t = document.createElement("template");
    t.innerHTML = String(html == null ? "" : html);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { node.removeChild(c); return; }
        walk(c);
        if (OK_TAGS[c.tagName]) {
          while (c.attributes.length) c.removeAttribute(c.attributes[0].name);
        } else {
          while (c.firstChild) node.insertBefore(c.firstChild, c);
          node.removeChild(c);
        }
      });
    })(t.content);
    return t.innerHTML;
  }

  // Guarda el valor original de un campo la primera vez que se cambia, para poder
  // restaurarlo (p. ej. en la vista previa del panel al deshacer un cambio).
  function saved(el, k) { return el.__cms && (k in el.__cms); }
  function keep(el, k, current) {
    var o = el.__cms || (el.__cms = {});
    if (!(k in o)) o[k] = current;
  }
  function setAttr(el, name, v) {
    var k = "a:" + name;
    if (has(v)) {
      keep(el, k, el.getAttribute(name));
      el.setAttribute(name, v);
    } else if (saved(el, k)) {
      var o = el.__cms[k];
      if (o === null) el.removeAttribute(name); else el.setAttribute(name, o);
    }
  }

  /* --------------------------------------------------------- aplicar campos */
  // get(clave) → valor o undefined. strict: lo que falta se vacía (elementos nuevos de una lista).
  function fillOne(el, get, strict) {
    var k, v;

    if ((k = el.getAttribute("data-cms"))) {
      v = get(k);
      if (has(v)) { keep(el, "text", el.textContent); el.textContent = String(v); }
      else if (strict) el.textContent = "";
      else if (saved(el, "text")) el.textContent = el.__cms.text;
    }
    if ((k = el.getAttribute("data-cms-html"))) {
      v = get(k);
      if (has(v)) { keep(el, "html", el.innerHTML); el.innerHTML = sanitize(v); }
      else if (strict) el.innerHTML = "";
      else if (saved(el, "html")) el.innerHTML = el.__cms.html;
    }
    if ((k = el.getAttribute("data-cms-img"))) {
      v = get(k);
      var alt = get(k + "@alt");
      if (has(v) && safeUrl(v)) {
        setAttr(el, "src", safeUrl(v));
        if (el.hasAttribute("data-full")) setAttr(el, "data-full", safeUrl(v));
        var holder = el.closest("[data-ficha]");
        if (holder) setAttr(holder, "data-ficha", safeUrl(v));
      } else if (strict) { el.removeAttribute("src"); el.style.display = "none"; }
      else setAttr(el, "src", undefined);
      if (has(alt)) setAttr(el, "alt", alt); else if (strict) el.setAttribute("alt", ""); else setAttr(el, "alt", undefined);
    }
    if ((k = el.getAttribute("data-cms-href"))) {
      v = get(k);
      if (has(v) && safeUrl(v)) setAttr(el, "href", safeUrl(v)); else setAttr(el, "href", undefined);
    }
    if ((k = el.getAttribute("data-cms-icon"))) {
      v = get(k);
      if (has(v) && /^[\w-]+$/.test(v)) setAttr(el, "href", "#" + v); else setAttr(el, "href", undefined);
    }
    if ((k = el.getAttribute("data-cms-attr"))) {
      k.split(",").forEach(function (pair) {
        var i = pair.indexOf(":"); if (i < 1) return;
        var name = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
        v = get(key);
        if (has(v) && /^(href|src|poster)$/.test(name) && !safeUrl(v)) v = undefined;
        setAttr(el, name, has(v) ? String(v) : undefined);
        if (name === "data-count" && has(v) && el.textContent !== "0") el.textContent = String(v);
        if (name === "src" && el.tagName === "SOURCE" && el.parentNode && el.parentNode.load) {
          try { el.parentNode.load(); } catch (e) {}
        }
      });
    }
  }

  function fillScope(scope, get, strict) {
    var list = Array.prototype.slice.call(scope.querySelectorAll(SEL));
    if (scope.matches && scope.matches(SEL)) list.unshift(scope);
    list.forEach(function (el) {
      // los campos que viven dentro de una lista los pinta la lista
      if (scope === document && el.closest("[data-cms-list]")) return;
      fillOne(el, get, strict);
    });
  }

  /* ------------------------------------------------------------------ listas */
  function clsOptions(container) {
    return (container.getAttribute("data-cms-cls") || "").split(",").map(function (s) { return s.split(":")[0].trim(); }).filter(Boolean);
  }
  function renderList(container, items) {
    if (!Array.isArray(items) && !container.__tpl) return;    // nunca se cambió: se deja tal cual
    if (!container.__tpl) {
      var kids = Array.prototype.slice.call(container.children);
      container.__origKids = kids.map(function (n) { return n.cloneNode(true); });
      container.__tpl = kids[0] ? kids[0].cloneNode(true) : null;
    }
    var repeat = parseInt(container.getAttribute("data-cms-repeat"), 10) || 1;
    var opts = clsOptions(container);
    while (container.firstChild) container.removeChild(container.firstChild);

    if (!Array.isArray(items)) {                       // sin override: contenido original
      container.__origKids.forEach(function (n) { container.appendChild(n.cloneNode(true)); });
      return;
    }
    if (!container.__tpl) return;
    for (var r = 0; r < repeat; r++) {
      items.forEach(function (entry) {
        if (!entry || entry._oculto) return;
        var node = container.__tpl.cloneNode(true);
        opts.forEach(function (c) { node.classList.remove(c); });
        (Array.isArray(entry._cls) ? entry._cls : []).forEach(function (c) { if (opts.indexOf(c) !== -1) node.classList.add(c); });
        fillScope(node, function (k) { return entry[k]; }, true);
        node.querySelectorAll("img").forEach(function (im) { if (im.getAttribute("loading") === null && im.hasAttribute("data-lightbox")) im.setAttribute("loading", "lazy"); });
        // los elementos nuevos no pasan por el observador de "reveal": se muestran ya
        [node].concat(Array.prototype.slice.call(node.querySelectorAll(".reveal"))).forEach(function (n) {
          if (n.classList.contains("reveal")) n.classList.add("is-visible");
        });
        container.appendChild(node);
      });
    }
  }

  /* ------------------------------------------------------------ mostrar/ocultar */
  function applyShow() {
    document.querySelectorAll("[data-cms-show]").forEach(function (el) {
      var v = store[el.getAttribute("data-cms-show")];
      var oculto = v === false || v === "false";
      if (oculto) { if (!("__disp" in el)) el.__disp = el.style.display; el.style.display = "none"; el.setAttribute("data-cms-hidden", ""); }
      else if ("__disp" in el) { el.style.display = el.__disp; delete el.__disp; el.removeAttribute("data-cms-hidden"); }
    });
  }

  /* ---------------------------------------------------------------- WhatsApp */
  function waNumber() {
    var n = store["config.whatsapp"];
    return has(n) && String(n).replace(/\D/g, "") ? String(n).replace(/\D/g, "") : null;
  }
  function applyWhatsApp() {
    var num = waNumber(), msg = store["config.whatsapp_msg"];
    document.querySelectorAll("[data-cms-wa]").forEach(function (a) {
      keep(a, "wa", a.getAttribute("href"));
      var o = a.__cms.wa;
      var m = /^https?:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/i.exec(o || "");
      var baseNum = m ? m[1] : "", baseTxt = m && m[2] ? m[2] : "";
      var n = num || baseNum;
      var text = has(msg) && String(msg).trim() !== "" ? encodeURIComponent(String(msg)) : baseTxt;
      a.setAttribute("href", "https://wa.me/" + n + (text ? "?text=" + text : ""));
    });
  }

  /* -------------------------------------------------------------------- todo */
  function applyAll() {
    document.querySelectorAll("[data-cms-list]").forEach(function (c) {
      renderList(c, store[c.getAttribute("data-cms-list")]);
    });
    fillScope(document, function (k) { return store[k]; }, false);
    applyShow();
    applyWhatsApp();
    try { document.dispatchEvent(new CustomEvent("cms:applied")); } catch (e) {}
  }

  function setRows(rows) {
    var next = {};
    (rows || []).forEach(function (r) { next[r.key] = r.value; });
    store = next;
  }

  /* ------------------------------------------------------------ carga/caché */
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) {}
  if (!/[?&]cmspreview=1/.test(location.search) && cached && cached.length) { setRows(cached); applyAll(); }

  // Vista previa del panel (iframe): no consulta la base; recibe los valores por mensaje.
  var PREVIEW = /[?&]cmspreview=1/.test(location.search);
  if (PREVIEW) {
    store = {}; cached = null;
    try { window.parent.postMessage({ type: "forxa-cms-ready" }, location.origin); } catch (e) {}
  }

  if (!PREVIEW && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.fetch) {
    fetch(CFG.SUPABASE_URL + "/rest/v1/site_content?select=key,value&page=eq." + encodeURIComponent(page), {
      headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
      cache: "no-store"
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
      if (!Array.isArray(rows)) return;
      var a = JSON.stringify(rows), b = JSON.stringify(cached || []);
      try { localStorage.setItem(CACHE_KEY, a); } catch (e) {}
      if (a !== b || !cached) { setRows(rows); applyAll(); }
    }).catch(function () { /* sin conexión: se queda lo que ya hay */ });
  }

  /* ----------------------------------------- vista previa desde el panel (iframe) */
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === "forxa-cms-preview") { store = e.data.values || {}; applyAll(); }
    if (e.data.type === "forxa-cms-scroll") {
      var g = Array.prototype.slice.call(document.querySelectorAll("[data-cms-group]")).filter(function (n) { return n.getAttribute("data-cms-group") === e.data.group; })[0];
      if (g && g.scrollIntoView) g.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  /* ---------------------------------------------------------------- API pública */
  window.CMS = {
    page: page,
    get: function (k, fallback) { return has(store[k]) ? store[k] : fallback; },
    whatsapp: function (fallback) { return waNumber() || fallback; },
    apply: applyAll
  };
})();
