import { Hono } from "hono";
import { z } from "zod";
import { invitationSchema } from "../../shared/schemas";
import { audit, deleteLoreEntry } from "../lib/db";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError, jsonBody } from "../lib/http";
import {
  getStorageUsage,
  MAX_D1_LIMIT_MB,
  MAX_R2_LIMIT_MB,
  parseLimitMb,
} from "../lib/storage";
import { requireAdmin, requireAuth, requireCsrf } from "../middleware/auth";
import type { AppEnv } from "../types";

const admin = new Hono<AppEnv>();
admin.use("*", requireAuth, requireAdmin);

admin.get("/overview", async (c) => {
  const [
    counts,
    users,
    invitations,
    sessions,
    lore,
    approvedLore,
    posts,
    comments,
    media,
    locations,
    polls,
    battles,
    tags,
    reactions,
    achievements,
    awards,
    trivia,
    settings,
    auditRows,
    storage,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM users WHERE status='ACTIVE') active_users,(SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL) posts,(SELECT COUNT(*) FROM media) media,(SELECT COUNT(*) FROM lore_entries WHERE status='PENDING') pending_lore`,
    ).first(),
    c.env.DB.prepare(
      "SELECT id,handle,display_name,role,status,xp,created_at FROM users ORDER BY display_name",
    ).all(),
    c.env.DB.prepare(
      "SELECT i.id,i.user_id,u.display_name,i.expires_at,i.used_at,i.revoked_at,i.created_at FROM invitations i JOIN users u ON u.id=i.user_id ORDER BY i.created_at DESC LIMIT 50",
    ).all(),
    c.env.DB.prepare(
      `SELECT s.id,s.user_id,u.display_name,s.device_name,s.created_at,s.last_seen_at,s.expires_at,s.revoked_at FROM sessions s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 100`,
    ).all(),
    c.env.DB.prepare(
      "SELECT l.*,u.display_name proposer_name FROM lore_entries l JOIN users u ON u.id=l.proposer_id WHERE l.status='PENDING' ORDER BY l.created_at",
    ).all(),
    c.env.DB.prepare(
      "SELECT l.*,u.display_name proposer_name FROM lore_entries l JOIN users u ON u.id=l.proposer_id WHERE l.status='APPROVED' ORDER BY COALESCE(l.happened_at,l.created_at) DESC",
    ).all(),
    c.env.DB.prepare(
      "SELECT p.id,p.title,p.happened_at,p.is_featured,p.created_at,u.display_name author_name FROM posts p JOIN users u ON u.id=p.author_id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 50",
    ).all(),
    c.env.DB.prepare(
      "SELECT c.id,c.post_id,c.body,c.created_at,u.display_name author_name,p.title post_title FROM comments c JOIN users u ON u.id=c.author_id JOIN posts p ON p.id=c.post_id WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 50",
    ).all(),
    c.env.DB.prepare(
      "SELECT m.id,m.kind,m.mime_type,m.original_name,m.byte_size,m.post_id,m.comment_id,m.created_at,u.display_name owner_name FROM media m JOIN users u ON u.id=m.owner_id ORDER BY m.created_at DESC LIMIT 100",
    ).all(),
    c.env.DB.prepare(
      "SELECT l.*,(SELECT COUNT(*) FROM posts p WHERE p.location_id=l.id AND p.deleted_at IS NULL) usage_count FROM locations l ORDER BY l.created_at DESC",
    ).all(),
    c.env.DB.prepare(
      "SELECT p.*,(SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id=p.id) vote_count FROM polls p ORDER BY p.created_at DESC",
    ).all(),
    c.env.DB.prepare("SELECT * FROM battles ORDER BY created_at DESC").all(),
    c.env.DB.prepare("SELECT * FROM tags ORDER BY label").all(),
    c.env.DB.prepare("SELECT * FROM reactions ORDER BY sort_order").all(),
    c.env.DB.prepare("SELECT * FROM achievements ORDER BY title").all(),
    c.env.DB.prepare(
      "SELECT a.*,group_concat(u.display_name,', ') winners FROM awards a LEFT JOIN award_winners aw ON aw.award_id=a.id LEFT JOIN users u ON u.id=aw.user_id GROUP BY a.id ORDER BY a.year DESC",
    ).all(),
    c.env.DB.prepare(
      "SELECT id,kind,prompt,answer,options_json,is_active,created_at FROM trivia_questions ORDER BY created_at DESC",
    ).all(),
    c.env.DB.prepare("SELECT * FROM app_settings ORDER BY key").all(),
    c.env.DB.prepare(
      "SELECT a.*,u.display_name actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 50",
    ).all(),
    getStorageUsage(c.env.DB, c.env.MEDIA),
  ]);
  return c.json({
    counts,
    users: users.results,
    invitations: invitations.results,
    sessions: sessions.results,
    lore: lore.results,
    approvedLore: approvedLore.results,
    posts: posts.results,
    comments: comments.results,
    media: media.results,
    locations: locations.results,
    polls: polls.results,
    battles: battles.results,
    catalogs: {
      tags: tags.results,
      reactions: reactions.results,
      achievements: achievements.results,
      awards: awards.results,
      trivia: trivia.results,
    },
    settings: settings.results,
    audit: auditRows.results,
    storage,
  });
});

admin.post("/invitations", requireCsrf, async (c) => {
  const input = await jsonBody(c, invitationSchema);
  const user = await c.env.DB.prepare(
    "SELECT id,status,password_hash FROM users WHERE id=?",
  )
    .bind(input.userId)
    .first<any>();
  if (!user)
    throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");
  if (user.password_hash)
    throw new AppError(
      409,
      "USER_ALREADY_ACTIVE",
      "Esa persona ya tiene contraseña; puede iniciar sesión en otro dispositivo.",
    );
  const code = randomToken(32);
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 86_400_000,
  ).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE invitations SET revoked_at=datetime('now') WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL",
    ).bind(input.userId),
    c.env.DB.prepare(
      "INSERT INTO invitations (id,user_id,code_hash,created_by,expires_at) VALUES (?,?,?,?,?)",
    ).bind(id, input.userId, await sha256(code), c.get("member").id, expiresAt),
  ]);
  await audit(
    c.env.DB,
    c.get("member").id,
    "INVITATION_CREATED",
    "invitation",
    id,
    { userId: input.userId },
  );
  return c.json(
    { invitation: { id, userId: input.userId, code, expiresAt } },
    201,
  );
});

admin.delete("/invitations/:id", requireCsrf, async (c) => {
  await c.env.DB.prepare(
    "UPDATE invitations SET revoked_at=datetime('now') WHERE id=? AND used_at IS NULL",
  )
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "INVITATION_REVOKED",
    "invitation",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.patch("/users/:id", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({ status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]) }),
  );
  if (c.req.param("id") === "usr_dani" && input.status !== "ACTIVE")
    throw new AppError(
      422,
      "ADMIN_LOCKOUT",
      "No puedes suspender la única cuenta administradora.",
    );
  await c.env.DB.prepare(
    "UPDATE users SET status=?,updated_at=datetime('now') WHERE id=?",
  )
    .bind(input.status, c.req.param("id"))
    .run();
  if (input.status !== "ACTIVE")
    await c.env.DB.prepare(
      "UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL",
    )
      .bind(c.req.param("id"))
      .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "USER_STATUS_CHANGED",
    "user",
    c.req.param("id"),
    input,
  );
  return c.json({ ok: true });
});

admin.delete("/sessions/:id", requireCsrf, async (c) => {
  await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at=datetime('now') WHERE id=? AND revoked_at IS NULL",
  )
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "SESSION_REVOKED",
    "session",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.patch("/lore/:id", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({
      status: z.enum(["APPROVED", "REJECTED"]),
      reviewNote: z.string().trim().max(1000).default(""),
    }),
  );
  const lore = await c.env.DB.prepare(
    "SELECT * FROM lore_entries WHERE id=? AND status='PENDING'",
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!lore)
    throw new AppError(
      404,
      "LORE_NOT_PENDING",
      "La propuesta ya no está pendiente.",
    );
  await c.env.DB.prepare(
    "UPDATE lore_entries SET status=?,review_note=?,reviewer_id=?,reviewed_at=datetime('now') WHERE id=?",
  )
    .bind(input.status, input.reviewNote, c.get("member").id, lore.id)
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    `LORE_${input.status}`,
    "lore",
    lore.id,
  );
  return c.json({ ok: true });
});

admin.delete("/lore/:id", requireCsrf, async (c) => {
  const deleted = await deleteLoreEntry(c.env.DB, c.req.param("id"));
  if (!deleted)
    throw new AppError(404, "LORE_NOT_FOUND", "Entrada de lore no encontrada.");
  await audit(
    c.env.DB,
    c.get("member").id,
    "LORE_DELETED",
    "lore",
    deleted.id,
    { status: deleted.status },
  );
  return c.body(null, 204);
});

admin.patch("/posts/:id", requireCsrf, async (c) => {
  const input = await jsonBody(c, z.object({ isFeatured: z.boolean() }));
  await c.env.DB.prepare(
    "UPDATE posts SET is_featured=?,updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL",
  )
    .bind(input.isFeatured ? 1 : 0, c.req.param("id"))
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    input.isFeatured ? "POST_FEATURED" : "POST_UNFEATURED",
    "post",
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

admin.delete("/comments/:id", requireCsrf, async (c) => {
  await c.env.DB.prepare(
    "UPDATE comments SET deleted_at=datetime('now'),body='' WHERE id=?",
  )
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "COMMENT_DELETED",
    "comment",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.delete("/media/:id", requireCsrf, async (c) => {
  const media = await c.env.DB.prepare(
    "SELECT r2_key,byte_size FROM media WHERE id=?",
  )
    .bind(c.req.param("id"))
    .first<{ r2_key: string; byte_size: number }>();
  if (!media)
    throw new AppError(404, "MEDIA_NOT_FOUND", "Archivo no encontrado.");
  await c.env.MEDIA.delete(media.r2_key);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET avatar_media_id=NULL WHERE avatar_media_id=?",
    ).bind(c.req.param("id")),
    c.env.DB.prepare("DELETE FROM media WHERE id=?").bind(c.req.param("id")),
    c.env.DB.prepare(
      "UPDATE storage_usage SET r2_bytes=MAX(0,r2_bytes-?),r2_objects=MAX(0,r2_objects-1),updated_at=datetime('now') WHERE id=1",
    ).bind(media.byte_size),
  ]);
  await audit(
    c.env.DB,
    c.get("member").id,
    "MEDIA_DELETED",
    "media",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.delete("/locations/:id", requireCsrf, async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE posts SET location_id=NULL WHERE location_id=?",
    ).bind(c.req.param("id")),
    c.env.DB.prepare("DELETE FROM locations WHERE id=?").bind(
      c.req.param("id"),
    ),
  ]);
  await audit(
    c.env.DB,
    c.get("member").id,
    "LOCATION_DELETED",
    "location",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.patch("/settings/:key", requireCsrf, async (c) => {
  const input = await jsonBody(c, z.object({ value: z.unknown() }));
  const raw = JSON.stringify(input.value);
  const key = c.req.param("key");
  if (key === "r2_storage_limit_mb") {
    if (parseLimitMb(input.value, 0, MAX_R2_LIMIT_MB) === 0)
      throw new AppError(
        422,
        "R2_LIMIT_INVALID",
        `El lÃ­mite de R2 debe ser un nÃºmero entero entre 1 y ${MAX_R2_LIMIT_MB} MB.`,
      );
  }
  if (key === "d1_storage_limit_mb") {
    if (parseLimitMb(input.value, 0, MAX_D1_LIMIT_MB) === 0)
      throw new AppError(
        422,
        "D1_LIMIT_INVALID",
        `El lÃ­mite de D1 debe ser un nÃºmero entero entre 1 y ${MAX_D1_LIMIT_MB} MB.`,
      );
  }
  if (raw.length > 10_000)
    throw new AppError(
      422,
      "SETTING_TOO_LARGE",
      "El valor es demasiado grande.",
    );
  await c.env.DB.prepare(
    "UPDATE app_settings SET value_json=?,updated_by=?,updated_at=datetime('now') WHERE key=?",
  )
    .bind(raw, c.get("member").id, key)
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "SETTING_UPDATED",
    "setting",
    key,
  );
  return c.json({ ok: true });
});

const tagSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const reactionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  emoji: z.string().max(12).nullable().optional(),
  imageMediaId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});
const achievementSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,50}$/),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  icon: z.string().max(12).default("🏆"),
  xpReward: z.number().int().min(0).max(10000).default(0),
});
const awardSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  icon: z.string().max(12).default("🏅"),
});
const triviaSchema = z.object({
  kind: z.enum(["WHO_SAID", "WHICH_YEAR"]),
  prompt: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(8),
  sourcePostId: z.string().nullable().optional(),
});

admin.post("/catalog/:entity", requireCsrf, async (c) => {
  const entity = c.req.param("entity");
  const id = crypto.randomUUID();
  if (entity === "tags") {
    const v = await jsonBody(c, tagSchema);
    await c.env.DB.prepare(
      "INSERT INTO tags (id,slug,label,color) VALUES (?,?,?,?)",
    )
      .bind(id, v.slug, v.label, v.color)
      .run();
  } else if (entity === "reactions") {
    const v = await jsonBody(c, reactionSchema);
    await c.env.DB.prepare(
      "INSERT INTO reactions (id,slug,label,emoji,image_media_id,sort_order,is_active) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        v.slug,
        v.label,
        v.emoji ?? null,
        v.imageMediaId ?? null,
        v.sortOrder,
        v.isActive ? 1 : 0,
      )
      .run();
    if (v.imageMediaId)
      await c.env.DB.prepare("UPDATE media SET kind='REACTION' WHERE id=?")
        .bind(v.imageMediaId)
        .run();
  } else if (entity === "achievements") {
    const v = await jsonBody(c, achievementSchema);
    await c.env.DB.prepare(
      "INSERT INTO achievements (id,slug,title,description,icon,xp_reward) VALUES (?,?,?,?,?,?)",
    )
      .bind(id, v.slug, v.title, v.description, v.icon, v.xpReward)
      .run();
  } else if (entity === "awards") {
    const v = await jsonBody(c, awardSchema);
    await c.env.DB.prepare(
      "INSERT INTO awards (id,year,title,description,icon,created_by) VALUES (?,?,?,?,?,?)",
    )
      .bind(id, v.year, v.title, v.description, v.icon, c.get("member").id)
      .run();
  } else if (entity === "trivia") {
    const v = await jsonBody(c, triviaSchema);
    await c.env.DB.prepare(
      "INSERT INTO trivia_questions (id,kind,prompt,answer,options_json,source_post_id,created_by) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        v.kind,
        v.prompt,
        v.answer,
        JSON.stringify(v.options),
        v.sourcePostId ?? null,
        c.get("member").id,
      )
      .run();
  } else
    throw new AppError(404, "CATALOG_NOT_FOUND", "Catálogo no reconocido.");
  await audit(c.env.DB, c.get("member").id, "CATALOG_ITEM_CREATED", entity, id);
  return c.json({ id }, 201);
});

admin.patch("/catalog/:entity/:id", requireCsrf, async (c) => {
  const entity = c.req.param("entity");
  const id = c.req.param("id");
  if (entity === "tags") {
    const v = await jsonBody(c, tagSchema);
    await c.env.DB.prepare("UPDATE tags SET slug=?,label=?,color=? WHERE id=?")
      .bind(v.slug, v.label, v.color, id)
      .run();
  } else if (entity === "reactions") {
    const v = await jsonBody(c, reactionSchema);
    await c.env.DB.prepare(
      "UPDATE reactions SET slug=?,label=?,emoji=?,image_media_id=?,sort_order=?,is_active=? WHERE id=?",
    )
      .bind(
        v.slug,
        v.label,
        v.emoji ?? null,
        v.imageMediaId ?? null,
        v.sortOrder,
        v.isActive ? 1 : 0,
        id,
      )
      .run();
    if (v.imageMediaId)
      await c.env.DB.prepare("UPDATE media SET kind='REACTION' WHERE id=?")
        .bind(v.imageMediaId)
        .run();
  } else if (entity === "achievements") {
    const v = await jsonBody(c, achievementSchema);
    await c.env.DB.prepare(
      "UPDATE achievements SET slug=?,title=?,description=?,icon=?,xp_reward=? WHERE id=?",
    )
      .bind(v.slug, v.title, v.description, v.icon, v.xpReward, id)
      .run();
  } else if (entity === "awards") {
    const v = await jsonBody(c, awardSchema);
    await c.env.DB.prepare(
      "UPDATE awards SET year=?,title=?,description=?,icon=? WHERE id=?",
    )
      .bind(v.year, v.title, v.description, v.icon, id)
      .run();
  } else if (entity === "trivia") {
    const v = await jsonBody(c, triviaSchema);
    await c.env.DB.prepare(
      "UPDATE trivia_questions SET kind=?,prompt=?,answer=?,options_json=?,source_post_id=? WHERE id=?",
    )
      .bind(
        v.kind,
        v.prompt,
        v.answer,
        JSON.stringify(v.options),
        v.sourcePostId ?? null,
        id,
      )
      .run();
  } else
    throw new AppError(404, "CATALOG_NOT_FOUND", "Catálogo no reconocido.");
  await audit(c.env.DB, c.get("member").id, "CATALOG_ITEM_UPDATED", entity, id);
  return c.json({ ok: true });
});

admin.delete("/catalog/:entity/:id", requireCsrf, async (c) => {
  const tables: Record<string, string> = {
    tags: "tags",
    reactions: "reactions",
    achievements: "achievements",
    awards: "awards",
    trivia: "trivia_questions",
  };
  const table = tables[c.req.param("entity")];
  if (!table)
    throw new AppError(404, "CATALOG_NOT_FOUND", "Catálogo no reconocido.");
  try {
    await c.env.DB.prepare(`DELETE FROM ${table} WHERE id=?`)
      .bind(c.req.param("id"))
      .run();
  } catch {
    throw new AppError(
      409,
      "CATALOG_ITEM_IN_USE",
      "No se puede borrar porque ya está en uso. Desactívalo o quita sus relaciones.",
    );
  }
  await audit(
    c.env.DB,
    c.get("member").id,
    "CATALOG_ITEM_DELETED",
    c.req.param("entity"),
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.delete("/polls/:id", requireCsrf, async (c) => {
  await c.env.DB.prepare("DELETE FROM polls WHERE id=?")
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env.DB,
    c.get("member").id,
    "POLL_DELETED",
    "poll",
    c.req.param("id"),
  );
  return c.body(null, 204);
});

admin.patch("/battles/:id", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({ status: z.enum(["OPEN", "CLOSED"]) }),
  );
  await c.env.DB.prepare("UPDATE battles SET status=? WHERE id=?")
    .bind(input.status, c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

admin.post("/achievements/:id/award", requireCsrf, async (c) => {
  const input = await jsonBody(c, z.object({ userId: z.string().min(1) }));
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO user_achievements (user_id,achievement_id,awarded_by) VALUES (?,?,?)",
  )
    .bind(input.userId, c.req.param("id"), c.get("member").id)
    .run();
  return c.json({ ok: true });
});
admin.post("/awards/:id/winners", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({
      userId: z.string().min(1),
      note: z.string().trim().max(500).default(""),
    }),
  );
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO award_winners (award_id,user_id,note) VALUES (?,?,?)",
  )
    .bind(c.req.param("id"), input.userId, input.note)
    .run();
  return c.json({ ok: true });
});
admin.post("/battles", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z
      .object({
        title: z.string().trim().min(1).max(160),
        leftPostId: z.string().min(1),
        rightPostId: z.string().min(1),
      })
      .refine(
        (v) => v.leftPostId !== v.rightPostId,
        "Los clips deben ser distintos.",
      ),
  );
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO battles (id,title,left_post_id,right_post_id,created_by) VALUES (?,?,?,?,?)",
  )
    .bind(
      id,
      input.title,
      input.leftPostId,
      input.rightPostId,
      c.get("member").id,
    )
    .run();
  return c.json({ id }, 201);
});

export default admin;
