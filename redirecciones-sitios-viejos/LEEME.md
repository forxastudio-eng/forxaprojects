# Redirigir los sitios viejos de Netlify

Cuando la plataforma nueva esté funcionando, cada sitio viejo debe mandar a
sus visitantes a la dirección nueva (así no se pierden enlaces compartidos,
anuncios ni códigos QR).

En el repositorio de GitHub de **cada sitio viejo**, reemplaza todo su
contenido por un único archivo `netlify.toml` como el de abajo (cambia
`forxainmobiliaria.com` por tu dominio final y la ruta por la del proyecto):

| Sitio viejo | Ruta nueva |
|---|---|
| Álabes | `/alabes/` |
| Arcus | `/arcus/` |
| Portón del Valle | `/porton/` |
| Cotizador | `/cotizador/` |
| Portafolio (proyectosforxa) | `/` |
| Dashboard de marketing | `/marketing/` |

```toml
[build]
  publish = "."
  command = ""

[[redirects]]
  from = "/*"
  to = "https://forxainmobiliaria.com/alabes/:splat"
  status = 301
  force = true
```

Mantén los sitios viejos redirigiendo al menos unos meses. Después puedes
archivar esos repositorios en GitHub (Settings → Archive) y pausar los
proyectos viejos de Supabase (no los borres hasta confirmar que no falta nada).
