import { Hono } from "hono";
import { z } from "zod";
import { loreSchema, pollSchema, profileSchema } from "../../shared/schemas";
import { addXp, memberFromRow, notify } from "../lib/db";
import { AppError, jsonBody } from "../lib/http";
import { requireAuth, requireCsrf } from "../middleware/auth";
import type { AppEnv } from "../types";

const community = new Hono<AppEnv>();
community.use("*", requireAuth);

community.get("/bootstrap", async (c) => {
  const [members, tags, reactions, settings, sessions, notifications] =
    await Promise.all([
      c.env.DB.prepare(
        "SELECT id,handle,display_name,role,status,bio,avatar_media_id,xp FROM users ORDER BY display_name",
      ).all<any>(),
      c.env.DB.prepare("SELECT * FROM tags ORDER BY label").all(),
      c.env.DB.prepare(
        "SELECT id,slug,label,emoji,image_media_id,sort_order FROM reactions WHERE is_active=1 ORDER BY sort_order",
      ).all(),
      c.env.DB.prepare("SELECT key,value_json FROM app_settings").all<any>(),
      c.env.DB.prepare(
        `SELECT id,device_name,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY last_seen_at DESC`,
      )
        .bind(c.get("member").id)
        .all<any>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL",
      )
        .bind(c.get("member").id)
        .first<{ count: number }>(),
    ]);
  return c.json({
    member: c.get("member"),
    members: members.results.map(memberFromRow),
    tags: tags.results,
    reactions: reactions.results,
    settings: Object.fromEntries(
      settings.results.map((item) => {
        try {
          return [item.key, JSON.parse(item.value_json)];
        } catch {
          return [item.key, item.value_json];
        }
      }),
    ),
    sessions: sessions.results.map((item) => ({
      id: item.id,
      deviceName: item.device_name,
      createdAt: item.created_at,
      lastSeenAt: item.last_seen_at,
      expiresAt: item.expires_at,
      isCurrent: item.id === c.get("session").id,
    })),
    unreadNotifications: Number(notifications?.count ?? 0),
  });
});

community.patch("/profile", requireCsrf, async (c) => {
  const input = await jsonBody(c, profileSchema);
  await c.env.DB.prepare(
    "UPDATE users SET bio=?,updated_at=datetime('now') WHERE id=?",
  )
    .bind(input.bio, c.get("member").id)
    .run();
  return c.json({ ok: true });
});

community.patch("/profile/avatar", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({ mediaId: z.string().min(1).max(80) }),
  );
  const media = await c.env.DB.prepare(
    "SELECT id FROM media WHERE id=? AND owner_id=? AND post_id IS NULL AND comment_id IS NULL AND kind IN ('IMAGE','GIF')",
  )
    .bind(input.mediaId, c.get("member").id)
    .first();
  if (!media)
    throw new AppError(422, "AVATAR_INVALID", "Imagen de avatar no válida.");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE media SET kind='AVATAR' WHERE id=?").bind(
      input.mediaId,
    ),
    c.env.DB.prepare(
      "UPDATE users SET avatar_media_id=?,updated_at=datetime('now') WHERE id=?",
    ).bind(input.mediaId, c.get("member").id),
  ]);
  return c.json({ ok: true });
});

community.get("/members/:handle", async (c) => {
  const user = await c.env.DB.prepare(
    `SELECT u.id,u.handle,u.display_name,u.role,u.status,u.bio,u.avatar_media_id,u.xp,
    (SELECT COUNT(*) FROM posts p WHERE p.author_id=u.id AND p.deleted_at IS NULL) post_count,
    (SELECT COUNT(*) FROM comments x WHERE x.author_id=u.id AND x.deleted_at IS NULL) comment_count
    FROM users u WHERE u.handle=? COLLATE NOCASE`,
  )
    .bind(c.req.param("handle"))
    .first<any>();
  if (!user)
    throw new AppError(404, "MEMBER_NOT_FOUND", "Miembro no encontrado.");
  const [achievements, awards] = await Promise.all([
    c.env.DB.prepare(
      "SELECT a.* ,ua.awarded_at FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id WHERE ua.user_id=? ORDER BY ua.awarded_at DESC",
    )
      .bind(user.id)
      .all(),
    c.env.DB.prepare(
      "SELECT a.*,aw.note FROM award_winners aw JOIN awards a ON a.id=aw.award_id WHERE aw.user_id=? ORDER BY a.year DESC",
    )
      .bind(user.id)
      .all(),
  ]);
  return c.json({
    member: memberFromRow(user),
    stats: {
      posts: Number(user.post_count),
      comments: Number(user.comment_count),
      level: Math.floor(Math.sqrt(user.xp / 50)) + 1,
    },
    achievements: achievements.results,
    awards: awards.results,
  });
});

community.get("/notifications", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT n.*,u.display_name actor_name FROM notifications n LEFT JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50`,
  )
    .bind(c.get("member").id)
    .all();
  return c.json({ data: rows.results });
});
community.post("/notifications/read", requireCsrf, async (c) => {
  await c.env.DB.prepare(
    "UPDATE notifications SET read_at=datetime('now') WHERE user_id=? AND read_at IS NULL",
  )
    .bind(c.get("member").id)
    .run();
  return c.json({ ok: true });
});

community.get("/activity", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT 'POST' kind,p.id,p.title label,p.created_at,u.display_name actor FROM posts p JOIN users u ON u.id=p.author_id WHERE p.deleted_at IS NULL
    UNION ALL SELECT 'COMMENT',c.id,substr(c.body,1,100),c.created_at,u.display_name FROM comments c JOIN users u ON u.id=c.author_id WHERE c.deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 20`,
  ).all();
  return c.json({ data: rows.results });
});

community.get("/lore", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT l.*,u.display_name proposer_name FROM lore_entries l JOIN users u ON u.id=l.proposer_id WHERE l.status='APPROVED' ORDER BY COALESCE(l.happened_at,l.created_at) DESC`,
  ).all();
  return c.json({ data: rows.results });
});
community.post("/lore", requireCsrf, async (c) => {
  const input = await jsonBody(c, loreSchema);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO lore_entries (id,proposer_id,title,summary,body,happened_at,post_id) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      c.get("member").id,
      input.title,
      input.summary,
      input.body,
      input.happenedAt || null,
      input.postId ?? null,
    )
    .run();
  await notify(
    c.env.DB,
    "usr_dani",
    c.get("member").id,
    "LORE_PROPOSAL",
    `${c.get("member").displayName} propuso una entrada de lore.`,
    "/admin",
  );
  return c.json({ id, status: "PENDING" }, 201);
});

community.get("/map", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT p.id post_id,p.title,p.happened_at,l.id,l.label,l.address,l.latitude,l.longitude FROM posts p JOIN locations l ON l.id=p.location_id WHERE p.deleted_at IS NULL ORDER BY p.happened_at DESC`,
  ).all();
  return c.json({ data: rows.results });
});

community.get("/polls", async (c) => {
  const polls = await c.env.DB.prepare(
    `SELECT p.*,u.display_name creator_name FROM polls p JOIN users u ON u.id=p.creator_id ORDER BY p.created_at DESC LIMIT 30`,
  ).all<any>();
  if (!polls.results.length) return c.json({ data: [] });
  const ids = polls.results.map((p) => p.id);
  const options = await c.env.DB.prepare(
    `SELECT o.*,COUNT(v.user_id) votes,MAX(CASE WHEN v.user_id=? THEN 1 ELSE 0 END) mine FROM poll_options o LEFT JOIN poll_votes v ON v.option_id=o.id WHERE o.poll_id IN (${ids.map(() => "?").join(",")}) GROUP BY o.id ORDER BY o.sort_order`,
  )
    .bind(c.get("member").id, ...ids)
    .all<any>();
  return c.json({
    data: polls.results.map((poll) => ({
      ...poll,
      options: options.results.filter((option) => option.poll_id === poll.id),
    })),
  });
});
community.post("/polls", requireCsrf, async (c) => {
  const input = await jsonBody(c, pollSchema);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO polls (id,creator_id,question,closes_at,is_multiple) VALUES (?,?,?,?,?)",
    ).bind(
      id,
      c.get("member").id,
      input.question,
      input.closesAt || null,
      input.isMultiple ? 1 : 0,
    ),
    ...input.options.map((label, index) =>
      c.env.DB.prepare(
        "INSERT INTO poll_options (id,poll_id,label,sort_order) VALUES (?,?,?,?)",
      ).bind(crypto.randomUUID(), id, label, index),
    ),
  ]);
  await addXp(c.env.DB, c.get("member").id, 8, "Crear encuesta", "poll", id);
  return c.json({ id }, 201);
});
community.post("/polls/:id/votes", requireCsrf, async (c) => {
  const input = await jsonBody(c, z.object({ optionId: z.string().min(1) }));
  const poll = await c.env.DB.prepare(
    `SELECT p.* FROM polls p JOIN poll_options o ON o.poll_id=p.id WHERE p.id=? AND o.id=?`,
  )
    .bind(c.req.param("id"), input.optionId)
    .first<any>();
  if (
    !poll ||
    (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now())
  )
    throw new AppError(
      422,
      "POLL_CLOSED",
      "Encuesta cerrada o opción inválida.",
    );
  if (!poll.is_multiple)
    await c.env.DB.prepare(
      "DELETE FROM poll_votes WHERE poll_id=? AND user_id=?",
    )
      .bind(poll.id, c.get("member").id)
      .run();
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO poll_votes (poll_id,option_id,user_id) VALUES (?,?,?)",
  )
    .bind(poll.id, input.optionId, c.get("member").id)
    .run();
  return c.json({ ok: true });
});

community.get("/games", async (c) => {
  const [clip, battles, trivia, ranking, achievements, awards] =
    await Promise.all([
      c.env.DB.prepare(
        "SELECT p.id,p.title,m.id media_id,m.kind FROM media m JOIN posts p ON p.id=m.post_id WHERE p.deleted_at IS NULL AND m.kind IN ('VIDEO','AUDIO','GIF') ORDER BY random() LIMIT 1",
      ).first(),
      c.env.DB.prepare(
        `SELECT b.*,lp.title left_title,rp.title right_title,(SELECT COUNT(*) FROM battle_votes WHERE battle_id=b.id AND chosen_post_id=b.left_post_id) left_votes,(SELECT COUNT(*) FROM battle_votes WHERE battle_id=b.id AND chosen_post_id=b.right_post_id) right_votes FROM battles b JOIN posts lp ON lp.id=b.left_post_id JOIN posts rp ON rp.id=b.right_post_id ORDER BY b.created_at DESC LIMIT 10`,
      ).all(),
      c.env.DB.prepare(
        "SELECT id,kind,prompt,options_json FROM trivia_questions WHERE is_active=1 ORDER BY random() LIMIT 1",
      ).first(),
      c.env.DB.prepare(
        "SELECT id,handle,display_name,xp,avatar_media_id FROM users WHERE status='ACTIVE' ORDER BY xp DESC,display_name",
      ).all(),
      c.env.DB.prepare(
        "SELECT * FROM achievements WHERE is_active=1 ORDER BY title",
      ).all(),
      c.env.DB.prepare(
        "SELECT a.*,group_concat(u.display_name,', ') winners FROM awards a LEFT JOIN award_winners aw ON aw.award_id=a.id LEFT JOIN users u ON u.id=aw.user_id GROUP BY a.id ORDER BY a.year DESC",
      ).all(),
    ]);
  return c.json({
    clip,
    battles: battles.results,
    trivia: trivia
      ? { ...trivia, options: JSON.parse((trivia as any).options_json) }
      : null,
    ranking: ranking.results,
    achievements: achievements.results,
    awards: awards.results,
  });
});
community.post("/games/trivia/:id", requireCsrf, async (c) => {
  const input = await jsonBody(
    c,
    z.object({ answer: z.string().trim().min(1).max(200) }),
  );
  const question = await c.env.DB.prepare(
    "SELECT answer FROM trivia_questions WHERE id=? AND is_active=1",
  )
    .bind(c.req.param("id"))
    .first<{ answer: string }>();
  if (!question)
    throw new AppError(404, "QUESTION_NOT_FOUND", "Pregunta no disponible.");
  const correct =
    question.answer.trim().toLocaleLowerCase("es") ===
    input.answer.trim().toLocaleLowerCase("es");
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO trivia_answers (question_id,user_id,answer,is_correct) VALUES (?,?,?,?)",
  )
    .bind(c.req.param("id"), c.get("member").id, input.answer, correct ? 1 : 0)
    .run();
  if (correct)
    await addXp(
      c.env.DB,
      c.get("member").id,
      5,
      "Acertar trivia",
      "trivia",
      c.req.param("id"),
    );
  return c.json({ correct, answer: question.answer });
});
community.post("/games/battles/:id", requireCsrf, async (c) => {
  const input = await jsonBody(c, z.object({ postId: z.string().min(1) }));
  const battle = await c.env.DB.prepare(
    "SELECT * FROM battles WHERE id=? AND status='OPEN' AND (left_post_id=? OR right_post_id=?)",
  )
    .bind(c.req.param("id"), input.postId, input.postId)
    .first();
  if (!battle)
    throw new AppError(
      422,
      "BATTLE_INVALID",
      "Batalla cerrada o clip inválido.",
    );
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO battle_votes (battle_id,user_id,chosen_post_id) VALUES (?,?,?)",
  )
    .bind(c.req.param("id"), c.get("member").id, input.postId)
    .run();
  return c.json({ ok: true });
});

export default community;
