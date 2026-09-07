import {
  Bell,
  Compass,
  Gamepad2,
  Home,
  LogOut,
  Moon,
  Plus,
  Search,
  Shield,
  Sun,
  UserRound,
} from "lucide-react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import { useApp } from "./context/AppContext";
import { api } from "./lib/api";
import { Brand } from "./components/Brand";
import { Avatar } from "./components/Avatar";
import { Loading } from "./components/Loading";
import { Modal } from "./components/Modal";
import { AuthPage } from "./pages/AuthPage";
import { FeedPage } from "./pages/FeedPage";
import { ExplorePage } from "./pages/ExplorePage";
import { GamesPage } from "./pages/GamesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PostPage } from "./pages/PostPage";
import { AdminPage } from "./pages/AdminPage";
import { ComposePost } from "./components/ComposePost";

const nav = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/juegos", label: "Juegos", icon: Gamepad2 },
  { to: "/notificaciones", label: "Avisos", icon: Bell },
];

function Shell() {
  const { data, reload, setTheme } = useApp();
  const [compose, setCompose] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  if (!data) return null;
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    await reload();
    navigate("/");
  };
  return (
    <div
      className="app-shell"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".protected-media"))
          e.preventDefault();
      }}
    >
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Principal">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon />
              <span>{label}</span>
              {label === "Avisos" && data.unreadNotifications > 0 && (
                <b className="badge">{data.unreadNotifications}</b>
              )}
            </NavLink>
          ))}
          <NavLink to={`/perfil/${data.member.handle}`}>
            <UserRound />
            <span>Perfil</span>
          </NavLink>
          {data.member.role === "ADMIN" && (
            <NavLink to="/admin">
              <Shield />
              <span>Administración</span>
            </NavLink>
          )}
        </nav>
        <button
          className="button primary compose-button"
          onClick={() => setCompose(true)}
        >
          <Plus /> Publicar
        </button>
        <div className="sidebar-foot">
          <div className="theme-switch" aria-label="Tema">
            <button onClick={() => setTheme("light")} title="Claro">
              <Sun />
            </button>
            <button onClick={() => setTheme("dark")} title="Oscuro">
              <Moon />
            </button>
            <button onClick={() => setTheme("auto")} title="Automático">
              A
            </button>
          </div>
          <NavLink
            className="account-chip"
            to={`/perfil/${data.member.handle}`}
          >
            <Avatar member={data.member} size="sm" />
            <span>
              <strong>{data.member.displayName}</strong>
              <small>@{data.member.handle}</small>
            </span>
          </NavLink>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Cerrar sesión"
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <main key={location.pathname} className="main-content">
        <Routes>
          <Route
            path="/"
            element={<FeedPage onCompose={() => setCompose(true)} />}
          />
          <Route path="/buscar" element={<FeedPage searchMode />} />
          <Route path="/explorar" element={<ExplorePage />} />
          <Route path="/juegos" element={<GamesPage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/perfil/:handle" element={<ProfilePage />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route
            path="/admin"
            element={
              data.member.role === "ADMIN" ? <AdminPage /> : <Navigate to="/" />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {nav.slice(0, 3).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} aria-label={label}>
            <Icon />
          </NavLink>
        ))}
        <button onClick={() => setCompose(true)} aria-label="Publicar">
          <Plus />
        </button>
        <NavLink to="/buscar" aria-label="Buscar">
          <Search />
        </NavLink>
      </nav>
      {compose && (
        <Modal title="Añadir al archivo" onClose={() => setCompose(false)}>
          <ComposePost
            onCreated={(id) => {
              setCompose(false);
              void reload();
              navigate(`/post/${id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const { loading, authRequired, data, error } = useApp();
  if (loading)
    return (
      <div className="center-page">
        <Brand />
        <Loading />
      </div>
    );
  if (authRequired) return <AuthPage />;
  if (error)
    return (
      <div className="center-page">
        <Brand />
        <h1>Se nos cayó el chiringuito</h1>
        <p>{error}</p>
        <button className="button" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    );
  return data ? <Shell /> : null;
}
