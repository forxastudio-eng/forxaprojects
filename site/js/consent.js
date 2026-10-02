/* FORXA · Consentimiento de cookies (banner + preferencias).
   - Muestra el aviso la primera vez (y cada 12 meses o si cambia la versión).
   - Categorías: necesarias (siempre activas), analítica y marketing.
     Hoy el sitio NO usa analítica ni marketing; las categorías existen para
     que, si se activan después, solo se carguen con permiso de la persona.
   - Cualquier script de terceros debe declararse así y NO se ejecuta hasta
     que se acepte su categoría:
         <script type="text/plain" data-consent="analytics" src="…"></script>
   - Para reabrir las preferencias: cualquier elemento con data-consent-open.
   - API:  FORXA_CONSENT.get() · .allowed("analytics") · .open() · .onChange(fn)
   Sin dependencias; el tema (colores/tipografía) lo toma de data-cms-page. */
(function () {
  "use strict";
  if (/[?&]cmspreview=1/.test(location.search)) return;      // vista previa del panel

  var KEY = "forxa-consent", VERSION = 1, MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  var page = document.documentElement.getAttribute("data-cms-page") || "";
  var theme = /^(arcus|alabes|porton)$/.test(page) ? page : "forxa";
  var listeners = [];

  /* --------------------------------------------------------------- estado */
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && v.v === VERSION && v.ts && Date.now() - v.ts < MAX_AGE) return v;
    } catch (e) {}
    return null;
  }
  function write(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  var state = read();

  function save(analytics, marketing) {
    state = { v: VERSION, ts: Date.now(), necessary: true, analytics: !!analytics, marketing: !!marketing };
    write(state);
    activateScripts();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent("forxa:consent", { detail: state })); } catch (e) {}
  }

  /* Scripts de terceros en espera: type="text/plain" data-consent="categoría" */
  function activateScripts() {
    Array.prototype.slice.call(document.querySelectorAll('script[type="text/plain"][data-consent]')).forEach(function (s) {
      var cat = s.getAttribute("data-consent");
      if (!api.allowed(cat) || s.__done) return;
      s.__done = true;
      var n = document.createElement("script");
      Array.prototype.slice.call(s.attributes).forEach(function (a) {
        if (a.name !== "type" && a.name !== "data-consent") n.setAttribute(a.name, a.value);
      });
      n.text = s.text;
      s.parentNode.insertBefore(n, s.nextSibling);
    });
  }

  var api = window.FORXA_CONSENT = {
    get: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    allowed: function (cat) { return cat === "necessary" || !!(state && state[cat]); },
    open: function () { openSettings(); },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  /* -------------------------------------------------------------- interfaz */
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5z"/><path d="M8.5 11v.01M12 15v.01M15.5 13v.01M9 15.5v.01"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var banner = null, dialog = null;

  function ensureCss() {
    if (document.querySelector('link[href$="consent.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/css/consent.css"; document.head.appendChild(l);
  }

  function buildBanner() {
    banner = document.createElement("section");
    banner.className = "cc"; banner.setAttribute("data-theme", theme);
    banner.setAttribute("role", "region"); banner.setAttribute("aria-label", "Aviso de cookies");
    banner.innerHTML =
      '<div class="cc__top"><span class="cc__ico">' + ICON + '</span><h2 class="cc__title">Tu privacidad importa</h2></div>' +
      '<p class="cc__text">Usamos almacenamiento propio y necesario para que este sitio funcione y recuerde tus preferencias. ' +
      'No usamos cookies de analítica ni de publicidad; si algún día lo hacemos, será solo con tu permiso. ' +
      'Más información en la <a href="/cookies/">Política de cookies</a> y la <a href="/privacidad/">Política de privacidad</a>.</p>' +
      '<div class="cc__row">' +
        '<button type="button" class="cc__btn cc__btn--main" data-a="all">Aceptar todo</button>' +
        '<button type="button" class="cc__btn" data-a="necessary">Solo necesarias</button>' +
        '<button type="button" class="cc__btn cc__btn--link" data-a="settings">Personalizar</button>' +
      '</div>';
    banner.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "all") { save(true, true); hideBanner(); }
      else if (a === "necessary") { save(false, false); hideBanner(); }
      else openSettings();
    });
    document.body.appendChild(banner);
    requestAnimationFrame(function () { requestAnimationFrame(function () { banner.classList.add("is-on"); }); });
  }
  function hideBanner() {
    if (!banner) return;
    var b = banner; banner = null;
    b.classList.remove("is-on");
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 600);
  }

  function cat(id, title, text, checked, locked) {
    return '<div class="cc-cat"><h3>' + title + '</h3>' +
      (locked ? '<span class="cc-badge">Siempre activas</span>'
              : '<label class="cc-sw"><input type="checkbox" data-c="' + id + '"' + (checked ? " checked" : "") + ' aria-label="' + title + '"><i></i></label>') +
      '<p>' + text + '</p></div>';
  }

  function openSettings() {
    ensureCss();
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "cc-dialog"; dialog.setAttribute("data-theme", theme);
      dialog.setAttribute("aria-labelledby", "cc-dlg-title");
      document.body.appendChild(dialog);
      dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
      dialog.addEventListener("close", function () { /* el foco vuelve solo a quien lo abrió */ });
    }
    var cur = state || { analytics: false, marketing: false };
    dialog.innerHTML =
      '<div class="cc-dialog__head"><div><h2 id="cc-dlg-title">Preferencias de cookies</h2>' +
      '<p>Elige qué podemos usar. Puedes cambiar tu decisión cuando quieras desde el enlace «Preferencias de cookies» al pie de la página.</p></div>' +
      '<button type="button" class="cc-x" data-a="close" aria-label="Cerrar">' + CLOSE + '</button></div>' +
      '<div class="cc-dialog__body">' +
        cat("necessary", "Necesarias", "Guardan tu elección sobre cookies y la última versión del contenido para que el sitio cargue rápido. No se pueden desactivar.", true, true) +
        cat("analytics", "Analítica", "Nos ayudarían a entender cómo se usa el sitio para mejorarlo. <strong>Hoy no usamos ninguna.</strong>", cur.analytics, false) +
        cat("marketing", "Marketing", "Permitirían medir y mostrar publicidad de nuestros proyectos. <strong>Hoy no usamos ninguna.</strong>", cur.marketing, false) +
      '</div>' +
      '<p class="cc-dialog__links">Detalles en la <a href="/cookies/">Política de cookies</a> y la <a href="/privacidad/">Política de privacidad</a>.</p>' +
      '<div class="cc-dialog__foot">' +
        '<button type="button" class="cc__btn" data-a="necessary">Rechazar opcionales</button>' +
        '<button type="button" class="cc__btn" data-a="all">Aceptar todo</button>' +
        '<button type="button" class="cc__btn cc__btn--main" data-a="save" style="flex:0 1 auto">Guardar preferencias</button>' +
      '</div>';
    dialog.onclick = function (e) {
      if (e.target === dialog) return close();
      var b = e.target.closest("button[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "close") return close();
      if (a === "all") save(true, true);
      else if (a === "necessary") save(false, false);
      else save(dialog.querySelector('[data-c="analytics"]').checked, dialog.querySelector('[data-c="marketing"]').checked);
      hideBanner(); close();
    };
    if (dialog.showModal) { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute("open", "");
    function close() { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); }
  }

  /* -------------------------------------------------------------- arranque */
  function init() {
    ensureCss();
    activateScripts();
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-consent-open]");
      if (t) { e.preventDefault(); openSettings(); }
    });
    if (!state) setTimeout(buildBanner, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
