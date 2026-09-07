export function Loading({ label = "Cargando el salseo…" }: { label?: string }) {
  return (
    <div className="loading" aria-busy="true">
      <span className="spinner" />
      {label}
    </div>
  );
}
