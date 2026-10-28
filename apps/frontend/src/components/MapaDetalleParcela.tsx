import { useEffect, type CSSProperties } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Polygon } from 'geojson';
import 'leaflet/dist/leaflet.css';

interface MapaDetalleParcelaProps {
  poligono: Polygon;
  nombre?: string | null;
  hectareas?: number | null;
}

/**
 * Subcomponente que ajusta la cámara del mapa a los límites exactos del polígono
 * y dibuja el contorno con estilo agronómico.
 */
function VisualizadorPoligono({ poligono }: { poligono: Polygon }) {
  const map = useMap();

  useEffect(() => {
    if (!poligono?.coordinates || poligono.coordinates.length === 0) return;

    try {
      const layer = L.geoJSON(poligono);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
      }
    } catch (err) {
      console.error('Error al encuadrar el polígono de la parcela:', err);
    }
  }, [map, poligono]);

  return (
    <GeoJSON
      key={JSON.stringify(poligono)}
      data={poligono}
      style={{
        color: '#059669', // emerald-600
        weight: 3,
        fillColor: '#10b981', // emerald-500
        fillOpacity: 0.35,
      }}
    />
  );
}

const MAP_CONTAINER_STYLE: CSSProperties = {
  height: '360px',
  width: '100%',
  zIndex: 10,
};

export function MapaDetalleParcela({ poligono }: MapaDetalleParcelaProps) {
  // Coordenadas de respaldo para Argentina central si el polígono tarda en montar
  const centroFallback: [number, number] = [-38, -63];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
      <MapContainer
        center={centroFallback}
        zoom={6}
        scrollWheelZoom={false}
        style={MAP_CONTAINER_STYLE}
      >
        {/* Capa de imagen satelital Esri World Imagery */}
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        {/* Capa de nombres de ciudades, rutas y límites */}
        <TileLayer
          attribution="Boundaries &copy; Esri"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <VisualizadorPoligono poligono={poligono} />
      </MapContainer>
    </div>
  );
}
