import { useEffect, useCallback, type CSSProperties } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import * as turf from '@turf/turf';
import { BuscadorLocalidades } from './BuscadorLocalidades';

interface MapaPoligonoProps {
  onPolygonChange: (
    geojson: GeoJSON.Polygon | null,
    hectareas: number | null,
  ) => void;
}

/**
 * Headless component that wires Geoman drawing tools to the parent callback.
 * Calculates area with turf.js on every create / edit / remove event.
 */
function GeomanController({ onPolygonChange }: MapaPoligonoProps) {
  const map = useMap();

  const computeFromLayer = useCallback(
    (layer: L.Layer) => {
      const geojson = (layer as L.Polygon).toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
      const polygon = geojson.geometry;
      const areaM2 = turf.area(polygon);
      onPolygonChange(polygon, areaM2 / 10_000);
    },
    [onPolygonChange],
  );

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawPolygon: true,
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawRectangle: false,
      drawPolyline: false,
      drawText: false,
      editMode: true,
      removalMode: true,
    });

    const onCreate = (e: L.LeafletEvent) => {
      const ev = e as unknown as { layer: L.Layer };
      computeFromLayer(ev.layer);
    };
    const onEdit = (e: L.LeafletEvent) => {
      const ev = e as unknown as { layer: L.Layer };
      computeFromLayer(ev.layer);
    };
    const onRemove = () => onPolygonChange(null, null);

    map.on('pm:create', onCreate);
    map.on('pm:edit', onEdit);
    map.on('pm:remove', onRemove);

    return () => {
      map.off('pm:create', onCreate);
      map.off('pm:edit', onEdit);
      map.off('pm:remove', onRemove);
    };
  }, [map, computeFromLayer, onPolygonChange]);

  return null;
}

const MAP_STYLE: CSSProperties = { height: '500px', width: '100%' };

export function MapaPoligono({ onPolygonChange }: MapaPoligonoProps) {
  return (
    <MapContainer
      center={[-38, -63]}
      zoom={5}
      scrollWheelZoom
      style={MAP_STYLE}
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {/* Capa de referencia (limites de provincias/paises + nombres de ciudades)
          apilada sobre la imagen satelital. El usuario la usa para ubicarse;
          la base de imagery no cambia. */}
      <TileLayer
        attribution="Boundaries &copy; Esri"
        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <GeomanController onPolygonChange={onPolygonChange} />
      <BuscadorLocalidades />
    </MapContainer>
  );
}
