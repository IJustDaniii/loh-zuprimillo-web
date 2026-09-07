import { useState, type FormEvent } from "react";
import { postJson } from "../lib/api";
import { Toast } from "./Toast";

export function LoreProposal({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await postJson("/api/lore", {
        ...values,
        happenedAt: values.happenedAt
          ? new Date(String(values.happenedAt)).toISOString()
          : "",
      });
      onDone();
    } catch (caught: any) {
      setError(caught.message);
    }
  };
  return (
    <form onSubmit={submit}>
      {error && <Toast message={error} kind="error" />}
      <label>
        Título
        <input name="title" maxLength={180} required />
      </label>
      <label>
        Resumen
        <textarea name="summary" maxLength={500} rows={2} required />
      </label>
      <label>
        Entrada completa
        <textarea name="body" maxLength={20000} rows={8} required />
      </label>
      <label>
        Fecha aproximada <span className="optional">opcional</span>
        <input name="happenedAt" type="datetime-local" />
      </label>
      <p className="form-note">
        Dani revisará la propuesta antes de que aparezca en el lore.
      </p>
      <button className="button primary full">Enviar propuesta</button>
    </form>
  );
}
