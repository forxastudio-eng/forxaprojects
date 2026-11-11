/* FORXA · "Quedan N": cuenta las tarjetas disponibles ya pintadas (mismos estados
   que sincronizan panel y cotizador) y lo muestra en cada pestaña de tipología y
   sobre la grilla de locales. Las landings lo llaman después de pintar unidades. */
window.FORXA_QUEDAN = function () {
  "use strict";
  function badge(n) {
    var s = document.createElement("span");
    s.className = "quedan" + (n <= 5 ? " is-low" : "");
    s.textContent = n === 0 ? "Agotado" : (n <= 5 ? "Quedan " + n : n + " disponibles");
    return s;
  }
  function contar(el) { return el ? el.querySelectorAll(".status--disponible").length : 0; }
  document.querySelectorAll(".tab-btn[data-tab]").forEach(function (b) {
    var panel = document.getElementById(b.getAttribute("data-tab"));
    if (!panel || !panel.querySelector(".status")) return;
    var old = b.querySelector(".quedan"); if (old) old.remove();
    b.appendChild(badge(contar(panel)));
  });
  var loc = document.getElementById("localesGrid");
  if (loc && loc.querySelector(".status")) {
    var prev = loc.previousElementSibling && loc.previousElementSibling.classList.contains("quedan-row") ? loc.previousElementSibling : null;
    if (prev) prev.remove();
    var row = document.createElement("p");
    row.className = "quedan-row";
    row.appendChild(badge(contar(loc)));
    loc.parentNode.insertBefore(row, loc);
  }
};
// El CMS reescribe el texto de los botones al aplicar contenido: se repone el distintivo.
document.addEventListener("cms:applied", function () { if (window.FORXA_QUEDAN) window.FORXA_QUEDAN(); });
