/* ==========================================================================
   FORXA · Configuración ÚNICA de Supabase para toda la plataforma
   (landing principal, Álabes, Arcus, Portón, cotizador, marketing y panel).
   Reemplaza los dos valores con los de tu proyecto nuevo:
   Supabase → Project Settings → API → Project URL y "anon public" key.
   La anon key es pública por diseño; la seguridad la dan las políticas RLS
   (supabase/06_politicas.sql). NUNCA pongas aquí la service_role key.
   ========================================================================== */
var SUPABASE_URL = "https://nvbqfckuqpdjterypszb.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52YnFmY2t1cXBkanRlcnlwc3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjM3MDMsImV4cCI6MjEwNTU5OTcwM30.wKBSHlowPZArWYvGV_J3pmAmQnJ0pwOWkDZBL7BMMeE";

window.FORXA_CONFIG = {
  SUPABASE_URL: SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  WHATSAPP: "593939087030",
  LOGIN_URL: "/admin/"
};
