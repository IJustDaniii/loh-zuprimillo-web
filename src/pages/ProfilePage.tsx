import { Award, Edit3, MessageCircle, Trophy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import type { Member, Paginated, PostView } from "../../shared/contracts";
import { useApp } from "../context/AppContext";
import { api, patchJson } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { levelForXp } from "../lib/format";
import { PostCard } from "../components/PostCard";
import { Modal } from "../components/Modal";
import { Loading } from "../components/Loading";

export function ProfilePage() {
  const { handle } = useParams();
  const { data: app, reload: reloadApp } = useApp();
  const [profile, setProfile] = useState<{
    member: Member;
    stats: { posts: number; comments: number; level: number };
    achievements: any[];
    awards: any[];
  } | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [editing, setEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const load = async () => {
    const p = await api<any>(`/api/members/${handle}`);
    setProfile(p);
    setPosts(
      (await api<Paginated<PostView>>(`/api/posts?author=${p.member.id}`)).data,
    );
  };
  useEffect(() => {
    void load();
  }, [handle]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await patchJson("/api/profile", {
      bio: new FormData(event.currentTarget).get("bio"),
    });
    if (avatarFile) {
      const upload = new FormData();
      upload.set("file", avatarFile);
      const result = await api<{ media: { id: string } }>("/api/media", {
        method: "POST",
        body: upload,
      });
      await patchJson("/api/profile/avatar", { mediaId: result.media.id });
    }
    setEditing(false);
    setAvatarFile(null);
    await Promise.all([load(), reloadApp()]);
  };
  if (!profile) return <Loading />;
  const own = app?.member.id === profile.member.id;
  const level = levelForXp(profile.member.xp);
  return (
    <div className="page">
      <section className="profile-hero">
        <div className="profile-pattern" />
        <Avatar member={profile.member} size="lg" />
        <div className="profile-heading">
          <p className="eyebrow">
            MIEMBRO Nº{" "}
            {String(
              (app?.members.findIndex((m) => m.id === profile.member.id) ?? 0) +
                1,
            ).padStart(2, "0")}
          </p>
          <h1>{profile.member.displayName}</h1>
          <p>
            @{profile.member.handle} · Nivel {level}
          </p>
        </div>
        {own && (
          <button className="button secondary" onClick={() => setEditing(true)}>
            <Edit3 /> Editar perfil
          </button>
        )}
      </section>
      <p className="profile-bio">
        {profile.member.bio || "Todavía no ha escrito su manifiesto."}
      </p>
      <div className="stats-strip">
        <div>
          <strong>{profile.stats.posts}</strong>
          <span>publicaciones</span>
        </div>
        <div>
          <strong>{profile.stats.comments}</strong>
          <span>comentarios</span>
        </div>
        <div>
          <strong>{profile.member.xp}</strong>
          <span>XP</span>
        </div>
        <div>
          <strong>{level}</strong>
          <span>nivel</span>
        </div>
      </div>
      <section className="profile-section">
        <h2>
          <Trophy /> Logros
        </h2>
        {profile.achievements.length ? (
          <div className="achievement-row">
            {profile.achievements.map((a) => (
              <div key={a.id}>
                <span>{a.icon}</span>
                <strong>{a.title}</strong>
                <small>{a.description}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no hay medallas. Sospechamos amaño.</p>
        )}
      </section>
      {profile.awards.length > 0 && (
        <section className="profile-section">
          <h2>
            <Award /> Premios
          </h2>
          {profile.awards.map((a) => (
            <p key={a.id}>
              {a.icon} <strong>{a.title}</strong> · {a.year}
            </p>
          ))}
        </section>
      )}
      <section className="profile-section">
        <h2>
          <MessageCircle /> Publicaciones
        </h2>
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onChanged={load} />
          ))}
        </div>
      </section>
      {editing && (
        <Modal title="Editar perfil" onClose={() => setEditing(false)}>
          <form onSubmit={save}>
            <label>
              Descripción
              <textarea
                name="bio"
                rows={6}
                maxLength={500}
                defaultValue={profile.member.bio}
              />
            </label>
            <label>
              Avatar <span className="optional">opcional</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) =>
                  setAvatarFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <button className="button primary full">Guardar cambios</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
