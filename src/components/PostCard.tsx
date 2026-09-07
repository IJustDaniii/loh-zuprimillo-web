import {
  CalendarDays,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { PostView } from "../../shared/contracts";
import { Avatar } from "./Avatar";
import { MediaBlock } from "./MediaBlock";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { Modal } from "./Modal";
import { EditPostForm } from "./EditPostForm";

export function PostCard({
  post,
  onChanged,
  expanded = false,
}: {
  post: PostView;
  onChanged?: () => void;
  expanded?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const react = async (reactionId: string) => {
    await api(`/api/posts/${post.id}/reactions/${reactionId}`, {
      method: "POST",
    });
    onChanged?.();
  };
  const remove = async () => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    await api(`/api/posts/${post.id}`, { method: "DELETE" });
    onChanged?.();
  };
  return (
    <article className={`post-card ${expanded ? "expanded" : ""}`}>
      <header className="post-author">
        <Link to={`/perfil/${post.author.handle}`}>
          <Avatar member={post.author} />
          <span>
            <strong>{post.author.displayName}</strong>
            <small>@{post.author.handle}</small>
          </span>
        </Link>
        {post.isFeatured && (
          <span className="featured">
            <Star /> Destacado
          </span>
        )}
        {post.canEdit && (
          <div className="post-menu">
            <button
              className="icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Opciones"
            >
              <MoreHorizontal />
            </button>
            {menu && (
              <div className="popover">
                <button
                  onClick={() => {
                    setMenu(false);
                    setEditing(true);
                  }}
                >
                  <Pencil /> Editar
                </button>
                <button onClick={remove}>
                  <Trash2 /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <div className="post-content">
        <Link to={`/post/${post.id}`} className="post-title">
          <h2>{post.title}</h2>
        </Link>
        {post.body && <p className="post-body">{post.body}</p>}
        {post.description && <p className="muted">{post.description}</p>}
        {post.externalUrl && (
          <a
            className="external-link"
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {new URL(post.externalUrl).hostname} ↗
          </a>
        )}
      </div>
      <MediaBlock media={post.media} />
      {(post.tags.length > 0 || post.people.length > 0) && (
        <div className="post-meta-row">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="tag"
              style={{ "--tag": tag.color } as React.CSSProperties}
            >
              #{tag.label}
            </span>
          ))}
          {post.people.map((person) => (
            <Link key={person.id} to={`/perfil/${person.handle}`}>
              @{person.handle}
            </Link>
          ))}
        </div>
      )}
      <div className="post-details">
        <span>
          <CalendarDays />
          {formatDate(post.happenedAt)}
        </span>
        {post.location && (
          <Link to={`/explorar?tab=mapa&post=${post.id}`}>
            <MapPin />
            {post.location.label}
          </Link>
        )}
      </div>
      {expanded && (post.context || post.aftermath) && (
        <div className="context-grid">
          {post.context && (
            <div>
              <small>CONTEXTO</small>
              <p>{post.context}</p>
            </div>
          )}
          {post.aftermath && (
            <div>
              <small>DESPUÉS</small>
              <p>{post.aftermath}</p>
            </div>
          )}
        </div>
      )}
      <footer className="post-actions">
        <Link to={`/post/${post.id}`}>
          <MessageCircle />
          {post.commentCount}
        </Link>
        {post.reactions.map((reaction) => (
          <button
            key={reaction.id}
            className={reaction.reactedByMe ? "active" : ""}
            onClick={() => react(reaction.id)}
            aria-label={`${reaction.label}: ${reaction.count}`}
          >
            {reaction.imageMediaId ? (
              <img
                className="reaction-image protected-media"
                src={`/api/media/${reaction.imageMediaId}`}
                alt={reaction.label}
                draggable={false}
              />
            ) : (
              (reaction.emoji ?? "◉")
            )}{" "}
            <span>{reaction.count || ""}</span>
          </button>
        ))}
      </footer>
      {editing && (
        <Modal title="Editar publicación" onClose={() => setEditing(false)}>
          <EditPostForm
            post={post}
            onDone={() => {
              setEditing(false);
              onChanged?.();
            }}
          />
        </Modal>
      )}
    </article>
  );
}
