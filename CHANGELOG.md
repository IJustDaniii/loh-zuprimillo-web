# Historial de cambios

## Corrección de despliegue — 2026-09-07

### Corregido

- Eliminada la configuración local `script-shell=powershell.exe` que impedía instalar dependencias en el entorno Linux de Cloudflare Workers Builds.
- Los comandos de build, comprobación y despliegue usan ahora Node y son independientes del shell del sistema.

## 0.1.0 — 2026-09-07

### Añadido

- Primera versión funcional privada con identidad, feed, medios R2, comentarios, reacciones, perfiles, lore, mapa, juegos, notificaciones y administración.
- Esquema D1, datos de los diez miembros, catálogos iniciales y documentación de despliegue.

### Seguridad

- Sesiones hasheadas, CSRF, control de permisos, login limitado, bucket privado, validación de archivos y cabeceras restrictivas.
