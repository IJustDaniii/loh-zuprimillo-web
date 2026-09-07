import { ArrowLeft, Send, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { CommentView, PostView } from "../../shared/contracts";
import { api, postJson } from "../lib/api";
import { Loading } from "../components/Loading";
import { PostCard } from "../components/PostCard";
import { Avatar } from "../components/Avatar";
import { MediaBlock } from "../components/MediaBlock";
import { formatDate } from "../lib/format";
import { Toast } from "../components/Toast";

export function PostPage() {
  const { id } = useParams();
  const [data, setData] = useState<{
    post: PostView;
    comments: CommentView[];
  } | null>(null);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    async () => setData(await api(`/api/posts/${id}`)),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    try {
      const mediaIds: string[] = [];
      if (file) {
        const upload = new FormData();
        upload.set("file", file);
        mediaIds.push(
          (
            await api<{ media: { id: string } }>("/api/media", {
              method: "POST",
              body: upload,
            })
          ).media.id,
        );
      }
      await postJson(`/api/posts/${id}/comments`, {
        body,
        parentId: replyTo?.id ?? null,
        mediaIds,
      });
      form.reset();
      setFile(null);
      setReplyTo(null);
      await load();
    } catch (caught: any) {
      setError(caught.message);
    }
  };
  if (!data) return <Loading />;
  const roots = data.comments.filter((comment) => !comment.parentId);
  const renderComment = (comment: CommentView, nested = false) => (
    <article key={comment.id} className={`comment ${nested ? "nested" : ""}`}>
      <Avatar member={comment.author} size="sm" />
      <div>
        <header>
          <Link to={`/perfil/${comment.author.handle}`}>
            <strong>{comment.author.displayName}</strong>{" "}
            <small>@{comment.author.handle}</small>
          </Link>
          <time>{formatDate(comment.createdAt)}</time>
        </header>
        <p>{comment.body}</p>
        <MediaBlock media={comment.media} />
        <button className="text-button" onClick={() => setReplyTo(comment)}>
          Responder
        </button>
        {data.comments
          .filter((item) => item.parentId === comment.id)
          .map((child) => renderComment(child, true))}
      </div>
    </article>
  );
  return (
    <div className="page post-page">
      <header className="page-header">
        <Link className="icon-button" to="/" aria-label="Volver">
          <ArrowLeft />
        </Link>
        <div>
          <p className="eyebrow">PUBLICACIÓN</p>
          <h1>Detalle</h1>
        </div>
      </header>
      <PostCard post={data.post} onChanged={load} expanded />
      <section className="comments-section">
        <h2>
          Comentarios <span>{data.comments.length}</span>
        </h2>
        {roots.length === 0 && (
          <p className="muted">Silencio administrativo. Sé el primero.</p>
        )}
        {roots.map((comment) => renderComment(comment))}
        <form className="comment-form" onSubmit={submit}>
          {error && <Toast message={error} kind="error" />}
          {replyTo && (
            <div className="reply-banner">
              Respondiendo a @{replyTo.author.handle}
              <button type="button" onClick={() => setReplyTo(null)}>
                Cancelar
              </button>
            </div>
          )}
          <textarea
            name="body"
            maxLength={4000}
            rows={3}
            placeholder="Añade contexto, una mención @dani o una teoría…"
          />
          <div>
            <label className="button secondary small">
              <Upload />
              {file ? file.name : "Adjuntar"}
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/ogg,audio/wav"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button className="button primary">
              <Send /> Comentar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
