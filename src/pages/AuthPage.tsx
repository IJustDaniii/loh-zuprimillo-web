import { useState, type FormEvent } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { Brand } from "../components/Brand";
import { Toast } from "../components/Toast";
import { postJson } from "../lib/api";
import { useApp } from "../context/AppContext";

type Mode = "login" | "claim" | "bootstrap";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { reload } = useApp();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "login") await postJson("/api/auth/login", values);
      if (mode === "claim") await postJson("/api/auth/claim", values);
      if (mode === "bootstrap") await postJson("/api/auth/bootstrap", values);
      await reload();
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-poster">
        <Brand />
        <div>
          <p className="eyebrow">
            Archivo privado · desde ahora hasta que dé vergüenza
          </p>
          <h1>
            Diez personas.
            <br />
            <em>Cero contexto.</em>
          </h1>
          <p>
            Memes, vídeos, lore y pruebas irrefutables de que aquello sí
            ocurrió.
          </p>
        </div>
        <small>Solo miembros · no indexado · no hay registro público</small>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-icon">
            <LockKeyhole />
          </div>
          <h2>
            {mode === "login"
              ? "Vuelve al grupo"
              : mode === "claim"
                ? "Canjea tu pase"
                : "Primera apertura de Dani"}
          </h2>
          <p>
            {mode === "login"
              ? "Aquí no entra ni el algoritmo."
              : "Una invitación, una persona, una vez."}
          </p>
          {error && (
            <Toast message={error} kind="error" onClose={() => setError("")} />
          )}
          <form onSubmit={submit}>
            {mode === "login" && (
              <label>
                Usuario
                <input
                  name="handle"
                  autoComplete="username"
                  required
                  placeholder="dani"
                />
              </label>
            )}
            {mode === "claim" && (
              <label>
                Código de invitación
                <input name="code" autoComplete="one-time-code" required />
              </label>
            )}
            {mode === "bootstrap" && (
              <label>
                Token inicial
                <input name="token" type="password" required />
              </label>
            )}
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={10}
                required
              />
            </label>
            <label>
              Nombre de este dispositivo{" "}
              <span className="optional">opcional</span>
              <input name="deviceName" placeholder="Móvil personal" />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Comprobando…"
                : mode === "login"
                  ? "Entrar"
                  : "Activar cuenta"}
            </button>
          </form>
          <div className="auth-modes">
            {mode !== "login" && (
              <button onClick={() => setMode("login")}>Ya tengo cuenta</button>
            )}
            {mode !== "claim" && (
              <button onClick={() => setMode("claim")}>
                <KeyRound /> Tengo invitación
              </button>
            )}
            {mode !== "bootstrap" && (
              <button
                className="subtle-link"
                onClick={() => setMode("bootstrap")}
              >
                Inicializar Dani
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
