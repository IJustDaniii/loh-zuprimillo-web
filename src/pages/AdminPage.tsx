import {
  Check,
  Clipboard,
  Database,
  KeyRound,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, patchJson, postJson } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import { Modal } from "../components/Modal";
import { CatalogForm } from "../components/CatalogForm";
import { Toast } from "../components/Toast";

const tabs = [
  ["resumen", "Resumen", ShieldCheck],
  ["usuarios", "Accesos", Users],
  ["contenido", "Contenido", MessageSquare],
  ["lore", "Lore", Database],
  ["catalogos", "Catálogos", Plus],
  ["ajustes", "Ajustes", Settings],
] as const;

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="admin-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="muted admin-empty">{text}</p>;
}

function StorageMeter({
  label,
  storage,
  detail,
}: {
  label: string;
  storage: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    percent: number;
    blocked: boolean;
  };
  detail?: string;
}) {
  const state = storage.blocked
    ? "blocked"
    : storage.percent >= 80
      ? "warning"
      : "healthy";
  return (
    <article className={"storage-card " + state}>
      <header>
        <strong>{label}</strong>
        <span>{storage.percent}%</span>
      </header>
      <div
        className="storage-meter"
        role="progressbar"
        aria-label={"Uso de " + label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, storage.percent)}
      >
        <i style={{ width: Math.min(100, storage.percent) + "%" }} />
      </div>
      <p>
        <strong>{formatBytes(storage.usedBytes)}</strong> usados de{" "}
        <strong>{formatBytes(storage.limitBytes)}</strong>
      </p>
      <small>
        {storage.blocked
          ? "Subidas bloqueadas hasta liberar espacio."
          : formatBytes(storage.remainingBytes) + " disponibles"}
        {detail ? " · " + detail : ""}
      </small>
    </article>
  );
}

export function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("resumen");
  const [invite, setInvite] = useState<any>(null);
  const [catalog, setCatalog] = useState<{ entity: string; item?: any } | null>(
    null,
  );
  const [assignment, setAssignment] = useState<{
    entity: "achievements" | "awards";
    item: any;
  } | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => setData(await api("/api/admin/overview"));
  useEffect(() => {
    void load();
  }, []);
  const mutate = async (
    work: () => Promise<unknown>,
    success = "Cambios guardados",
  ) => {
    try {
      await work();
      setMessage(success);
      await load();
    } catch (caught: any) {
      setMessage(caught.message);
    }
  };
  const removeLore = async (entry: any) => {
    if (
      !confirm(
        `Esta acción eliminará permanentemente «${entry.title}». ¿Continuar?`,
      )
    )
      return;
    await mutate(
      () => api(`/api/admin/lore/${entry.id}`, { method: "DELETE" }),
      "Entrada de lore eliminada",
    );
  };
  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await postJson<any>("/api/admin/invitations", {
      userId: form.get("userId"),
      expiresInDays: Number(form.get("expiresInDays")),
    });
    setInvite(result.invitation);
    await load();
  };
  if (!data)
    return <div className="loading">Abriendo la sala de máquinas…</div>;
  return (
    <div className="page admin-page">
      <header className="page-header admin-title">
        <div>
          <p className="eyebrow">SOLO DANI · REGISTRO AUDITADO</p>
          <h1>Administración</h1>
        </div>
        <span className="status-pill">
          <i /> Sistema operativo
        </span>
      </header>
      {message && <Toast message={message} onClose={() => setMessage("")} />}
      <div className="admin-tabs">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      {tab === "resumen" && (
        <>
          <div className="metric-grid">
            <div>
              <small>MIEMBROS ACTIVOS</small>
              <strong>
                {data.counts.active_users}
                <span>/10</span>
              </strong>
            </div>
            <div>
              <small>PUBLICACIONES</small>
              <strong>{data.counts.posts}</strong>
            </div>
            <div>
              <small>ARCHIVOS R2</small>
              <strong>{data.counts.media}</strong>
            </div>
            <div className={data.counts.pending_lore ? "attention" : ""}>
              <small>LORE PENDIENTE</small>
              <strong>{data.counts.pending_lore}</strong>
            </div>
          </div>
          {data.storage && (
            <Section title="Almacenamiento y protección de costes">
              <div className="storage-grid">
                <StorageMeter
                  label="R2 · archivos privados"
                  storage={data.storage.r2}
                  detail={data.storage.r2.objects + " objetos"}
                />
                <StorageMeter
                  label="D1 · base de datos"
                  storage={data.storage.d1}
                />
              </div>
              {(data.storage.r2.blocked || data.storage.d1.blocked) && (
                <p className="storage-alert" role="alert">
                  Las nuevas subidas están bloqueadas automáticamente porque se ha alcanzado un tope preventivo.
                </p>
              )}
              <p className="muted storage-note">
                Los topes son deliberadamente inferiores a los límites gratuitos de Cloudflare. Puedes ajustarlos en Ajustes, pero la aplicación no permite superar el máximo seguro.
              </p>
            </Section>
          )}
          <Section title="Actividad administrativa reciente">
            {data.audit.length ? (
              <div className="admin-list">
                {data.audit.map((row: any) => (
                  <div key={row.id}>
                    <span>
                      <strong>{row.action}</strong>
                      <small>
                        {row.actor_name ?? "Sistema"} · {row.entity_type}
                      </small>
                    </span>
                    <time>{formatDate(row.created_at)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Sin acciones registradas." />
            )}
          </Section>
        </>
      )}
      {tab === "usuarios" && (
        <div className="admin-columns">
          <div>
            <Section title="Miembros y estado">
              {data.users.map((user: any) => (
                <div className="user-admin-row" key={user.id}>
                  <span className="avatar avatar-sm avatar-fallback">
                    {user.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.display_name}</strong>
                    <small>
                      @{user.handle} · {user.xp} XP
                    </small>
                  </span>
                  <select
                    value={user.status}
                    disabled={user.id === "usr_dani"}
                    onChange={(e) =>
                      mutate(() =>
                        patchJson(`/api/admin/users/${user.id}`, {
                          status: e.target.value,
                        }),
                      )
                    }
                  >
                    <option value="INVITED">Invitado</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="SUSPENDED">Suspendido</option>
                  </select>
                </div>
              ))}
            </Section>
            <Section title="Generar invitación" action={<KeyRound />}>
              <form className="inline-admin-form" onSubmit={createInvite}>
                <label>
                  Persona
                  <select name="userId">
                    {data.users
                      .filter(
                        (u: any) =>
                          u.status !== "ACTIVE" && u.id !== "usr_dani",
                      )
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Días
                  <input
                    name="expiresInDays"
                    type="number"
                    min="1"
                    max="30"
                    defaultValue="7"
                  />
                </label>
                <button className="button primary">Generar</button>
              </form>
              {invite && (
                <div className="invite-secret">
                  <strong>Código de un solo uso</strong>
                  <code>{invite.code}</code>
                  <button
                    className="button"
                    onClick={() => navigator.clipboard.writeText(invite.code)}
                  >
                    <Clipboard /> Copiar
                  </button>
                  <small>
                    No volverá a mostrarse. Envíalo por un canal seguro.
                  </small>
                </div>
              )}
              <div className="admin-list">
                {data.invitations.map((row: any) => (
                  <div key={row.id}>
                    <span>
                      <strong>{row.display_name}</strong>
                      <small>
                        {row.used_at
                          ? "Usada"
                          : row.revoked_at
                            ? "Revocada"
                            : `Caduca ${formatDate(row.expires_at)}`}
                      </small>
                    </span>
                    {!row.used_at && !row.revoked_at && (
                      <button
                        className="icon-button danger"
                        aria-label="Revocar invitación"
                        onClick={() =>
                          mutate(
                            () =>
                              api(`/api/admin/invitations/${row.id}`, {
                                method: "DELETE",
                              }),
                            "Invitación revocada",
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
          <div>
            <Section title="Sesiones de todos los dispositivos">
              {data.sessions.map((session: any) => (
                <div
                  className={`session-row ${session.revoked_at ? "revoked" : ""}`}
                  key={session.id}
                >
                  <span>
                    <strong>{session.display_name}</strong>
                    <small>
                      {session.device_name} · visto{" "}
                      {formatDate(session.last_seen_at)}
                    </small>
                  </span>
                  {session.revoked_at ? (
                    <em>Revocada</em>
                  ) : (
                    <button
                      className="icon-button danger"
                      onClick={() =>
                        mutate(
                          () =>
                            api(`/api/admin/sessions/${session.id}`, {
                              method: "DELETE",
                            }),
                          "Sesión revocada",
                        )
                      }
                      aria-label="Revocar sesión"
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}
      {tab === "contenido" && (
        <>
          <Section title="Publicaciones">
            {data.posts.map((post: any) => (
              <div className="content-admin-row" key={post.id}>
                <span>
                  <strong>{post.title}</strong>
                  <small>
                    {post.author_name} · {formatDate(post.happened_at)}
                  </small>
                </span>
                <button
                  className={`icon-button ${post.is_featured ? "active" : ""}`}
                  title="Destacar"
                  onClick={() =>
                    mutate(() =>
                      patchJson(`/api/admin/posts/${post.id}`, {
                        isFeatured: !post.is_featured,
                      }),
                    )
                  }
                >
                  <Star />
                </button>
                <button
                  className="icon-button danger"
                  onClick={() =>
                    mutate(() =>
                      api(`/api/posts/${post.id}`, { method: "DELETE" }),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </Section>
          <Section title="Comentarios">
            {data.comments.map((comment: any) => (
              <div className="content-admin-row" key={comment.id}>
                <span>
                  <strong>
                    {comment.author_name} en “{comment.post_title}”
                  </strong>
                  <small>{comment.body.slice(0, 140)}</small>
                </span>
                <button
                  className="icon-button danger"
                  onClick={() =>
                    mutate(() =>
                      api(`/api/admin/comments/${comment.id}`, {
                        method: "DELETE",
                      }),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </Section>
          <Section title="Archivos privados en R2">
            {data.media.length ? (
              data.media.map((item: any) => (
                <div className="content-admin-row" key={item.id}>
                  <span>
                    <strong>{item.original_name}</strong>
                    <small>
                      {item.owner_name} · {item.kind} ·{" "}
                      {Math.ceil(item.byte_size / 1024)} KB
                      {!item.post_id && !item.comment_id
                        ? " · sin publicar"
                        : ""}
                    </small>
                  </span>
                  <button
                    className="icon-button danger"
                    aria-label="Eliminar archivo"
                    onClick={() => {
                      if (
                        confirm(
                          "Esto borra el objeto de R2 de forma permanente. ¿Continuar?",
                        )
                      )
                        void mutate(
                          () =>
                            api(`/api/admin/media/${item.id}`, {
                              method: "DELETE",
                            }),
                          "Archivo eliminado de R2",
                        );
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))
            ) : (
              <Empty text="No hay archivos almacenados." />
            )}
          </Section>
          <div className="admin-columns">
            <Section title="Ubicaciones">
              {data.locations.map((location: any) => (
                <div className="content-admin-row" key={location.id}>
                  <MapPin />
                  <span>
                    <strong>{location.label}</strong>
                    <small>{location.usage_count} publicaciones</small>
                  </span>
                  <button
                    className="icon-button danger"
                    onClick={() =>
                      mutate(() =>
                        api(`/api/admin/locations/${location.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </Section>
            <Section title="Encuestas">
              {data.polls.map((poll: any) => (
                <div className="content-admin-row" key={poll.id}>
                  <span>
                    <strong>{poll.question}</strong>
                    <small>{poll.vote_count} votos</small>
                  </span>
                  <button
                    className="icon-button danger"
                    onClick={() =>
                      mutate(() =>
                        api(`/api/admin/polls/${poll.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </Section>
          </div>
          <Section title="Batallas de clips" action={<Swords />}>
            <form
              className="inline-admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate(
                  () =>
                    postJson("/api/admin/battles", {
                      title: form.get("title"),
                      leftPostId: form.get("leftPostId"),
                      rightPostId: form.get("rightPostId"),
                    }),
                  "Batalla creada",
                );
              }}
            >
              <label>
                Título
                <input name="title" required />
              </label>
              <label>
                Clip A
                <select name="leftPostId">
                  {data.posts.map((post: any) => (
                    <option key={post.id} value={post.id}>
                      {post.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Clip B
                <select name="rightPostId">
                  {data.posts.map((post: any) => (
                    <option key={post.id} value={post.id}>
                      {post.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary">Crear</button>
            </form>
            {data.battles.map((battle: any) => (
              <div className="content-admin-row" key={battle.id}>
                <span>
                  <strong>{battle.title}</strong>
                  <small>{battle.status}</small>
                </span>
                <button
                  className="button small"
                  onClick={() =>
                    mutate(() =>
                      patchJson(`/api/admin/battles/${battle.id}`, {
                        status: battle.status === "OPEN" ? "CLOSED" : "OPEN",
                      }),
                    )
                  }
                >
                  {battle.status === "OPEN" ? "Cerrar" : "Reabrir"}
                </button>
              </div>
            ))}
          </Section>
        </>
      )}
      {tab === "lore" && (
        <Section title="Propuestas pendientes">
          {data.lore.length ? (
            data.lore.map((entry: any) => (
              <article className="lore-review" key={entry.id}>
                <div>
                  <p className="eyebrow">PROPUESTA DE {entry.proposer_name}</p>
                  <h3>{entry.title}</h3>
                  <strong>{entry.summary}</strong>
                  <p>{entry.body}</p>
                </div>
                <div>
                  <button
                    className="button"
                    onClick={() =>
                      mutate(
                        () =>
                          patchJson(`/api/admin/lore/${entry.id}`, {
                            status: "REJECTED",
                            reviewNote: "",
                          }),
                        "Propuesta rechazada",
                      )
                    }
                  >
                    Rechazar
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      mutate(
                        () =>
                          patchJson(`/api/admin/lore/${entry.id}`, {
                            status: "APPROVED",
                            reviewNote: "",
                          }),
                        "Lore aprobado",
                      )
                    }
                  >
                    <Check /> Aprobar
                  </button>
                  <button
                    className="button small"
                    onClick={() => void removeLore(entry)}
                  >
                    <Trash2 /> Eliminar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <Empty text="No hay propuestas pendientes." />
          )}
        </Section>
      )}
      {tab === "lore" && (
        <Section title="Entradas aprobadas">
          {data.approvedLore.length ? (
            data.approvedLore.map((entry: any) => (
              <article className="lore-review" key={entry.id}>
                <div>
                  <p className="eyebrow">CANON APROBADO</p>
                  <h3>{entry.title}</h3>
                  <strong>{entry.summary}</strong>
                  <p>{entry.body}</p>
                  <small>Propuesto por {entry.proposer_name}</small>
                </div>
                <div>
                  <button
                    className="button small"
                    onClick={() => void removeLore(entry)}
                  >
                    <Trash2 /> Eliminar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <Empty text="No hay entradas aprobadas." />
          )}
        </Section>
      )}
      {tab === "catalogos" && (
        <div className="catalogs">
          {Object.entries(data.catalogs).map(
            ([entity, items]: [string, any]) => (
              <Section
                key={entity}
                title={entity.charAt(0).toUpperCase() + entity.slice(1)}
                action={
                  <button
                    className="button small"
                    onClick={() => setCatalog({ entity })}
                  >
                    <Plus /> Añadir
                  </button>
                }
              >
                <div className="catalog-list">
                  {items.map((item: any) => (
                    <div key={item.id}>
                      <span>{item.icon || item.emoji || "•"}</span>
                      <div>
                        <strong>
                          {item.label || item.title || item.prompt}
                        </strong>
                        <small>{item.slug || item.kind || item.year}</small>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setCatalog({ entity, item })}
                      >
                        <Pencil />
                      </button>
                      {(entity === "achievements" || entity === "awards") && (
                        <button
                          className="button small"
                          onClick={() =>
                            setAssignment({
                              entity: entity as "achievements" | "awards",
                              item,
                            })
                          }
                        >
                          Asignar
                        </button>
                      )}
                      <button
                        className="icon-button danger"
                        onClick={() =>
                          mutate(() =>
                            api(`/api/admin/catalog/${entity}/${item.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                </div>
              </Section>
            ),
          )}
        </div>
      )}
      {tab === "ajustes" && (
        <Section title="Configuración editable">
          {data.settings.map((setting: any) => (
            <form
              key={setting.key}
              className="setting-row"
              onSubmit={(event) => {
                event.preventDefault();
                const raw = String(
                  new FormData(event.currentTarget).get("value"),
                );
                let value: unknown;
                try {
                  value = JSON.parse(raw);
                } catch {
                  value = raw;
                }
                void mutate(() =>
                  patchJson(`/api/admin/settings/${setting.key}`, { value }),
                );
              }}
            >
              <span>
                <strong>{setting.key}</strong>
                <small>{setting.description}</small>
              </span>
              <input name="value" defaultValue={setting.value_json} />
              <button className="button small">Guardar</button>
            </form>
          ))}
        </Section>
      )}
      {catalog && (
        <Modal
          title={`${catalog.item ? "Editar" : "Añadir"} ${catalog.entity}`}
          onClose={() => setCatalog(null)}
        >
          <CatalogForm
            entity={catalog.entity}
            item={catalog.item}
            onDone={() => {
              setCatalog(null);
              void load();
            }}
          />
        </Modal>
      )}
      {assignment && (
        <Modal
          title={`Asignar ${assignment.item.title}`}
          onClose={() => setAssignment(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const url =
                assignment.entity === "achievements"
                  ? `/api/admin/achievements/${assignment.item.id}/award`
                  : `/api/admin/awards/${assignment.item.id}/winners`;
              void mutate(
                () =>
                  postJson(url, {
                    userId: form.get("userId"),
                    note: form.get("note") ?? "",
                  }),
                "Premio asignado",
              ).then(() => setAssignment(null));
            }}
          >
            <label>
              Miembro
              <select name="userId">
                {data.users.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                  </option>
                ))}
              </select>
            </label>
            {assignment.entity === "awards" && (
              <label>
                Nota
                <textarea name="note" maxLength={500} rows={3} />
              </label>
            )}
            <button className="button primary full">Asignar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
