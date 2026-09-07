import { useState, type FormEvent } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api, postJson } from "../lib/api";
import { localDateTimeValue } from "../lib/format";
import { LocationPicker, type PickedLocation } from "./LocationPicker";
import { Toast } from "./Toast";

export function ComposePost({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const { data } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const mediaIds: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        setStatus(`Subiendo archivo ${i + 1} de ${files.length}…`);
        const upload = new FormData();
        upload.set("file", files[i]);
        const result = await api<{ media: { id: string } }>("/api/media", {
          method: "POST",
          body: upload,
        });
        mediaIds.push(result.media.id);
      }
      setStatus("Guardando publicación…");
      const result = await postJson<{ post: { id: string } }>("/api/posts", {
        title: form.get("title"),
        body: form.get("body"),
        description: form.get("description"),
        happenedAt: new Date(String(form.get("happenedAt"))).toISOString(),
        externalUrl: form.get("externalUrl"),
        context: form.get("context"),
        aftermath: form.get("aftermath"),
        mediaIds,
        location,
        peopleIds: form.getAll("peopleIds"),
        tagIds: form.getAll("tagIds"),
      });
      onCreated(result.post.id);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };
  return (
    <form className="compose-form" onSubmit={submit}>
      {error && <Toast message={error} kind="error" />}
      <div className="form-grid">
        <label className="span-2">
          Título
          <input
            name="title"
            maxLength={160}
            required
            placeholder="El incidente del kebab orbital"
          />
        </label>
        <label>
          Fecha y hora
          <input
            name="happenedAt"
            type="datetime-local"
            defaultValue={localDateTimeValue()}
            required
          />
        </label>
        <label>
          Enlace <span className="optional">opcional</span>
          <input name="externalUrl" type="url" placeholder="https://…" />
        </label>
      </div>
      <label>
        Texto o contenido
        <textarea
          name="body"
          maxLength={10000}
          rows={4}
          placeholder="Cuenta qué ocurrió. Si subes un archivo, este texto puede quedar vacío."
        />
      </label>
      <label className="upload-zone">
        <FileUp />
        <strong>Fotos, clips, GIFs, audios o documentos</strong>
        <span>
          {files.length
            ? files.map((file) => file.name).join(", ")
            : "Selecciona uno o varios archivos"}
        </span>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/ogg,audio/wav,application/pdf,text/plain,application/zip,.docx"
        />
      </label>
      <details>
        <summary>
          Más contexto <span>opcional</span>
        </summary>
        <div className="details-body">
          <label>
            Descripción
            <textarea name="description" maxLength={2000} rows={2} />
          </label>
          <div className="form-grid">
            <label>
              Contexto
              <textarea name="context" maxLength={2000} rows={2} />
            </label>
            <label>
              ¿Qué pasó después?
              <textarea name="aftermath" maxLength={2000} rows={2} />
            </label>
          </div>
          <fieldset>
            <legend>Personas que aparecen</legend>
            <div className="chip-checks">
              {data?.members.map((member) => (
                <label key={member.id}>
                  <input type="checkbox" name="peopleIds" value={member.id} />
                  {member.displayName}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Etiquetas</legend>
            <div className="chip-checks">
              {data?.tags.map((tag) => (
                <label key={tag.id}>
                  <input type="checkbox" name="tagIds" value={tag.id} />#
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>Ubicación</label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>
      </details>
      <button className="button primary full" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="spin" />
            {status}
          </>
        ) : (
          "Guardar en el archivo"
        )}
      </button>
    </form>
  );
}
