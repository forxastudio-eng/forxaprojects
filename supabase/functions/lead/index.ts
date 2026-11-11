// FORXA · Edge Function "lead": recibe los formularios de las landings, valida
// Cloudflare Turnstile y guarda en public.leads con la service role. El navegador
// nunca escribe la tabla directo. Sin el secreto TURNSTILE_SECRET la función falla
// cerrada (500): una función pública sin verificación se llenaría de spam.
// Secretos (Supabase → Edge Functions → Secrets): TURNSTILE_SECRET.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN_OK = /^https:\/\/((www\.)?forxainmobiliaria\.com|[a-z0-9-]+--[a-z0-9-]+\.netlify\.app|[a-z0-9-]+\.netlify\.app)$|^http:\/\/localhost(:\d+)?$/;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ORIGIN_OK.test(origin) ? origin : "https://forxainmobiliaria.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const txt = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  const out = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out(405, { error: "Método no permitido" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return out(400, { error: "JSON inválido" }); }

  if (txt(b.website, 10)) return out(200, { ok: true }); // honeypot: los bots llenan el campo oculto

  const proyecto = txt(b.proyecto, 30);
  const nombre = txt(b.nombre, 120);
  const telefono = txt(b.telefono, 30)?.replace(/[^\d+ ()-]/g, "") || null;
  if (!proyecto || !/^[a-z0-9-]{2,30}$/.test(proyecto)) return out(400, { error: "Proyecto inválido" });
  if (!nombre || !telefono || telefono.replace(/\D/g, "").length < 7) return out(400, { error: "Nombre y teléfono son obligatorios" });
  const email = txt(b.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out(400, { error: "Correo inválido" });
  const fv = txt(b.fecha_visita, 10);
  const fecha_visita = fv && /^\d{4}-\d{2}-\d{2}$/.test(fv) ? fv : null;

  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) { console.error("Falta el secreto TURNSTILE_SECRET"); return out(500, { error: "Servicio no configurado" }); }
  {
    const token = txt(b.turnstile, 2048);
    if (!token) return out(400, { error: "Falta la verificación anti-spam" });
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0];
    if (ip) form.append("remoteip", ip);
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })
      .then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return out(403, { error: "Verificación anti-spam fallida" });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Evita duplicados por doble clic: mismo teléfono y proyecto en los últimos 2 minutos.
  const desde = new Date(Date.now() - 120_000).toISOString();
  const dup = await db.from("leads").select("id").eq("telefono", telefono).eq("proyecto", proyecto).gte("created_at", desde).limit(1);
  if (dup.data?.length) return out(200, { ok: true, duplicado: true });

  const { error } = await db.from("leads").insert({
    tipo: fecha_visita ? "visita" : "informacion",
    proyecto, nombre, telefono, email, fecha_visita,
    interes: txt(b.interes, 160),
    mensaje: txt(b.mensaje, 2000),
    fuente: txt(b.fuente, 500),
  });
  if (error) { console.error(error); return out(500, { error: "No se pudo guardar" }); }
  return out(200, { ok: true });
});
