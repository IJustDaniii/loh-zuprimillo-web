# Contrato HTTP resumido
Todas las respuestas de error tienen `{ "error": { "code", "message", "details?" } }`. Todas las rutas salvo login, canje e inicialización requieren sesión. `POST`, `PATCH` y `DELETE` autenticados requieren `X-CSRF-Token`.

## Identidad

- `POST /api/auth/bootstrap` — activa a Dani una sola vez.
- `POST /api/auth/claim` — consume una invitación y activa la cuenta.
- `POST /api/auth/login` / `POST /api/auth/logout`.
- `GET /api/auth/me`.
- `DELETE /api/auth/sessions/:id`.

## Social y medios

- `GET|POST /api/posts`, `GET|PATCH|DELETE /api/posts/:id`.
- `POST /api/posts/:id/comments`.
- `POST /api/posts/:id/reactions/:reactionId` (alterna la reacción).
- `POST /api/media`, `GET /api/media/:id`.
- `GET /api/members/:handle`, `PATCH /api/profile`, `PATCH /api/profile/avatar`.

## Comunidad

- `GET|POST /api/lore`, `GET /api/map`.
- `GET|POST /api/polls`, `POST /api/polls/:id/votes`.
- `GET /api/games`, respuestas de trivia y votos de batalla bajo `/api/games/*`.
- `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/activity`.

## Dani

Todo `/api/admin/*` requiere rol `ADMIN`: resumen agregado, usuarios, sesiones, invitaciones, lore, publicaciones, comentarios, ubicaciones, encuestas, batallas, ajustes, catálogos, asignación de logros y ganadores.
