import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
}

export interface LocalidadItem {
  id: number;
  nombre: string;
  detalle: string;
  lat: number;
  lon: number;
}

export const BuscadorLocalidades: React.FC = () => {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeMarkerRef = useRef<L.Marker | null>(null);

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<LocalidadItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evitar que Leaflet capture clicks o scroll sobre el buscador
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // Limpiar el marcador al desmontar el componente
  useEffect(() => {
    return () => {
      if (activeMarkerRef.current) {
        activeMarkerRef.current.remove();
        activeMarkerRef.current = null;
      }
    };
  }, []);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickAfuera = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };

    document.addEventListener('mousedown', handleClickAfuera);
    return () => {
      document.removeEventListener('mousedown', handleClickAfuera);
    };
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim().length < 3) {
      setResultados([]);
      setAbierto(false);
      setError(null);
      setCargando(false);
    }
  };

  // Búsqueda con debounce hacia Nominatim OpenStreetMap
  useEffect(() => {
    const termino = query.trim();
    if (termino.length < 3) {
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          termino,
        )}&countrycodes=ar&limit=5&addressdetails=1`;

        const res = await fetch(url, {
          signal: abortController.signal,
          headers: {
            // Nominatim requiere User-Agent descriptivo
            'Accept-Language': 'es-AR,es',
          },
        });

        if (!res.ok) {
          throw new Error('Servicio de geocodificación no disponible');
        }

        const data: NominatimResult[] = await res.json();
        const parseados: LocalidadItem[] = data.map((item) => {
          const parts = item.display_name.split(',').map((p) => p.trim());
          const nombre =
            item.name ||
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            parts[0];
          const detalle = parts.slice(1, 4).join(', ');

          return {
            id: item.place_id,
            nombre,
            detalle,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          };
        });

        setResultados(parseados);
        setAbierto(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('No se pudo buscar la localidad.');
        }
      } finally {
        setCargando(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  const seleccionarLocalidad = useCallback(
    (item: LocalidadItem) => {
      setAbierto(false);
      setQuery(item.nombre);

      // Eliminar marcador previo si existía
      if (activeMarkerRef.current) {
        activeMarkerRef.current.remove();
      }

      // Marcador visual con emoji sin dependencias de assets externos
      const pinIcon = L.divIcon({
        className: 'nominatim-marker-pin',
        html: `<div style="font-size: 28px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45)); cursor: pointer;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([item.lat, item.lon], { icon: pinIcon }).addTo(map);

      marker
        .bindPopup(
          `<div style="font-family: inherit; font-size: 13px; min-width: 140px;">
            <strong style="color: #065f46; font-size: 14px; display: block;">${item.nombre}</strong>
            <span style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">${item.detalle}</span>
            <span style="color: #059669; font-size: 10px; font-weight: 600; display: block; margin-top: 6px;">
              🌱 Zona lista para delimitar
            </span>
          </div>`,
        )
        .openPopup();

      activeMarkerRef.current = marker;

      // Volar hacia la localidad con nivel de zoom apropiado para delimitación
      map.flyTo([item.lat, item.lon], 13, { duration: 1.5 });
    },
    [map],
  );

  const limpiarBusqueda = () => {
    setQuery('');
    setResultados([]);
    setAbierto(false);
    setError(null);
    if (activeMarkerRef.current) {
      activeMarkerRef.current.remove();
      activeMarkerRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="leaflet-top leaflet-right"
      style={{
        margin: '12px 12px 0 0',
        zIndex: 1000,
        pointerEvents: 'auto',
        width: '320px',
        maxWidth: 'calc(100vw - 80px)',
      }}
    >
      <div className="relative font-sans text-slate-800">
        {/* Input de Búsqueda */}
        <div className="relative flex items-center bg-white rounded-xl shadow-md border border-slate-200 transition focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
          <span className="pl-3 text-slate-400 text-sm select-none" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (resultados.length > 0) setAbierto(true);
            }}
            placeholder="Buscar localidad (ej: Pergamino)..."
            className="w-full py-2.5 pl-2.5 pr-8 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            aria-label="Buscar localidad en Argentina"
          />

          {cargando ? (
            <div className="pr-3 flex items-center" aria-label="Buscando...">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            query.length > 0 && (
              <button
                type="button"
                onClick={limpiarBusqueda}
                className="pr-3 text-slate-400 hover:text-slate-600 text-sm font-bold transition focus:outline-none"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )
          )}
        </div>

        {/* Dropdown de Resultados */}
        {abierto && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-50 divide-y divide-slate-100">
            {error ? (
              <div className="p-3 text-xs text-red-600 text-center">{error}</div>
            ) : resultados.length === 0 ? (
              query.trim().length >= 3 &&
              !cargando && (
                <div className="p-3 text-xs text-slate-500 text-center">
                  No se encontraron localidades con ese nombre.
                </div>
              )
            ) : (
              resultados.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => seleccionarLocalidad(item)}
                  className="w-full text-left p-3 hover:bg-emerald-50/70 transition flex items-start gap-2.5 text-xs group"
                >
                  <span className="text-base select-none mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">
                      {item.nombre}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{item.detalle}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
