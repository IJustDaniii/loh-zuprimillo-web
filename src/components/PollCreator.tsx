import { useState, type FormEvent } from "react";
import { postJson } from "../lib/api";

export function PollCreator({ onDone }: { onDone: () => void }) {
  const [options, setOptions] = useState(["", ""]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/polls", {
      question: form.get("question"),
      options: options.filter(Boolean),
      closesAt: form.get("closesAt")
        ? new Date(String(form.get("closesAt"))).toISOString()
        : "",
      isMultiple: form.get("isMultiple") === "on",
    });
    onDone();
  };
  return (
    <form onSubmit={submit}>
      <label>
        Pregunta
        <input name="question" required maxLength={300} />
      </label>
      <fieldset>
        <legend>Opciones</legend>
        {options.map((option, index) => (
          <input
            key={index}
            value={option}
            required
            onChange={(e) =>
              setOptions((old) =>
                old.map((item, i) => (i === index ? e.target.value : item)),
              )
            }
            placeholder={`Opción ${index + 1}`}
          />
        ))}
        {options.length < 10 && (
          <button
            type="button"
            className="text-button"
            onClick={() => setOptions((old) => [...old, ""])}
          >
            + Añadir opción
          </button>
        )}
      </fieldset>
      <label>
        Cierra <span className="optional">opcional</span>
        <input name="closesAt" type="datetime-local" />
      </label>
      <label className="check-line">
        <input name="isMultiple" type="checkbox" /> Permitir varias respuestas
      </label>
      <button className="button primary full">Crear encuesta</button>
    </form>
  );
}
