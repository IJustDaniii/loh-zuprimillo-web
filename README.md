# LOH ZUPRIMILLO'

Red social privada para Dani, Adri, Gonzalo, Carlos, Patri, Agustín, Iker, Javi O., Álvaro y Rafa. Es una aplicación real para Cloudflare Workers: React en el navegador, D1 para datos y un bucket R2 privado para archivos.

## Qué incluye esta versión

- Acceso cerrado: diez cuentas precargadas, sin registro, invitaciones de un solo uso, contraseña y sesiones por dispositivo.
- Panel de Dani: accesos, sesiones, invitaciones, publicaciones, comentarios, ubicaciones, encuestas, propuestas de lore, destacados, catálogos, configuración y auditoría.
- Feed: texto, enlaces, fotos, GIF, vídeo, audio y documentos; título y fecha obligatorios; contexto, personas, lugar, etiquetas y desenlace opcionales.
- Conversación: reacciones configurables, comentarios anidados, menciones y adjuntos.
- Comunidad: perfiles, avatar, biografía, XP, nivel, logros y premios.
- Memoria: wiki moderada, timeline y mapa de publicaciones.
- Juegos: encuestas, clip aleatorio, batallas, ranking, “Quién dijo esto” y “¿De qué año es?”.
- Experiencia: diseño responsive, navegación móvil, claro/oscuro/automático, estados vacíos y controles de teclado.

## Arquitectura

```text
Navegador (React)
        │ cookie HttpOnly + CSRF
        ▼
Cloudflare Worker ─── D1 (cuentas, relaciones, catálogos)
        │
        └──────────── R2 privado (bytes de medios)
```

El Worker se ejecuta antes que los assets. La aplicación pública solo contiene el formulario de acceso y código de interfaz; no incorpora contenido de miembros. Toda ruta `/api`, incluida `/api/media/:id`, exige una sesión activa. R2 no necesita ni debe tener dominio público.

## Desarrollo local

Requisitos: Node.js 22 o posterior y una cuenta de Cloudflare para desplegar (no hace falta para el modo local).

Este repositorio incluye `.npmrc` para ejecutar scripts con PowerShell porque el equipo Windows actual tiene una entrada `PATH` heredada mal formada. Si lo abres en macOS o Linux, elimina la línea `script-shell` de ese archivo.

```bash
npm install
copy .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npx wrangler dev
```

Abre `http://localhost:8787`, pulsa **Inicializar Dani**, introduce el `BOOTSTRAP_TOKEN` de `.dev.vars` y elige una contraseña de al menos 10 caracteres. Esta operación solo funciona una vez.

Para trabajar con recarga rápida de React, usa dos terminales:

```bash
npx wrangler dev --port 8787
npm run dev
```

Abre `http://localhost:5173`; Vite envía `/api` al Worker.

## Despliegue en Cloudflare

1. Instala dependencias e inicia sesión:

   ```bash
   npm install
   npx wrangler login
   ```

2. Crea la base y el bucket:

   ```bash
   npx wrangler d1 create loh-zuprimillo-db
   npx wrangler r2 bucket create loh-zuprimillo-media
   ```

3. Copia el UUID devuelto por D1 en `database_id` de `wrangler.jsonc`. No cambies los bindings `DB`, `MEDIA` ni `ASSETS`.

4. Aplica el esquema remoto y despliega:

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

5. Genera un token aleatorio de 32 bytes, guárdalo como secreto y no lo añadas a ningún archivo versionado:

   ```bash
   npx wrangler secret put BOOTSTRAP_TOKEN
   ```

6. Visita la URL del Worker, inicializa a Dani y después elimina el secreto inicial:

   ```bash
   npx wrangler secret delete BOOTSTRAP_TOKEN
   ```

7. En R2, confirma que el acceso público y `r2.dev` están desactivados. Si usas dominio propio, configura la ruta del Worker en modo **fail closed**: jamás debe saltarse el Worker al alcanzar el límite.

## Primer uso

1. Dani entra en **Administración → Accesos**.
2. Elige a una persona y genera una invitación. El código solo se devuelve esa vez.
3. La persona abre la web, pulsa **Tengo invitación**, pega el código y crea su contraseña.
4. Para otro dispositivo usa su usuario y contraseña normales; cada dispositivo crea una sesión independiente.
5. Dani puede suspender la cuenta o revocar cualquier sesión. Cada usuario también puede cerrar su sesión actual.

## Seguridad y privacidad

- Contraseñas: PBKDF2-SHA-256 de Web Crypto, 310.000 iteraciones y sal aleatoria individual.
- Sesiones: token aleatorio de 256 bits; solo su SHA-256 llega a D1; cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- Mutaciones: token CSRF de doble envío ligado a la sesión y verificación de `Origin`.
- Login: límite combinado por usuario e IP, sin usar la IP como identidad.
- Archivos: tipo, tamaño y firma binaria validados; claves R2 opacas; autorización en cada lectura; rangos privados para streaming; `no-store`, `nosniff`, `Content-Disposition: inline` y sin URLs públicas.
- Navegador: CSP, HSTS, denegación de iframes, `noindex`, sin botón de descarga, sin arrastre, menú contextual bloqueado sobre medios y `controlsList=nodownload`.
- Permisos: autor o Dani para editar/eliminar publicaciones; solo Dani para administración; el rol se comprueba en D1.
- Auditoría: inicialización, inicios de sesión, invitaciones y acciones administrativas quedan registradas sin tokens ni contraseñas.

Estas medidas dificultan la extracción casual, pero ninguna web puede impedir que un miembro autorizado haga una captura, una grabación de pantalla o una foto externa.

La búsqueda de lugares es manual: solo consulta Nominatim al pulsar **Buscar**, no hace autocompletado por pulsación. La consulta sale del sistema y queda sujeta a la privacidad de OpenStreetMap; no introduzcas direcciones confidenciales. La política pública prohíbe usar Nominatim como autocompletado y limita el uso a una petición por segundo: [política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

## Coste previsto

Para diez personas debería caber holgadamente en las capas gratuitas si los vídeos se mantienen razonables. A septiembre de 2026, Workers Free incluye 100.000 peticiones al día; D1, 5 millones de filas leídas/día, 100.000 escritas/día y 5 GB; R2 Standard, 10 GB-mes, 1 millón de operaciones A y 10 millones B al mes, sin coste de salida. Comprueba siempre las páginas actuales de [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/) y [R2](https://developers.cloudflare.com/r2/pricing/).

El límite inicial por archivo es 50 MB y Dani puede cambiarlo en Ajustes (máximo 250 MB en la aplicación, aunque el plan Cloudflare puede imponer uno menor). Para vídeos grandes, la siguiente ampliación sensata es subida multiparte directa con URL firmada corta.

## Comandos de calidad

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Las decisiones de alcance están en [`docs/SPEC.md`](docs/SPEC.md), el mapa de módulos en [`docs/CAPABILITY-MAP.md`](docs/CAPABILITY-MAP.md) y el análisis de amenazas en [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md).

## Cómo ampliar

- Nueva reacción, etiqueta, logro, premio o trivia: **Administración → Catálogos**.
- Nueva configuración: añade una fila a `app_settings` en una migración y su control correspondiente si requiere UI específica.
- Nueva función: crea una ruta pequeña en `worker/routes`, el componente/página en `src`, un contrato en `shared` y una migración incremental; no edites `0001_initial.sql` una vez esté en producción.
- Los objetos R2 se referencian por `media.id`; nunca guardes URLs externas permanentes.
