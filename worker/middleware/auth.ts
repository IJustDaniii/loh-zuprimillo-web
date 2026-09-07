import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { SessionView } from "../../shared/contracts";
import { sha256 } from "../lib/crypto";
import { memberFromRow } from "../lib/db";
import { AppError } from "../lib/http";
import type { AppEnv } from "../types";

export const SESSION_COOKIE = "__Host-lohz_session";
export const CSRF_COOKIE = "__Host-lohz_csrf";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token)
    throw new AppError(401, "AUTH_REQUIRED", "Inicia sesión para continuar.");
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT s.id session_id,s.device_name,s.created_at session_created_at,s.last_seen_at,s.expires_at,s.csrf_hash,
    u.id,u.handle,u.display_name,u.role,u.status,u.bio,u.avatar_media_id,u.xp
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') LIMIT 1`,
  )
    .bind(tokenHash)
    .first<any>();
  if (!row || row.status !== "ACTIVE")
    throw new AppError(
      401,
      "SESSION_INVALID",
      "La sesión ha caducado o fue revocada.",
    );
  c.set("member", memberFromRow(row));
  c.set("session", {
    id: row.session_id,
    deviceName: row.device_name,
    createdAt: row.session_created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    isCurrent: true,
  } satisfies SessionView);
  c.set("csrfHash", row.csrf_hash);
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      "UPDATE sessions SET last_seen_at=datetime('now') WHERE id=? AND datetime(last_seen_at)<datetime('now','-5 minutes')",
    )
      .bind(row.session_id)
      .run(),
  );
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("member").role !== "ADMIN")
    throw new AppError(403, "ADMIN_REQUIRED", "Esta zona es solo para Dani.");
  await next();
});

export const requireCsrf = createMiddleware<AppEnv>(async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return next();
  const origin = c.req.header("Origin");
  const currentOrigin = new URL(c.req.url).origin;
  if (!origin || (origin !== currentOrigin && origin !== c.env.APP_ORIGIN))
    throw new AppError(403, "BAD_ORIGIN", "Origen de petición no permitido.");
  const token = getCookie(c, CSRF_COOKIE);
  const header = c.req.header("X-CSRF-Token");
  if (
    !token ||
    !header ||
    token !== header ||
    (await sha256(token)) !== c.get("csrfHash")
  )
    throw new AppError(
      403,
      "CSRF_FAILED",
      "La protección de la sesión no coincide. Recarga la página.",
    );
  await next();
});
