import { Filter, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { Paginated, PostView } from "../../shared/contracts";
import { PostCard } from "../components/PostCard";
import { Loading } from "../components/Loading";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";

export function FeedPage({
  onCompose,
  searchMode = false,
}: {
  onCompose?: () => void;
  searchMode?: boolean;
}) {
  const { data } = useApp();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<Paginated<PostView> | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setResult(await api(`/api/posts?${params.toString()}`));
    } catch (caught: any) {
      setError(caught.message);
    }
  }, [params]);
  useEffect(() => {
    void load();
  }, [load]);
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form) if (value) next.set(key, String(value));
    setParams(next);
  };
  return (
    <div className="page feed-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">EL ARCHIVO VIVO</p>
          <h1>{searchMode ? "Buscar" : "Inicio"}</h1>
        </div>
        {onCompose && (
          <button className="button primary" onClick={onCompose}>
            <Plus /> Publicar
          </button>
        )}
      </header>
      <form className="search-bar" onSubmit={search}>
        <Search />
        <input
          name="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder="Busca frases, títulos o contexto…"
          aria-label="Buscar publicaciones"
        />
        <button className="button small">Buscar</button>
        <details className="filters">
          <summary>
            <Filter /> Filtros
          </summary>
          <div className="filter-panel">
            <label>
              Persona
              <select name="author" defaultValue={params.get("author") ?? ""}>
                <option value="">Todas</option>
                {data?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etiqueta
              <select name="tag" defaultValue={params.get("tag") ?? ""}>
                <option value="">Todas</option>
                {data?.tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Formato
              <select name="kind" defaultValue={params.get("kind") ?? ""}>
                <option value="">Todos</option>
                <option value="IMAGE">Fotos</option>
                <option value="VIDEO">Vídeos</option>
                <option value="AUDIO">Audios</option>
                <option value="GIF">GIFs</option>
                <option value="DOCUMENT">Documentos</option>
              </select>
            </label>
            <label>
              Año
              <input
                name="year"
                inputMode="numeric"
                pattern="\d{4}"
                defaultValue={params.get("year") ?? ""}
                placeholder="2024"
              />
            </label>
          </div>
        </details>
      </form>
      {error && (
        <div className="empty-state">
          <h2>No se pudo cargar</h2>
          <p>{error}</p>
          <button className="button" onClick={load}>
            Reintentar
          </button>
        </div>
      )}
      {!result && !error && <Loading />}
      {result?.data.length === 0 && (
        <div className="empty-state">
          <span>🛸</span>
          <h2>Aquí todavía no pasó nada</h2>
          <p>O pasó, pero nadie lo ha documentado. Sospechoso.</p>
          {onCompose && (
            <button className="button primary" onClick={onCompose}>
              Crear la primera publicación
            </button>
          )}
        </div>
      )}
      <div className="feed-list">
        {result?.data.map((post) => (
          <PostCard key={post.id} post={post} onChanged={load} />
        ))}
      </div>
      {result && result.pagination.totalPages > result.pagination.page && (
        <button
          className="button full"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("page", String(result.pagination.page + 1));
            setParams(next);
          }}
        >
          Página siguiente
        </button>
      )}
    </div>
  );
}
