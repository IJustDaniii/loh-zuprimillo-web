import L from "leaflet";
import { useEffect, useRef } from "react";

export function MemoryMap({ points }: { points: any[] }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { zoomControl: true }).setView(
      [40.4168, -3.7038],
      5,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    const bounds: L.LatLngExpression[] = [];
    points.forEach((point) => {
      const pos: L.LatLngExpression = [point.latitude, point.longitude];
      bounds.push(pos);
      L.circleMarker(pos, {
        radius: 9,
        color: "#111",
        weight: 3,
        fillColor: "#ff5c35",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(point.title)}</strong><br>${escapeHtml(point.label)}`,
        );
    });
    if (bounds.length)
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 13 });
    return () => {
      map.remove();
    };
  }, [points]);
  return (
    <div
      ref={element}
      className="memory-map"
      role="application"
      aria-label="Mapa de publicaciones"
    />
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );
}
