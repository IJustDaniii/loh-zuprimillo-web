import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

const fieldMap: Record<
  string,
  {
    key: string;
    label: string;
    type?: string;
    source?: string;
    required?: boolean;
  }[]
> = {
  tags: [
    { key: "slug", label: "Slug", required: true },
    { key: "label", label: "Nombre", required: true },
    { key: "color", label: "Color", type: "color", required: true },
  ],
  reactions: [
    { key: "slug", label: "Slug", required: true },
    { key: "label", label: "Nombre", required: true },
    { key: "emoji", label: "Emoji" },
    { key: "imageMediaId", label: "ID de imagen existente (opcional)" },
    { key: "sortOrder", label: "Orden", type: "number" },
  ],
  achievements: [
    { key: "slug", label: "Slug", required: true },
    { key: "title", label: "Título", required: true },
    { key: "description", label: "Descripción" },
    { key: "icon", label: "Icono" },
    { key: "xpReward", label: "XP", type: "number" },
  ],
  awards: [
    { key: "year", label: "Año", type: "number", required: true },
    { key: "title", label: "Título", required: true },
    { key: "description", label: "Descripción" },
    { key: "icon", label: "Icono" },
  ],
  trivia: [
    { key: "kind", label: "Tipo", source: "kind" },
    { key: "prompt", label: "Pregunta", required: true },
    { key: "answer", label: "Respuesta exacta", required: true },
    { key: "options", label: "Opciones separadas por |", required: true },
    { key: "sourcePostId", label: "ID de publicación fuente" },
  ],
};

function initial(item: any, key: string) {
  const snake = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  if (key === "options" && item?.options_json)
    return JSON.parse(item.options_json).join(" | ");
  return (
    item?.[key] ??
    item?.[snake] ??
    (key === "color" ? "#ff5c35" : key === "kind" ? "WHO_SAID" : "")
  );
}

export function CatalogForm({
  entity,
  item,
  onDone,
}: {
  entity: string;
  item?: any;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [reactionImage, setReactionImage] = useState<File | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const raw = Object.fromEntries(new FormData(event.currentTarget));
      const body: any = { ...raw };
      for (const key of ["sortOrder", "xpReward", "year"])
        if (key in body) body[key] = Number(body[key] || 0);
      if (entity === "reactions") {
        body.isActive = true;
        body.imageMediaId = body.imageMediaId || null;
        if (reactionImage) {
          const upload = new FormData();
          upload.set("file", reactionImage);
          const uploaded = await api<{ media: { id: string } }>("/api/media", {
            method: "POST",
            body: upload,
          });
          body.imageMediaId = uploaded.media.id;
        }
      }
      if (entity === "trivia") {
        body.options = String(body.options)
          .split("|")
          .map((v) => v.trim())
          .filter(Boolean);
        body.sourcePostId = body.sourcePostId || null;
      }
      await api(`/api/admin/catalog/${entity}${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onDone();
    } catch (caught: any) {
      setError(caught.message);
    }
  };
  return (
    <form onSubmit={submit}>
      {error && <p className="error-text">{error}</p>}
      {fieldMap[entity].map((field) => (
        <label key={field.key}>
          {field.label}
          {field.source === "kind" ? (
            <select name={field.key} defaultValue={initial(item, field.key)}>
              <option value="WHO_SAID">Quién dijo esto</option>
              <option value="WHICH_YEAR">De qué año es</option>
            </select>
          ) : (
            <input
              name={field.key}
              type={field.type ?? "text"}
              required={field.required}
              defaultValue={initial(item, field.key)}
            />
          )}
        </label>
      ))}
      {entity === "reactions" && (
        <label>
          Subir imagen personalizada <span className="optional">opcional</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) =>
              setReactionImage(event.target.files?.[0] ?? null)
            }
          />
        </label>
      )}
      <button className="button primary full">
        {item ? "Guardar cambios" : "Crear elemento"}
      </button>
    </form>
  );
}
