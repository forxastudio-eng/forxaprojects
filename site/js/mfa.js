/* FORXA · Verificación en dos pasos (TOTP: Google Authenticator, Authy, 1Password…).
   - FORXA_MFA.asegurar(sb): si la cuenta tiene 2FA y la sesión aún no pasó el código,
     lo pide en un diálogo. Devuelve true si la sesión queda verificada (o no usa 2FA).
   - FORXA_MFA.cuenta(el, sb): sección para activar o desactivar la 2FA en "Mi cuenta".
   La regla real vive en la base de datos (mi_rol() exige aal2 si hay 2FA): esto es solo
   la interfaz, no se puede saltar desde el navegador. */
(function () {
  "use strict";
  var CSS = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,14,22,.6);padding:16px;font-family:inherit";
  var CARD = "background:#fff;color:#0E1624;border-radius:14px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3)";
  var INPUT = "width:100%;font-size:24px;letter-spacing:.3em;text-align:center;padding:10px;border:1.5px solid #c9d2e0;border-radius:10px;margin:14px 0 8px";
  var BTN = "min-height:44px;padding:0 18px;border-radius:999px;border:0;font:600 15px inherit;cursor:pointer";

  function pedirCodigo(titulo, texto) {
    return new Promise(function (ok) {
      var w = document.createElement("div");
      w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-labelledby", "mfa-t");
      w.style.cssText = CSS;
      w.innerHTML = '<form style="' + CARD + '"><h2 id="mfa-t" style="margin:0 0 6px;font-size:20px"></h2><p style="margin:0;color:#4a5568;font-size:14px"></p>' +
        '<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required aria-label="Código de 6 dígitos" style="' + INPUT + '">' +
        '<p class="mfa-err" role="alert" style="min-height:20px;margin:0 0 8px;color:#C23A32;font-size:13px"></p>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="mfa-no" style="' + BTN + ';background:#eef1f6;color:#0E1624">Cancelar</button>' +
        '<button type="submit" style="' + BTN + ';background:#1D62DB;color:#fff">Verificar</button></div></form>';
      w.querySelector("h2").textContent = titulo;
      w.querySelector("p").textContent = texto;
      document.body.appendChild(w);
      var inp = w.querySelector("input"); inp.focus();
      var cerrar = function (v) { w.remove(); ok(v); };
      w.querySelector(".mfa-no").onclick = function () { cerrar(null); };
      w.querySelector("form").onsubmit = function (e) {
        e.preventDefault();
        cerrar({ code: inp.value.trim() });
      };
    });
  }

  async function asegurar(sb) {
    try {
      var a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (a.error || !a.data || a.data.nextLevel !== "aal2" || a.data.currentLevel === "aal2") return true;
      var f = await sb.auth.mfa.listFactors();
      var factor = f.data && f.data.totp && f.data.totp.filter(function (x) { return x.status === "verified"; })[0];
      if (!factor) return true;
      for (var intento = 0; intento < 5; intento++) {
        var r = await pedirCodigo("Verificación en dos pasos", intento ? "Código incorrecto. Escribe el código actual de tu app de autenticación." : "Escribe el código de 6 dígitos de tu app de autenticación.");
        if (!r) break;
        var v = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: r.code });
        if (!v.error) return true;
      }
      await sb.auth.signOut();
      return false;
    } catch (e) { console.warn("2FA:", e); return true; } // shortcut: si la API falla se deja pasar; la base de datos igual exige aal2
  }

  async function cuenta(el, sb) {
    el.innerHTML = '<p style="color:#4a5568;font-size:14px">Cargando…</p>';
    var f = await sb.auth.mfa.listFactors();
    var activos = (f.data && f.data.totp || []).filter(function (x) { return x.status === "verified"; });
    if (activos.length) {
      el.innerHTML = '<p style="margin:0 0 12px"><strong>Activada.</strong> Al entrar te pediremos el código de tu app de autenticación.</p>' +
        '<button type="button" class="btn btn-ghost" id="mfa-off">Desactivar verificación en dos pasos</button>';
      el.querySelector("#mfa-off").onclick = async function () {
        if (!window.confirm("¿Desactivar la verificación en dos pasos? Tu cuenta quedará protegida solo por la contraseña.")) return;
        var r = await sb.auth.mfa.unenroll({ factorId: activos[0].id });
        if (r.error) { window.alert("No se pudo desactivar: vuelve a iniciar sesión e inténtalo de nuevo."); return; }
        cuenta(el, sb);
      };
      return;
    }
    el.innerHTML = '<p style="margin:0 0 12px">Protege tu cuenta: además de la contraseña te pediremos un código de 6 dígitos de una app como Google Authenticator o Authy.</p>' +
      '<button type="button" class="btn btn-primary" id="mfa-on">Activar verificación en dos pasos</button>';
    el.querySelector("#mfa-on").onclick = async function () {
      // Borra intentos a medias (factores sin verificar) para poder empezar de nuevo.
      (f.data && f.data.all || []).filter(function (x) { return x.status !== "verified"; })
        .forEach(function (x) { sb.auth.mfa.unenroll({ factorId: x.id }); });
      var e = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "FORXA " + Date.now() });
      if (e.error) { window.alert("No se pudo iniciar la activación: " + e.error.message); return; }
      el.innerHTML = '<ol style="margin:0 0 12px;padding-left:18px;font-size:14px"><li>Abre tu app de autenticación y escanea este código QR.</li><li>Escribe el código de 6 dígitos que aparece.</li></ol>' +
        '<img alt="Código QR para la app de autenticación" width="180" height="180" style="display:block;background:#fff;padding:8px;border-radius:8px">' +
        '<p style="font-size:12px;color:#4a5568;word-break:break-all">¿No puedes escanear? Escribe esta clave: <code></code></p>';
      el.querySelector("img").src = e.data.totp.qr_code;
      el.querySelector("code").textContent = e.data.totp.secret;
      for (var i = 0; i < 5; i++) {
        var r = await pedirCodigo("Confirmar verificación", i ? "Código incorrecto. Prueba con el código actual." : "Escribe el código de 6 dígitos que muestra tu app.");
        if (!r) { await sb.auth.mfa.unenroll({ factorId: e.data.id }); return cuenta(el, sb); }
        var v = await sb.auth.mfa.challengeAndVerify({ factorId: e.data.id, code: r.code });
        if (!v.error) { window.alert("¡Listo! La verificación en dos pasos está activada."); return cuenta(el, sb); }
      }
      await sb.auth.mfa.unenroll({ factorId: e.data.id });
      cuenta(el, sb);
    };
  }

  window.FORXA_MFA = { asegurar: asegurar, cuenta: cuenta };
})();
