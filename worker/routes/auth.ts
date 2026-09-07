import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { claimInviteSchema, loginSchema } from "../../shared/schemas";
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "../lib/crypto";
import { audit, memberFromRow } from "../lib/db";
import { AppError, jsonBody } from "../lib/http";
import {
  CSRF_COOKIE,
  requireAuth,
  requireCsrf,
  SESSION_COOKIE,
} from "../middleware/auth";
import type { AppEnv } from "../types";

const auth = new Hono<AppEnv>();

auth.use("*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    const currentOrigin = new URL(c.req.url).origin;
    if (!origin || (origin !== currentOrigin && origin !== c.env.APP_ORIGIN))
      throw new AppError(403, "BAD_ORIGIN", "Origen de petición no permitido.");
  }
  await next();
});

function cookieOptions(c: any, httpOnly: boolean, expires: Date) {
  return {
    httpOnly,
    secure: true,
    sameSite: "Strict" as const,
    path: "/",
    expires,
  };
}

async function createSession(c: any, userId: string, deviceName?: string) {
  const token = randomToken();
  const csrf = randomToken();
  const days = Math.max(1, Math.min(90, Number(c.env.SESSION_TTL_DAYS) || 30));
  const expires = new Date(Date.now() + days * 86_400_000);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO sessions (id,user_id,token_hash,csrf_hash,device_name,user_agent,expires_at) VALUES (?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      userId,
      await sha256(token),
      await sha256(csrf),
      deviceName?.trim() || "Mi dispositivo",
      (c.req.header("User-Agent") ?? "").slice(0, 300),
      expires.toISOString(),
    )
    .run();
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, true, expires));
  setCookie(c, CSRF_COOKIE, csrf, cookieOptions(c, false, expires));
  return id;
}

async function assertNotLocked(db: D1Database, keyHash: string) {
  const row = await db
    .prepare(
      "SELECT failures,locked_until FROM auth_attempts WHERE key_hash=? AND datetime(window_started_at)>datetime('now','-15 minutes')",
    )
    .bind(keyHash)
    .first<any>();
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now())
    throw new AppError(
      429,
      "LOGIN_LOCKED",
      "Demasiados intentos. Espera 15 minutos.",
    );
}

async function recordFailure(db: D1Database, keyHash: string) {
  await db
    .prepare(
      `INSERT INTO auth_attempts (key_hash,failures,window_started_at,locked_until) VALUES (?,1,datetime('now'),NULL)
    ON CONFLICT(key_hash) DO UPDATE SET failures=CASE WHEN datetime(window_started_at)<=datetime('now','-15 minutes') THEN 1 ELSE failures+1 END,
    window_started_at=CASE WHEN datetime(window_started_at)<=datetime('now','-15 minutes') THEN datetime('now') ELSE window_started_at END,
    locked_until=CASE WHEN failures>=4 AND datetime(window_started_at)>datetime('now','-15 minutes') THEN datetime('now','+15 minutes') ELSE NULL END`,
    )
    .bind(keyHash)
    .run();
}

auth.post("/bootstrap", async (c) => {
  const input = await jsonBody(
    c,
    z.object({
      token: z.string().min(20),
      password: z.string().min(10).max(200),
      deviceName: z.string().max(80).optional(),
    }),
  );
  if (
    !c.env.BOOTSTRAP_TOKEN ||
    (await sha256(input.token)) !== (await sha256(c.env.BOOTSTRAP_TOKEN))
  )
    throw new AppError(403, "BOOTSTRAP_DENIED", "Token inicial incorrecto.");
  const dani = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id='usr_dani'",
  ).first<any>();
  if (!dani || dani.password_hash)
    throw new AppError(
      409,
      "ALREADY_BOOTSTRAPPED",
      "La administración ya fue inicializada.",
    );
  const password = await hashPassword(input.password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash=?,password_salt=?,status='ACTIVE',updated_at=datetime('now') WHERE id='usr_dani'",
  )
    .bind(password.hash, password.salt)
    .run();
  await createSession(c, "usr_dani", input.deviceName);
  await audit(c.env.DB, "usr_dani", "BOOTSTRAP_COMPLETED", "user", "usr_dani");
  return c.json({ member: memberFromRow({ ...dani, status: "ACTIVE" }) }, 201);
});

auth.post("/claim", async (c) => {
  const input = await jsonBody(c, claimInviteSchema);
  const codeHash = await sha256(input.code);
  const invitation = await c.env.DB.prepare(
    `SELECT i.*,u.password_hash FROM invitations i JOIN users u ON u.id=i.user_id
    WHERE i.code_hash=? AND i.used_at IS NULL AND i.revoked_at IS NULL AND datetime(i.expires_at)>datetime('now')`,
  )
    .bind(codeHash)
    .first<any>();
  if (!invitation)
    throw new AppError(
      404,
      "INVITE_INVALID",
      "La invitación no existe, caducó o ya fue usada.",
    );
  if (invitation.password_hash)
    throw new AppError(
      409,
      "ACCOUNT_ACTIVE",
      "La cuenta ya está activa; inicia sesión.",
    );
  const password = await hashPassword(input.password);
  const claimed = await c.env.DB.prepare(
    "UPDATE invitations SET used_at=datetime('now') WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') RETURNING user_id",
  )
    .bind(invitation.id)
    .first<{ user_id: string }>();
  if (!claimed)
    throw new AppError(
      409,
      "INVITE_ALREADY_USED",
      "La invitación acaba de ser usada o revocada.",
    );
  await c.env.DB.prepare(
    "UPDATE users SET password_hash=?,password_salt=?,status='ACTIVE',updated_at=datetime('now') WHERE id=? AND password_hash IS NULL",
  )
    .bind(password.hash, password.salt, claimed.user_id)
    .run();
  await createSession(c, invitation.user_id, input.deviceName);
  await audit(
    c.env.DB,
    invitation.user_id,
    "INVITE_CLAIMED",
    "invitation",
    invitation.id,
  );
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id=?")
    .bind(invitation.user_id)
    .first<any>();
  return c.json({ member: memberFromRow(user) }, 201);
});

auth.post("/login", async (c) => {
  const input = await jsonBody(c, loginSchema);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const rateKey = await sha256(`${input.handle.toLowerCase()}|${ip}`);
  await assertNotLocked(c.env.DB, rateKey);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE handle=? COLLATE NOCASE",
  )
    .bind(input.handle)
    .first<any>();
  const valid =
    user?.password_hash && user?.password_salt
      ? await verifyPassword(
          input.password,
          user.password_salt,
          user.password_hash,
        )
      : false;
  if (!valid || user.status !== "ACTIVE") {
    await recordFailure(c.env.DB, rateKey);
    throw new AppError(
      401,
      "LOGIN_FAILED",
      "Usuario o contraseña incorrectos.",
    );
  }
  await c.env.DB.prepare("DELETE FROM auth_attempts WHERE key_hash=?")
    .bind(rateKey)
    .run();
  await createSession(c, user.id, input.deviceName);
  await audit(c.env.DB, user.id, "LOGIN", "session");
  return c.json({ member: memberFromRow(user) });
});

auth.use("/me", requireAuth);
auth.get("/me", (c) =>
  c.json({ member: c.get("member"), session: c.get("session") }),
);

auth.use("/logout", requireAuth, requireCsrf);
auth.post("/logout", async (c) => {
  await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at=datetime('now') WHERE id=?",
  )
    .bind(c.get("session").id)
    .run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  deleteCookie(c, CSRF_COOKIE, { path: "/" });
  return c.body(null, 204);
});

auth.use("/sessions/*", requireAuth, requireCsrf);
auth.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at=datetime('now') WHERE id=? AND user_id=? AND revoked_at IS NULL",
  )
    .bind(id, c.get("member").id)
    .run();
  if (!result.meta.changes)
    throw new AppError(
      404,
      "SESSION_NOT_FOUND",
      "No existe esa sesión activa.",
    );
  if (id === c.get("session").id) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    deleteCookie(c, CSRF_COOKIE, { path: "/" });
  }
  return c.body(null, 204);
});

export default auth;
