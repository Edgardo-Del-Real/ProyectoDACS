import { useState, useCallback } from 'react';
import { MapaPoligono } from '../components/MapaPoligono';

export function NuevaParcela() {
  const [nombre, setNombre] = useState('');
  const [poligono, setPoligono] = useState<GeoJSON.Polygon | null>(null);
  const [hectareas, setHectareas] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const handlePolygonChange = useCallback(
    (geojson: GeoJSON.Polygon | null, ha: number | null) => {
      setPoligono(geojson);
      setHectareas(ha);
    },
    [],
  );

  const handleGuardar = async () => {
    if (!nombre.trim() || !poligono) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, poligono, hectareas }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // TODO: redirect to parcel list on success
      alert('Parcela guardada');
    } catch (err) {
      console.error(err);
      alert('Error al guardar la parcela');
    } finally {
      setGuardando(false);
    }
  };

  const puedeGuardar = nombre.trim().length > 0 && poligono !== null && !guardando;

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Nueva parcela</h1>

      <label style={{ display: 'block', marginBottom: '1rem' }}>
        <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
          Nombre de la parcela
        </span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Campo Los Álamos"
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </label>

      <p style={{ marginBottom: '0.5rem', color: '#555' }}>
        Dibujá el polígono de tu campo usando la herramienta de dibujo (ícono de
        polígono arriba a la izquierda del mapa).
      </p>

      <MapaPoligono onPolygonChange={handlePolygonChange} />

      {hectareas !== null && (
        <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>
          Superficie:{' '}
          <strong>
            {hectareas.toFixed(2)} ha
          </strong>
        </p>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button
          onClick={handleGuardar}
          disabled={!puedeGuardar}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: puedeGuardar ? '#1a73e8' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: puedeGuardar ? 'pointer' : 'not-allowed',
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar parcela'}
        </button>
      </div>
    </div>
  );
}
