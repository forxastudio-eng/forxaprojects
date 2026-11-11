// FORXA · Administración de cuentas (solo rol EDITOR).
//   accion "listar"            → estado de la cuenta de cada correo con rol
//   accion "asignar_password"  → asigna una contraseña nueva (crea la cuenta si no existe)
// La clave maestra (service role) solo vive aquí, en el servidor; nunca en el sitio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Misma regla que Authentication → Email y que el panel: la API de administración no la aplica sola.
const claveValida = (c: string) => c.length >= 10 && /[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c);

async function todosLosUsuarios() {
  const out: { id: string; email: string; last_sign_in_at: string | null }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => out.push({ id: u.id, email: (u.email || "").toLowerCase(), last_sign_in_at: u.last_sign_in_at ?? null }));
    if (data.users.length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // 1) ¿Quién llama? Se valida su sesión con Supabase Auth.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quien, error: errUser } = await admin.auth.getUser(token);
    if (errUser || !quien?.user?.email) return json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, 401);
    const emailEditor = quien.user.email.toLowerCase();

    // 2) Solo el rol editor puede usar esta función.
    const { data: rol } = await admin.from("user_roles").select("role").eq("email", emailEditor).maybeSingle();
    if (rol?.role !== "editor") return json({ error: "Solo el rol editor puede administrar contraseñas." }, 403);

    const body = await req.json();

    if (body.accion === "listar") {
      const usuarios = await todosLosUsuarios();
      const estado: Record<string, { cuenta: boolean; ultimo_ingreso: string | null }> = {};
      usuarios.forEach((u) => { estado[u.email] = { cuenta: true, ultimo_ingreso: u.last_sign_in_at }; });
      return json({ estado });
    }

    if (body.accion === "asignar_password") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email) return json({ error: "Falta el correo." }, 400);
      if (!claveValida(password)) return json({ error: "Mínimo 10 caracteres, con mayúsculas, minúsculas y números." }, 400);

      // Solo se administran correos que tienen un rol asignado en el panel.
      const { data: conRol } = await admin.from("user_roles").select("email").eq("email", email).maybeSingle();
      if (!conRol) return json({ error: "Ese correo no tiene un rol asignado. Agrégalo primero en Usuarios y roles." }, 400);

      const existente = (await todosLosUsuarios()).find((u) => u.email === email);
      let creada = false;
      if (existente) {
        const { error } = await admin.auth.admin.updateUserById(existente.id, { password });
        if (error) throw error;
      } else {
        const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
        creada = true;
      }
      await admin.from("actividad").insert({
        email: emailEditor, accion: "rol",
        detalle: (creada ? "Cuenta creada con contraseña para " : "Nueva contraseña asignada a ") + email,
      });
      return json({ ok: true, creada });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "No se pudo completar la acción. Intenta de nuevo." }, 500);
  }
});
