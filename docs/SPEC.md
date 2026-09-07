# Especificación: LOH ZUPRIMILLO' v0.1

## Objetivo

Red social privada, no indexable y ampliable para diez miembros predefinidos. Nadie no autenticado puede descargar la aplicación ni consultar datos o archivos. Dani administra personas, accesos, contenido y catálogos sin editar código.

## Arquitectura y stack

- Cloudflare Worker TypeScript: API y barrera de autenticación ante los assets.
- D1/SQLite: datos relacionales y migraciones SQL legibles.
- R2 privado: medios y documentos, servidos solo por el Worker tras autorizar.
- React + Vite: SPA responsive y accesible, sin framework de estilos opaco.
- Hono + Zod: rutas modulares y validación en los límites.
- Leaflet + OpenStreetMap: mapa; Nominatim solo mediante búsqueda explícita y con atribución.

## Comandos

- Desarrollo UI: `npm run dev`
- Worker local: `npx wrangler dev`
- Migración local: `npm run db:migrate:local`
- Pruebas: `npm test`
- Tipos: `npm run typecheck`
- Build: `npm run build`
- Despliegue: `npm run deploy`

## Estructura

- `worker/`: API, autenticación, persistencia y medios.
- `src/`: interfaz React, componentes, páginas y estilos.
- `shared/`: contratos y validadores compartidos.
- `migrations/`: esquema D1 y datos iniciales.
- `tests/`: pruebas unitarias de reglas sensibles.
- `docs/`: decisiones, modelo de amenazas y despliegue.

## Convenciones

TypeScript estricto, nombres explícitos, rutas REST bajo `/api`, errores `{ error: { code, message } }`, SQL siempre parametrizado y componentes pequeños. IDs aleatorios (`crypto.randomUUID()`) y fechas ISO UTC.

## Pruebas

Vitest para validación, permisos y criptografía. `wrangler dev` para integración D1/R2. Navegador real para autenticación, publicación, administración, mapa y responsive (320/768/1024/1440 px).

## Límites

- Siempre: autenticar antes de datos/assets; autorizar cada mutación; validar entrada; registrar acciones administrativas; cabeceras privadas.
- Consultar antes en evoluciones: proveedores externos, nuevos datos personales, cambios de autenticación o límites de subida.
- Nunca: secretos en Git, bucket público, tokens en `localStorage`, HTML de usuario sin escapar, URL permanente de R2.

## Criterios de éxito de v0.1

1. Un miembro canjea su invitación, elige contraseña, inicia sesión en varios dispositivos y revoca sesiones.
2. Dani genera/revoca invitaciones y administra los diez accesos.
3. Miembros crean/editan/eliminan publicaciones con metadatos y adjuntos reales; comentan, responden y reaccionan.
4. Perfiles, búsqueda, filtros, notificaciones, lore moderado, timeline, mapa, encuestas y juegos usan D1.
5. El panel admin permite CRUD/moderación de los catálogos y datos esenciales.
6. R2 no es público y todo objeto se entrega con autorización, expiración lógica y cabeceras anti-cache/anti-embed.
7. Build, tipos y pruebas pasan; documentación permite desplegar sin secretos en el repositorio.

## Decisiones de alcance

La interfaz dificulta descarga/arrastre/menú contextual, pero la documentación declara que un destinatario autorizado siempre puede capturar lo que ve. En v0.1 el geocodificado es una acción explícita (no consulta por pulsación) para respetar el servicio gratuito. Los rankings se calculan desde XP y actividad; las batallas y trivias tienen modelos persistentes extensibles.

