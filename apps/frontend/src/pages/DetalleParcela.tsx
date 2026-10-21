import { useEffect, useState } from 'react';
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

export function DetalleParcela() {
  const { id } = useParams<{ id: string }>();
  const [pronostico, setPronostico] = useState<PronosticoResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const obtenerPronostico = async () => {
      try {
        // TODO: Obtener token JWT del localStorage cuando implementemos auth en frontend
        const token = localStorage.getItem('token');
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
      } catch (err) {
        setError('Error de conexión. Verificá tu conexión a internet.');
        setCargando(false);
      }
    };

    obtenerPronostico();
  }, [id]);

  if (cargando) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <p>Cargando pronóstico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <Link to="/">Volver al inicio</Link>
      </div>
    );
  }

  if (!pronostico) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <p>No se encontró el pronóstico.</p>
        <Link to="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1>
        {pronostico.parcelaNombre || 'Parcela'} - Pronóstico del Clima
      </h1>

      {pronostico.stale && (
        <div
          style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          ⚠️ <strong>Datos desactualizados:</strong> No se pudo actualizar el pronóstico.
          Mostrando datos del {new Date(pronostico.fetchedAt).toLocaleString('es-AR')}.
        </div>
      )}

      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Actualizado: {new Date(pronostico.fetchedAt).toLocaleString('es-AR')}
      </p>

      <div style={{ marginTop: '2rem' }}>
        <h2>Pronóstico de 7 días</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          {pronostico.pronostico.map((dia) => (
            <div
              key={dia.fecha}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: '#f9f9f9',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                {new Date(dia.fecha).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>🌡️ Máx: <strong>{dia.tempMax}°C</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>🌡️ Mín: <strong>{dia.tempMin}°C</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🌧️ Lluvia: <strong>{dia.precipitacion} mm</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <Link to="/">← Volver al inicio</Link>
      </div>
    </div>
  );
}
