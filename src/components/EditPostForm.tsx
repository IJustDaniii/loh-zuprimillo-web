import { useState, type FormEvent } from "react";
import type { PostView } from "../../shared/contracts";
import { patchJson } from "../lib/api";
import { Toast } from "./Toast";

function asLocal(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function EditPostForm({
  post,
  onDone,
}: {
  post: PostView;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await patchJson(`/api/posts/${post.id}`, {
        title: form.get("title"),
        body: form.get("body"),
        description: form.get("description"),
        happenedAt: new Date(String(form.get("happenedAt"))).toISOString(),
        externalUrl: form.get("externalUrl"),
        context: form.get("context"),
        aftermath: form.get("aftermath"),
      });
      onDone();
    } catch (caught: any) {
      setError(caught.message);
    }
  };
  return (
    <form onSubmit={submit}>
      {error && <Toast message={error} kind="error" />}
      <label>
        Título
        <input
          name="title"
          maxLength={160}
          required
          defaultValue={post.title}
        />
      </label>
      <label>
        Fecha
        <input
          name="happenedAt"
          type="datetime-local"
          required
          defaultValue={asLocal(post.happenedAt)}
        />
      </label>
      <label>
        Texto
        <textarea
          name="body"
          rows={5}
          maxLength={10000}
          defaultValue={post.body}
        />
      </label>
      <label>
        Descripción
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={post.description}
        />
      </label>
      <label>
        Enlace
        <input
          name="externalUrl"
          type="url"
          defaultValue={post.externalUrl ?? ""}
        />
      </label>
      <div className="form-grid">
        <label>
          Contexto
          <textarea
            name="context"
            rows={3}
            maxLength={2000}
            defaultValue={post.context}
          />
        </label>
        <label>
          Qué pasó después
          <textarea
            name="aftermath"
            rows={3}
            maxLength={2000}
            defaultValue={post.aftermath}
          />
        </label>
      </div>
      <button className="button primary full">Guardar cambios</button>
    </form>
  );
}
