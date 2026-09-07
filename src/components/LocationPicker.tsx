import { MapPin, Search } from "lucide-react";
import { useState } from "react";

export type PickedLocation = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (query.trim().length < 3) return;
    setBusy(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("El buscador de lugares no responde.");
      const payload: unknown = await response.json();
      setResults(
        Array.isArray(payload)
          ? payload
              .filter(
                (item) =>
                  item &&
                  typeof item.place_id === "number" &&
                  typeof item.display_name === "string" &&
                  Number.isFinite(Number(item.lat)) &&
                  Number.isFinite(Number(item.lon)),
              )
              .slice(0, 5)
          : [],
      );
    } finally {
      setBusy(false);
    }
  };
  if (value)
    return (
      <div className="location-selected">
        <MapPin />
        <span>
          <strong>{value.label}</strong>
          <small>{value.address}</small>
        </span>
        <button type="button" onClick={() => onChange(null)}>
          Quitar
        </button>
      </div>
    );
  return (
    <div className="location-picker">
      <div className="inline-input">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una dirección o lugar"
        />
        <button
          type="button"
          className="button small"
          onClick={search}
          disabled={busy}
        >
          <Search />
          {busy ? "Buscando" : "Buscar"}
        </button>
      </div>
      <small>La búsqueda se envía a OpenStreetMap solo al pulsar Buscar.</small>
      {results.length > 0 && (
        <div className="location-results">
          {results.map((item) => (
            <button
              type="button"
              key={item.place_id}
              onClick={() => {
                onChange({
                  label: item.name || item.display_name.split(",")[0],
                  address: item.display_name,
                  latitude: Number(item.lat),
                  longitude: Number(item.lon),
                });
                setResults([]);
              }}
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
