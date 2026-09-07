import { BookOpen, Clock3, Map, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { MemoryMap } from "../components/MemoryMap";
import { Modal } from "../components/Modal";
import { LoreProposal } from "../components/LoreProposal";

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "lore";
  const [lore, setLore] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [propose, setPropose] = useState(false);
  const load = async () => {
    const [l, m] = await Promise.all([
      api<{ data: any[] }>("/api/lore"),
      api<{ data: any[] }>("/api/map"),
    ]);
    setLore(l.data);
    setPoints(m.data);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">MEMORIA COLECTIVA</p>
          <h1>Explorar</h1>
        </div>
        <button className="button primary" onClick={() => setPropose(true)}>
          <Plus /> Proponer lore
        </button>
      </header>
      <div className="tabs" role="tablist">
        <button
          className={tab === "lore" ? "active" : ""}
          onClick={() => setParams({ tab: "lore" })}
        >
          <BookOpen /> Wiki
        </button>
        <button
          className={tab === "timeline" ? "active" : ""}
          onClick={() => setParams({ tab: "timeline" })}
        >
          <Clock3 /> Timeline
        </button>
        <button
          className={tab === "mapa" ? "active" : ""}
          onClick={() => setParams({ tab: "mapa" })}
        >
          <Map /> Mapa
        </button>
      </div>
      {tab === "lore" && (
        <div className="lore-grid">
          {lore.length === 0 ? (
            <div className="empty-state">
              <span>📚</span>
              <h2>El canon todavía está por escribir</h2>
              <p>Las propuestas aparecerán aquí cuando Dani las apruebe.</p>
            </div>
          ) : (
            lore.map((entry) => (
              <article key={entry.id} className="lore-card">
                <p className="eyebrow">CANON APROBADO</p>
                <h2>{entry.title}</h2>
                <strong>{entry.summary}</strong>
                <p>{entry.body}</p>
                <footer>
                  {entry.happened_at && formatDate(entry.happened_at)} ·
                  propuesto por {entry.proposer_name}
                  {entry.post_id && (
                    <>
                      {" "}
                      · <Link to={`/post/${entry.post_id}`}>Ver prueba</Link>
                    </>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>
      )}
      {tab === "timeline" && (
        <div className="timeline">
          {lore.map((entry) => (
            <article key={entry.id}>
              <time>
                {entry.happened_at
                  ? new Date(entry.happened_at).getFullYear()
                  : "¿?"}
              </time>
              <div>
                <h2>{entry.title}</h2>
                <p>{entry.summary}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === "mapa" && (
        <>
          <div className="map-intro">
            <h2>Geografía del desastre</h2>
            <p>
              {points.length} recuerdos con coordenadas. Los mapas son de
              OpenStreetMap.
            </p>
          </div>
          <MemoryMap points={points} />
          <div className="map-list">
            {points.map((point) => (
              <Link key={point.post_id} to={`/post/${point.post_id}`}>
                <strong>{point.title}</strong>
                <span>{point.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {propose && (
        <Modal
          title="Proponer entrada de lore"
          onClose={() => setPropose(false)}
        >
          <LoreProposal
            onDone={() => {
              setPropose(false);
              void load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
