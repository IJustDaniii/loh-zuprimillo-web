import type { Member, PostView } from "../../shared/contracts";

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  role: "MEMBER" | "ADMIN";
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  bio: string;
  avatar_media_id: string | null;
  xp: number;
};

export function memberFromRow(row: UserRow): Member {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    bio: row.bio,
    avatarMediaId: row.avatar_media_id,
    xp: row.xp,
  };
}

export async function addXp(
  db: D1Database,
  userId: string,
  amount: number,
  reason: string,
  sourceType: string,
  sourceId?: string,
) {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO xp_events (id,user_id,amount,reason,source_type,source_id) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, userId, amount, reason, sourceType, sourceId ?? null),
    db
      .prepare(
        "UPDATE users SET xp = MAX(0, xp + ?), updated_at = datetime('now') WHERE id = ?",
      )
      .bind(amount, userId),
  ]);
}

export async function audit(
  db: D1Database,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  await db
    .prepare(
      "INSERT INTO audit_log (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      actorId,
      action,
      entityType,
      entityId ?? null,
      JSON.stringify(metadata),
    )
    .run();
}

export async function notify(
  db: D1Database,
  userId: string,
  actorId: string | null,
  kind: string,
  message: string,
  href: string,
) {
  if (userId === actorId) return;
  await db
    .prepare(
      "INSERT INTO notifications (id,user_id,actor_id,kind,message,href) VALUES (?,?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), userId, actorId, kind, message, href)
    .run();
}

type PostRow = {
  id: string;
  title: string;
  body: string;
  description: string;
  happened_at: string;
  context: string;
  aftermath: string;
  external_url: string | null;
  is_featured: number;
  created_at: string;
  author_id: string;
  handle: string;
  display_name: string;
  avatar_media_id: string | null;
  location_id: string | null;
  location_label: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  comment_count: number;
};

export async function hydratePosts(
  db: D1Database,
  rows: PostRow[],
  viewerId: string,
): Promise<PostView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const [media, people, tags, reactionCatalog, reactionTotals] =
    await Promise.all([
      db
        .prepare(
          `SELECT id,post_id,kind,mime_type,original_name,byte_size FROM media WHERE post_id IN (${placeholders})`,
        )
        .bind(...ids)
        .all(),
      db
        .prepare(
          `SELECT pp.post_id,u.id,u.handle,u.display_name FROM post_people pp JOIN users u ON u.id=pp.user_id WHERE pp.post_id IN (${placeholders})`,
        )
        .bind(...ids)
        .all(),
      db
        .prepare(
          `SELECT pt.post_id,t.id,t.slug,t.label,t.color FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id IN (${placeholders})`,
        )
        .bind(...ids)
        .all(),
      db
        .prepare(
          "SELECT id,label,emoji,image_media_id FROM reactions WHERE is_active=1 ORDER BY sort_order",
        )
        .all(),
      db
        .prepare(
          `SELECT reaction_id,post_id,COUNT(*) count,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) mine FROM post_reactions WHERE post_id IN (${placeholders}) GROUP BY reaction_id,post_id`,
        )
        .bind(viewerId, ...ids)
        .all(),
    ]);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    description: row.description,
    happenedAt: row.happened_at,
    context: row.context,
    aftermath: row.aftermath,
    externalUrl: row.external_url,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      handle: row.handle,
      displayName: row.display_name,
      avatarMediaId: row.avatar_media_id,
    },
    media: (media.results as any[])
      .filter((item) => item.post_id === row.id)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        mimeType: item.mime_type,
        originalName: item.original_name,
        byteSize: item.byte_size,
        url: `/api/media/${item.id}`,
      })),
    people: (people.results as any[])
      .filter((item) => item.post_id === row.id)
      .map((item) => ({
        id: item.id,
        handle: item.handle,
        displayName: item.display_name,
      })),
    tags: (tags.results as any[])
      .filter((item) => item.post_id === row.id)
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        label: item.label,
        color: item.color,
      })),
    location: row.location_id
      ? {
          id: row.location_id,
          label: row.location_label!,
          address: row.address!,
          latitude: row.latitude!,
          longitude: row.longitude!,
        }
      : null,
    reactions: (reactionCatalog.results as any[]).map((item) => {
      const total = (reactionTotals.results as any[]).find(
        (candidate) =>
          candidate.post_id === row.id && candidate.reaction_id === item.id,
      );
      return {
        id: item.id,
        label: item.label,
        emoji: item.emoji,
        imageMediaId: item.image_media_id,
        count: Number(total?.count ?? 0),
        reactedByMe: Boolean(total?.mine),
      };
    }),
    commentCount: Number(row.comment_count),
    canEdit: viewerId === row.author_id,
  }));
}

export const postSelect = `SELECT p.*,u.handle,u.display_name,u.avatar_media_id,l.label location_label,l.address,l.latitude,l.longitude,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) comment_count
  FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN locations l ON l.id=p.location_id`;
