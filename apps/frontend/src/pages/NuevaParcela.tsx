import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapaPoligono } from '../components/MapaPoligono';
import { useAuth } from '../context/useAuth';

export function NuevaParcela() {
  const { token } = useAuth();
  const navigate = useNavigate();
  // Debe mantenerse sincronizada con MAX_HECTAREAS_PARCELA en apps/bff/src/routes/parcelas.ts.
  // El BFF recalcula el área y rechaza con 400 si se supera.
  const MAX_HECTAREAS_PARCELA = 5_000;
  const [nombre, setNombre] = useState('');
  const [poligono, setPoligono] = useState<GeoJSON.Polygon | null>(null);
  const [hectareas, setHectareas] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const excedeMaximo = hectareas !== null && hectareas > MAX_HECTAREAS_PARCELA;

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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ nombre, poligono, hectareas }),
        },
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }
      alert('¡Parcela guardada con éxito!');
      navigate('/panel');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error de conexión';
      alert(`Error al guardar la parcela: ${message}`);
    } finally {
      setGuardando(false);
    }
  };

  const puedeGuardar =
    nombre.trim().length > 0 && poligono !== null && !guardando && !excedeMaximo;

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
        Podés buscar tu ciudad o pueblo con el buscador arriba a la derecha del mapa
        y luego dibujar el contorno de tu lote con la herramienta de polígono (ícono arriba a la izquierda).
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

      {excedeMaximo && (
        <p
          role="alert"
          style={{
            marginTop: '0.5rem',
            fontSize: '1rem',
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
          }}
        >
          El polígono supera el máximo de {MAX_HECTAREAS_PARCELA.toLocaleString('es-AR')} ha por
          parcela. Delimitá una parcela más chica o dividí el campo en varias.
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
