export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="LOH ZUPRIMILLO">
      <span className="brand-mark" aria-hidden>
        Ż
      </span>
      {!compact && (
        <span>
          LOH
          <br />
          <strong>ZUPRIMILLO'</strong>
        </span>
      )}
    </div>
  );
}
