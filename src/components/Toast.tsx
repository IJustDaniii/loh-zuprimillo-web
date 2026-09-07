export function Toast({
  message,
  kind = "info",
  onClose,
}: {
  message: string;
  kind?: "info" | "error";
  onClose?: () => void;
}) {
  return (
    <div
      className={`toast toast-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {message}
      {onClose && (
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
