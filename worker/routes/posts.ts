import { Hono } from "hono";
import { z } from "zod";
import {
  commentSchema,
  createPostSchema,
  parsePage,
  updatePostSchema,
} from "../../shared/schemas";
import { addXp, hydratePosts, notify, postSelect } from "../lib/db";
import { AppError, jsonBody } from "../lib/http";
import { purgeMediaStorage } from "../lib/storage";
import { requireAuth, requireCsrf } from "../middleware/auth";
import type { AppEnv } from "../types";

const posts = new Hono<AppEnv>();
posts.use("*", requireAuth);

posts.get("/", async (c) => {
  const page = parsePage(c.req.query("page"));
  const pageSize = 20;
  const where = ["p.deleted_at IS NULL"];
  const values: unknown[] = [];
  const q = c.req.query("q")?.trim();
  if (q) {
    where.push("(p.title LIKE ? OR p.body LIKE ? OR p.description LIKE ?)");
    values.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const author = c.req.query("author");
  if (author) {
    where.push("p.author_id=?");
    values.push(author);
  }
  const tag = c.req.query("tag");
  if (tag) {
    where.push(
      "EXISTS (SELECT 1 FROM post_tags fpt WHERE fpt.post_id=p.id AND fpt.tag_id=?)",
    );
    values.push(tag);
  }
  const kind = c.req.query("kind");
  if (kind) {
    where.push(
      "EXISTS (SELECT 1 FROM media fm WHERE fm.post_id=p.id AND fm.kind=?)",
    );
    values.push(kind);
  }
  const year = c.req.query("year");
  if (year && /^\d{4}$/.test(year)) {
    where.push("strftime('%Y',p.happened_at)=?");
    values.push(year);
  }
  if (c.req.query("featured") === "true") where.push("p.is_featured=1");
  const clause = where.join(" AND ");
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) count FROM posts p WHERE ${clause}`,
  )
    .bind(...values)
    .first<{ count: number }>();
  const rows = await c.env.DB.prepare(
    `${postSelect} WHERE ${clause} ORDER BY p.is_featured DESC,p.happened_at DESC,p.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...values, pageSize, (page - 1) * pageSize)
    .all<any>();
  return c.json({
    data: await hydratePosts(c.env.DB, rows.results, c.get("member").id),
    pagination: {
      page,
      pageSize,
      totalItems: Number(total?.count ?? 0),
      totalPages: Math.ceil(Number(total?.count ?? 0) / pageSize),
    },
  });
});

posts.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `${postSelect} WHERE p.id=? AND p.deleted_at IS NULL`,
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!row)
    throw new AppError(404, "POST_NOT_FOUND", "Publicación no encontrada.");
  const [post] = await hydratePosts(c.env.DB, [row], c.get("member").id);
  const comments = await c.env.DB.prepare(
    `SELECT c.id,c.post_id,c.parent_id,c.body,c.created_at,u.id author_id,u.handle,u.display_name,u.avatar_media_id
    FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? AND c.deleted_at IS NULL ORDER BY c.created_at`,
  )
    .bind(row.id)
    .all<any>();
  const commentIds = comments.results.map((item: any) => item.id);
  let commentMedia: any[] = [];
  if (commentIds.length)
    commentMedia = (
      await c.env.DB.prepare(
        `SELECT * FROM media WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`,
      )
        .bind(...commentIds)
        .all<any>()
    ).results;
  return c.json({
    post,
    comments: comments.results.map((item: any) => ({
      id: item.id,
      postId: item.post_id,
      parentId: item.parent_id,
      body: item.body,
      createdAt: item.created_at,
      author: {
        id: item.author_id,
        handle: item.handle,
        displayName: item.display_name,
        avatarMediaId: item.avatar_media_id,
      },
      media: commentMedia
        .filter((m) => m.comment_id === item.id)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          mimeType: m.mime_type,
          originalName: m.original_name,
          byteSize: m.byte_size,
          url: `/api/media/${m.id}`,
        })),
    })),
  });
});

posts.post("/", requireCsrf, async (c) => {
  const input = await jsonBody(c, createPostSchema);
  const userId = c.get("member").id;
  if (input.mediaIds.length) {
    const owned = await c.env.DB.prepare(
      `SELECT COUNT(*) count FROM media WHERE owner_id=? AND post_id IS NULL AND comment_id IS NULL AND id IN (${input.mediaIds.map(() => "?").join(",")})`,
    )
      .bind(userId, ...input.mediaIds)
      .first<{ count: number }>();
    if (Number(owned?.count) !== input.mediaIds.length)
      throw new AppError(
        422,
        "MEDIA_INVALID",
        "Algún archivo no existe, no es tuyo o ya está publicado.",
      );
  }
  const id = crypto.randomUUID();
  const locationId = input.location ? crypto.randomUUID() : null;
  const statements: D1PreparedStatement[] = [];
  if (input.location)
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO locations (id,label,address,latitude,longitude,created_by) VALUES (?,?,?,?,?,?)",
      ).bind(
        locationId,
        input.location.label,
        input.location.address,
        input.location.latitude,
        input.location.longitude,
        userId,
      ),
    );
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO posts (id,author_id,title,body,happened_at,description,external_url,location_id,context,aftermath) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      userId,
      input.title,
      input.body,
      input.happenedAt,
      input.description,
      input.externalUrl || null,
      locationId,
      input.context,
      input.aftermath,
    ),
  );
  input.mediaIds.forEach((mediaId) =>
    statements.push(
      c.env.DB.prepare(
        "UPDATE media SET post_id=? WHERE id=? AND owner_id=? AND post_id IS NULL AND comment_id IS NULL",
      ).bind(id, mediaId, userId),
    ),
  );
  input.peopleIds.forEach((personId) =>
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO post_people (post_id,user_id) VALUES (?,?)",
      ).bind(id, personId),
    ),
  );
  input.tagIds.forEach((tagId) =>
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)",
      ).bind(id, tagId),
    ),
  );
  await c.env.DB.batch(statements);
  await addXp(c.env.DB, userId, 15, "Publicar en el archivo", "post", id);
  for (const personId of input.peopleIds)
    await notify(
      c.env.DB,
      personId,
      userId,
      "MENTION",
      `${c.get("member").displayName} te etiquetó en “${input.title}”.`,
      `/post/${id}`,
    );
  const row = await c.env.DB.prepare(`${postSelect} WHERE p.id=?`)
    .bind(id)
    .first<any>();
  return c.json(
    { post: (await hydratePosts(c.env.DB, [row], userId))[0] },
    201,
  );
});

posts.patch("/:id", requireCsrf, async (c) => {
  const input = await jsonBody(c, updatePostSchema);
  const existing = await c.env.DB.prepare(
    "SELECT * FROM posts WHERE id=? AND deleted_at IS NULL",
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!existing)
    throw new AppError(404, "POST_NOT_FOUND", "Publicación no encontrada.");
  if (
    existing.author_id !== c.get("member").id &&
    c.get("member").role !== "ADMIN"
  )
    throw new AppError(
      403,
      "POST_FORBIDDEN",
      "Solo su autor o Dani pueden editarla.",
    );
  const next = { ...existing, ...input } as any;
  await c.env.DB.prepare(
    `UPDATE posts SET title=?,body=?,description=?,happened_at=?,external_url=?,context=?,aftermath=?,updated_at=datetime('now') WHERE id=?`,
  )
    .bind(
      next.title,
      next.body,
      next.description,
      next.happenedAt ?? existing.happened_at,
      next.externalUrl || null,
      next.context,
      next.aftermath,
      existing.id,
    )
    .run();
  const relationshipChanges: D1PreparedStatement[] = [];
  if (input.peopleIds !== undefined) {
    relationshipChanges.push(
      c.env.DB.prepare("DELETE FROM post_people WHERE post_id=?").bind(
        existing.id,
      ),
      ...input.peopleIds.map((userId) =>
        c.env.DB.prepare(
          "INSERT INTO post_people (post_id,user_id) VALUES (?,?)",
        ).bind(existing.id, userId),
      ),
    );
  }
  if (input.tagIds !== undefined) {
    relationshipChanges.push(
      c.env.DB.prepare("DELETE FROM post_tags WHERE post_id=?").bind(
        existing.id,
      ),
      ...input.tagIds.map((tagId) =>
        c.env.DB.prepare(
          "INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)",
        ).bind(existing.id, tagId),
      ),
    );
  }
  if (input.location !== undefined) {
    if (input.location === null) {
      relationshipChanges.push(
        c.env.DB.prepare("UPDATE posts SET location_id=NULL WHERE id=?").bind(
          existing.id,
        ),
      );
    } else if (existing.location_id) {
      relationshipChanges.push(
        c.env.DB.prepare(
          "UPDATE locations SET label=?,address=?,latitude=?,longitude=? WHERE id=?",
        ).bind(
          input.location.label,
          input.location.address,
          input.location.latitude,
          input.location.longitude,
          existing.location_id,
        ),
      );
    } else {
      const locationId = crypto.randomUUID();
      relationshipChanges.push(
        c.env.DB.prepare(
          "INSERT INTO locations (id,label,address,latitude,longitude,created_by) VALUES (?,?,?,?,?,?)",
        ).bind(
          locationId,
          input.location.label,
          input.location.address,
          input.location.latitude,
          input.location.longitude,
          c.get("member").id,
        ),
        c.env.DB.prepare("UPDATE posts SET location_id=? WHERE id=?").bind(
          locationId,
          existing.id,
        ),
      );
    }
  }
  if (relationshipChanges.length) await c.env.DB.batch(relationshipChanges);
  return c.json({ ok: true });
});

posts.delete("/:id", requireCsrf, async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT author_id FROM posts WHERE id=? AND deleted_at IS NULL",
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!row) return c.body(null, 204);
  if (row.author_id !== c.get("member").id && c.get("member").role !== "ADMIN")
    throw new AppError(
      403,
      "POST_FORBIDDEN",
      "Solo su autor o Dani pueden eliminarla.",
    );
  const mediaRows = await c.env.DB.prepare(
    `SELECT m.id,m.r2_key,m.byte_size
     FROM media m
     LEFT JOIN comments comment_media ON comment_media.id=m.comment_id
     WHERE m.post_id=? OR comment_media.post_id=?`,
  )
    .bind(c.req.param("id"), c.req.param("id"))
    .all<{ id: string; r2_key: string; byte_size: number }>();
  try {
    await purgeMediaStorage(
      c.env.DB,
      c.env.MEDIA,
      mediaRows.results.map((media) => ({
        id: media.id,
        r2Key: media.r2_key,
        byteSize: media.byte_size,
      })),
    );
  } catch {
    throw new AppError(
      503,
      "MEDIA_DELETE_FAILED",
      "No se pudieron borrar todos los archivos de R2. Inténtalo de nuevo.",
    );
  }
  await c.env.DB.prepare(
    "UPDATE posts SET deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=?",
  )
    .bind(c.req.param("id"))
    .run();
  return c.body(null, 204);
});

posts.post("/:id/comments", requireCsrf, async (c) => {
  const input = await jsonBody(c, commentSchema);
  const post = await c.env.DB.prepare(
    "SELECT id,author_id FROM posts WHERE id=? AND deleted_at IS NULL",
  )
    .bind(c.req.param("id"))
    .first<any>();
  if (!post)
    throw new AppError(404, "POST_NOT_FOUND", "Publicación no encontrada.");
  if (input.parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM comments WHERE id=? AND post_id=? AND deleted_at IS NULL",
    )
      .bind(input.parentId, post.id)
      .first();
    if (!parent)
      throw new AppError(
        422,
        "PARENT_INVALID",
        "La respuesta no pertenece a esta publicación.",
      );
  }
  if (input.mediaIds.length) {
    const owned = await c.env.DB.prepare(
      `SELECT COUNT(*) count FROM media WHERE owner_id=? AND post_id IS NULL AND comment_id IS NULL AND id IN (${input.mediaIds.map(() => "?").join(",")})`,
    )
      .bind(c.get("member").id, ...input.mediaIds)
      .first<{ count: number }>();
    if (Number(owned?.count) !== input.mediaIds.length)
      throw new AppError(
        422,
        "MEDIA_INVALID",
        "Adjunto de comentario no válido.",
      );
  }
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO comments (id,post_id,author_id,parent_id,body) VALUES (?,?,?,?,?)",
    ).bind(id, post.id, c.get("member").id, input.parentId ?? null, input.body),
    ...input.mediaIds.map((mediaId) =>
      c.env.DB.prepare(
        "UPDATE media SET comment_id=? WHERE id=? AND owner_id=?",
      ).bind(id, mediaId, c.get("member").id),
    ),
  ]);
  await addXp(c.env.DB, c.get("member").id, 3, "Comentar", "comment", id);
  await notify(
    c.env.DB,
    post.author_id,
    c.get("member").id,
    "COMMENT",
    `${c.get("member").displayName} comentó tu publicación.`,
    `/post/${post.id}`,
  );
  const handles = [...input.body.matchAll(/@([\w-]{1,40})/g)]
    .map((match) => match[1])
    .slice(0, 10);
  for (const handle of handles) {
    const mentioned = await c.env.DB.prepare(
      "SELECT id FROM users WHERE handle=? COLLATE NOCASE",
    )
      .bind(handle)
      .first<{ id: string }>();
    if (mentioned)
      await notify(
        c.env.DB,
        mentioned.id,
        c.get("member").id,
        "MENTION",
        `${c.get("member").displayName} te mencionó en un comentario.`,
        `/post/${post.id}`,
      );
  }
  return c.json({ id }, 201);
});

posts.post("/:id/reactions/:reactionId", requireCsrf, async (c) => {
  const { id, reactionId } = c.req.param();
  const reaction = await c.env.DB.prepare(
    "SELECT r.id FROM reactions r JOIN posts p ON p.id=? AND p.deleted_at IS NULL WHERE r.id=? AND r.is_active=1",
  )
    .bind(id, reactionId)
    .first();
  if (!reaction)
    throw new AppError(404, "REACTION_NOT_FOUND", "Reacción no disponible.");
  const existing = await c.env.DB.prepare(
    "SELECT 1 found FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_id=?",
  )
    .bind(id, c.get("member").id, reactionId)
    .first();
  if (existing)
    await c.env.DB.prepare(
      "DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_id=?",
    )
      .bind(id, c.get("member").id, reactionId)
      .run();
  else
    await c.env.DB.prepare(
      "INSERT INTO post_reactions (post_id,user_id,reaction_id) VALUES (?,?,?)",
    )
      .bind(id, c.get("member").id, reactionId)
      .run();
  return c.json({ active: !existing });
});

export default posts;
