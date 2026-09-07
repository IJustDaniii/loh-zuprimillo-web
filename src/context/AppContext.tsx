import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Member, SessionView } from "../../shared/contracts";
import { api } from "../lib/api";

type Tag = { id: string; slug: string; label: string; color: string };
type Reaction = {
  id: string;
  slug: string;
  label: string;
  emoji: string | null;
  image_media_id: string | null;
};
type Bootstrap = {
  member: Member;
  members: Member[];
  tags: Tag[];
  reactions: Reaction[];
  settings: Record<string, unknown>;
  sessions: SessionView[];
  unreadNotifications: number;
};
type AppState = {
  data: Bootstrap | null;
  loading: boolean;
  authRequired: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setTheme: (theme: string) => void;
};

const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<Bootstrap>("/api/bootstrap"));
      setAuthRequired(false);
    } catch (caught: any) {
      if (caught.status === 401) setAuthRequired(true);
      else setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  const setTheme = useCallback((theme: string) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lohz-theme", theme);
  }, []);
  useEffect(
    () => setTheme(localStorage.getItem("lohz-theme") ?? "auto"),
    [setTheme],
  );
  const value = useMemo(
    () => ({ data, loading, authRequired, error, reload, setTheme }),
    [data, loading, authRequired, error, reload, setTheme],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("useApp debe usarse dentro de AppProvider");
  return value;
}
