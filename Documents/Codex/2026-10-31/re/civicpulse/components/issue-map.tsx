"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { CivicIssue } from "@/lib/issues";

function pinIcon(selected: boolean) {
  return L.divIcon({
  className: "",
  html: `<span class="map-pin${selected ? " is-selected" : ""}" aria-hidden="true"><span class="map-pin-dot"></span></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  });
}

function MapFocus({ position }: { position?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [map, position]);
  return null;
}

export default function IssueMap({ issues, selectedId, onSelect }: {
  issues: CivicIssue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const demoCenter: [number, number] = [20.2961, 85.8245];
  const positioned = useMemo(() => issues.filter((issue) => issue.position), [issues]);

  return (
    <MapContainer center={demoCenter} zoom={13} scrollWheelZoom={false} aria-label="Map of sample civic issue locations">
      <MapFocus position={positioned.find((issue) => issue.id === selectedId)?.position} />
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positioned.map((issue) => (
        <Marker
          key={issue.id}
          position={issue.position!}
          icon={pinIcon(issue.id === selectedId)}
          eventHandlers={{ click: () => onSelect(issue.id) }}
        >
          <Tooltip direction="top" offset={[0, -24]}>{issue.title}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
