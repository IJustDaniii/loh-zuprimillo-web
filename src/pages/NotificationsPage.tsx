import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useApp } from "../context/AppContext";

export function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const { reload } = useApp();
  useEffect(() => {
    void Promise.all([
      api<{ data: any[] }>("/api/notifications"),
      api<{ data: any[] }>("/api/activity"),
    ]).then(([notifications, recent]) => {
      setItems(notifications.data);
      setActivity(recent.data);
    });
  }, []);
  const read = async () => {
    await api("/api/notifications/read", { method: "POST" });
    setItems((old) =>
      old.map((item) => ({ ...item, read_at: new Date().toISOString() })),
    );
    await reload();
  };
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">RADAR INTERNO</p>
          <h1>Notificaciones</h1>
        </div>
        <button className="button secondary" onClick={read}>
          <CheckCheck /> Marcar leídas
        </button>
      </header>
      {items.length === 0 ? (
        <div className="empty-state">
          <Bell />
          <h2>Todo sospechosamente tranquilo</h2>
        </div>
      ) : (
        <div className="notification-list">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className={item.read_at ? "" : "unread"}
            >
              <span className="notification-dot" />
              <div>
                <strong>{item.message}</strong>
                <small>{formatDate(item.created_at)}</small>
              </div>
            </Link>
          ))}
        </div>
      )}
      <section className="profile-section">
        <h2>Actividad reciente</h2>
        <div className="notification-list">
          {activity.map((item) => (
            <div className="activity-row" key={`${item.kind}-${item.id}`}>
              <span className="notification-dot" />
              <div>
                <strong>{item.actor}</strong>
                <small>
                  {item.kind === "POST" ? "publicó" : "comentó"}: {item.label}
                </small>
              </div>
              <time>{formatDate(item.created_at)}</time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
