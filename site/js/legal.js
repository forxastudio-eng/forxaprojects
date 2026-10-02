/* FORXA · Páginas legales: índice lateral generado desde los títulos de cada
   sección (así sigue al día aunque se editen desde el panel) y resaltado de la
   sección que se está leyendo. */
(function () {
  "use strict";
  var nav = document.getElementById("lgToc");
  var secs = Array.prototype.slice.call(document.querySelectorAll(".lg-doc .lg-sec[id]"));
  if (!nav || !secs.length) return;

  function build() {
    nav.innerHTML = "";
    secs.forEach(function (s) {
      if (s.style.display === "none") return;
      var h = s.querySelector("h2"); if (!h) return;
      var a = document.createElement("a");
      a.href = "#" + s.id; a.textContent = h.textContent.trim();
      nav.appendChild(a);
    });
  }
  build();
  document.addEventListener("cms:applied", build);

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id);
        });
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    secs.forEach(function (s) { io.observe(s); });
  }
  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();
