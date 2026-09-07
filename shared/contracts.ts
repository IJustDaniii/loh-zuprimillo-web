export type Role = "MEMBER" | "ADMIN";
export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED";
export type MediaKind =
  "IMAGE" | "VIDEO" | "AUDIO" | "GIF" | "DOCUMENT" | "AVATAR" | "REACTION";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Member {
  id: string;
  handle: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  bio: string;
  avatarMediaId: string | null;
  xp: number;
}

export interface SessionView {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface MediaView {
  id: string;
  kind: MediaKind;
  mimeType: string;
  originalName: string;
  byteSize: number;
  url: string;
}

export interface ReactionCount {
  id: string;
  label: string;
  emoji: string | null;
  imageMediaId: string | null;
  count: number;
  reactedByMe: boolean;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: Pick<Member, "id" | "handle" | "displayName" | "avatarMediaId">;
  media: MediaView[];
}

export interface PostView {
  id: string;
  title: string;
  body: string;
  description: string;
  happenedAt: string;
  context: string;
  aftermath: string;
  externalUrl: string | null;
  isFeatured: boolean;
  createdAt: string;
  author: Pick<Member, "id" | "handle" | "displayName" | "avatarMediaId">;
  media: MediaView[];
  people: Pick<Member, "id" | "handle" | "displayName">[];
  tags: { id: string; slug: string; label: string; color: string }[];
  location: {
    id: string;
    label: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  reactions: ReactionCount[];
  commentCount: number;
  canEdit: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
