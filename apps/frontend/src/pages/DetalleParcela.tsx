import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

interface PronosticoDia {
  fecha: string;
  tempMax: number;
  tempMin: number;
  precipitacion: number;
}

interface PronosticoResponse {
  parcelaId: string;
  parcelaNombre: string | null;
  pronostico: PronosticoDia[];
  stale: boolean;
  fetchedAt: string;
}

interface Campania {
  id: string;
  cultivo: string;
  campania: string;
  rindeReal: number | null;
  observaciones: string | null;
  createdAt: string;
}

const CULTIVOS_COMUNES = [
  'Soja 1ra',
  'Soja 2da',
  'Maíz temprano',
  'Maíz tardío',
  'Trigo',
  'Girasol',
  'Cebada',
  'Sorgo',
  'Pastura / Barbecho',
];

export function DetalleParcela() {
  const { id } = useParams<{ id: string }>();
  const [pronostico, setPronostico] = useState<PronosticoResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para Historial de Campañas (US-04)
  const [campanias, setCampanias] = useState<Campania[]>([]);
  const [cargandoCampanias, setCargandoCampanias] = useState(false);
  const [mostrarFormCampania, setMostrarFormCampania] = useState(false);
  const [cultivo, setCultivo] = useState(CULTIVOS_COMUNES[0]);
  const [campania, setCampania] = useState('2024/2025');
  const [rindeReal, setRindeReal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardandoCampania, setGuardandoCampania] = useState(false);

  const getToken = () => localStorage.getItem('token') || localStorage.getItem('dacs_token');

  // Cargar campañas (US-04 Criterio 2: ordenadas por campaña)
  const cargarCampanias = useCallback(async () => {
    if (!id) return;
    const token = getToken();
    if (!token) return;

    setCargandoCampanias(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${id}/campanias`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setCampanias(data);
      }
    } catch (err) {
      console.error('Error al cargar historial de campañas:', err);
    } finally {
      setCargandoCampanias(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const obtenerPronostico = async () => {
      try {
        const token = getToken();
        if (!token) {
          setError('No hay sesión activa. Por favor, iniciá sesión.');
          setCargando(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${id}/clima`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            setError('Sesión expirada. Por favor, iniciá sesión nuevamente.');
          } else if (response.status === 404) {
            setError('Parcela no encontrada.');
          } else {
            const data = await response.json();
            setError(data.message || 'Error al obtener el pronóstico');
          }
          setCargando(false);
          return;
        }

        const data: PronosticoResponse = await response.json();
        setPronostico(data);
        setCargando(false);
      } catch {
        setError('Error de conexión. Verificá tu conexión a internet.');
        setCargando(false);
      }
    };

    obtenerPronostico();
    // Carga de datos al montar (sincroniza con la API). El setState del spinner es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCampanias();
  }, [id, cargarCampanias]);

  // US-04 Criterio 1: Registrar cultivo en una campaña
  const handleGuardarCampania = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !cultivo || !campania.trim()) return;

    const token = getToken();
    if (!token) {
      alert('Debes iniciar sesión para registrar una campaña');
      return;
    }

    setGuardandoCampania(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${id}/campanias`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cultivo,
            campania: campania.trim(),
            rindeReal: rindeReal ? parseFloat(rindeReal) : undefined,
            observaciones: observaciones.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al guardar la campaña');
      }

      // Limpiar formulario y recargar lista
      setRindeReal('');
      setObservaciones('');
      setMostrarFormCampania(false);
      await cargarCampanias();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la campaña';
      alert(message);
    } finally {
      setGuardandoCampania(false);
    }
  };

  // US-04 Criterio 3: Eliminar registro erróneo
  const handleEliminarCampania = async (campaniaId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro de campaña?')) return;

    const token = getToken();
    if (!token || !id) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${id}/campanias/${campaniaId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error('Error al eliminar');
      }

      await cargarCampanias();
    } catch {
      alert('No se pudo eliminar el registro de campaña');
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <p>Cargando datos de la parcela...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <Link to="/panel">← Volver al panel</Link>
      </div>
    );
  }

  if (!pronostico) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <p>No se encontró la parcela solicitada.</p>
        <Link to="/panel">← Volver al panel</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>
            {pronostico.parcelaNombre || 'Detalle de Parcela'}
          </h1>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            ID: {pronostico.parcelaId}
          </p>
        </div>
        <Link to="/panel" style={{ textDecoration: 'none', color: '#16a34a', fontWeight: 600 }}>
          ← Volver al panel
        </Link>
      </div>

      {pronostico.stale && (
        <div
          style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
          }}
        >
          ⚠️ <strong>Datos desactualizados:</strong> No se pudo actualizar el pronóstico en tiempo real.
          Mostrando datos del {new Date(pronostico.fetchedAt).toLocaleString('es-AR')}.
        </div>
      )}

      {/* --- SECCIÓN 1: PRONÓSTICO DEL CLIMA (US-05) --- */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>☀️ Pronóstico a 7 días (Open-Meteo)</h2>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Actualizado: {new Date(pronostico.fetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          {pronostico.pronostico.map((dia) => (
            <div
              key={dia.fecha}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                {new Date(dia.fecha).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                Máx: <strong>{dia.tempMax}°C</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#2563eb', margin: '0.2rem 0' }}>
                Mín: <strong>{dia.tempMin}°C</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                🌧️ {dia.precipitacion} mm
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- SECCIÓN 2: HISTORIAL DE CULTIVOS POR CAMPAÑA (US-04) --- */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🌱 Historial de Cultivos por Campaña</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Base agronómica utilizada para calcular las recomendaciones de rotación (US-09).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormCampania(!mostrarFormCampania)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mostrarFormCampania ? '#e2e8f0' : '#16a34a',
              color: mostrarFormCampania ? '#334155' : '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {mostrarFormCampania ? 'Cancelar' : '+ Registrar campaña'}
          </button>
        </div>

        {/* Formulario desplegable para nueva campaña */}
        {mostrarFormCampania && (
          <form
            onSubmit={handleGuardarCampania}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#1e293b' }}>
              Nuevo Registro de Campaña
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Cultivo sembrado *
                </label>
                <select
                  value={cultivo}
                  onChange={(e) => setCultivo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  {CULTIVOS_COMUNES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Campaña agrícola * (ej: 2024/2025)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2024/2025"
                  value={campania}
                  onChange={(e) => setCampania(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Rinde obtenido (qq/ha o tn/ha, opcional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ej: 32.5"
                  value={rindeReal}
                  onChange={(e) => setRindeReal(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Observaciones (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Sufrida por sequía temprana, fertilizado con fósforo"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <button
              type="submit"
              disabled={guardandoCampania}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: guardandoCampania ? 'not-allowed' : 'pointer',
              }}
            >
              {guardandoCampania ? 'Guardando...' : 'Guardar en historial'}
            </button>
          </form>
        )}

        {/* Tabla o Lista de Campañas */}
        {cargandoCampanias ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Cargando historial...</p>
        ) : campanias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '2px dashed #e2e8f0', borderRadius: '8px', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: 500 }}>No hay campañas registradas aún en esta parcela.</p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              Registrá el último cultivo sembrado para poder recibir sugerencias de rotación.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Campaña</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Cultivo</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Rendimiento</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Notas</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {campanias.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                      {c.campania}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                        {c.cultivo}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#334155' }}>
                      {c.rindeReal !== null ? `${c.rindeReal} qq/ha` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                      {c.observaciones || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleEliminarCampania(c.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
