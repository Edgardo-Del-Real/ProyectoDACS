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
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-emerald-600"></div>
          <p className="text-slate-600 text-sm font-medium">Cargando datos de la parcela...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-red-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-xl font-bold">Error al cargar la parcela</h1>
          </div>
          <p className="text-slate-700 text-sm bg-red-50 p-4 rounded-xl border border-red-100">
            {error}
          </p>
          <div>
            <Link
              to="/panel"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              ← Volver al panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!pronostico) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
          <p className="text-slate-600 text-base font-medium">No se encontró la parcela solicitada.</p>
          <div>
            <Link
              to="/panel"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              ← Volver al panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header de Parcela */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/panel"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition inline-flex items-center gap-1"
            >
              ← Volver al panel
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {pronostico.parcelaNombre || 'Detalle de Parcela'}
          </h1>
          <p className="text-xs font-mono text-slate-500 mt-1">
            ID: <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">{pronostico.parcelaId}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/panel"
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl text-center transition"
          >
            Ver todas las parcelas
          </Link>
        </div>
      </div>

      {/* Alerta de datos desactualizados */}
      {pronostico.stale && (
        <div
          role="alert"
          className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
        >
          <span className="text-lg">⚠️</span>
          <div>
            <strong className="font-semibold">Datos climáticos desactualizados:</strong> No se pudo actualizar el pronóstico en tiempo real con Open-Meteo. Mostrando datos cacheados del {new Date(pronostico.fetchedAt).toLocaleString('es-AR')}.
          </div>
        </div>
      )}

      {/* --- SECCIÓN 1: PRONÓSTICO DEL CLIMA (US-05) --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>☀️</span> Pronóstico a 7 días (Open-Meteo)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Temperaturas extremas y precipitaciones diarias previstas para el lote.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
            Actualizado: {new Date(pronostico.fetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {pronostico.pronostico.map((dia) => (
            <div
              key={dia.fecha}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-200 hover:shadow-xs transition text-center space-y-1.5"
            >
              <div className="text-xs font-bold text-slate-800 capitalize tracking-tight">
                {new Date(dia.fecha).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="text-xs text-red-600 font-semibold">
                Máx: <span className="font-bold">{dia.tempMax}°C</span>
              </div>
              <div className="text-xs text-blue-600 font-semibold">
                Mín: <span className="font-bold">{dia.tempMin}°C</span>
              </div>
              <div className="text-xs text-slate-600 font-medium pt-1 border-t border-slate-200/60">
                🌧️ {dia.precipitacion} mm
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- SECCIÓN 2: HISTORIAL DE CULTIVOS POR CAMPAÑA (US-04) --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🌱</span> Historial de Cultivos por Campaña
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Base agronómica utilizada para calcular las recomendaciones de rotación plurianual (US-09).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormCampania(!mostrarFormCampania)}
            className={`w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition ${
              mostrarFormCampania
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            {mostrarFormCampania ? 'Cancelar' : '+ Registrar campaña'}
          </button>
        </div>

        {/* Formulario desplegable para nueva campaña */}
        {mostrarFormCampania && (
          <form
            onSubmit={handleGuardarCampania}
            className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Nuevo Registro de Campaña
              </h3>
              <span className="text-xs text-slate-500">* Campos obligatorios</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cultivo sembrado *
                </label>
                <select
                  value={cultivo}
                  onChange={(e) => setCultivo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                >
                  {CULTIVOS_COMUNES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Campaña agrícola * (ej: 2024/2025)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2024/2025"
                  value={campania}
                  onChange={(e) => setCampania(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rinde obtenido (qq/ha o tn/ha, opcional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ej: 32.5"
                  value={rindeReal}
                  onChange={(e) => setRindeReal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Observaciones agronómicas (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Sufrida por sequía temprana, fertilizado con fósforo"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostrarFormCampania(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={guardandoCampania}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2"
              >
                {guardandoCampania ? 'Guardando...' : 'Guardar en historial'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla / Lista de Campañas */}
        {cargandoCampanias ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2 align-middle"></div>
            Cargando historial de campañas...
          </div>
        ) : campanias.length === 0 ? (
          <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
            <span className="text-3xl block">🌾</span>
            <p className="font-semibold text-slate-700 text-sm">No hay campañas registradas aún en esta parcela</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Registrá el último cultivo sembrado para que el sistema pueda evaluar la historia del lote y sugerir rotaciones agronómicas óptimas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Campaña</th>
                  <th className="px-4 py-3 font-semibold">Cultivo</th>
                  <th className="px-4 py-3 font-semibold">Rendimiento</th>
                  <th className="px-4 py-3 font-semibold">Notas</th>
                  <th className="px-4 py-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {campanias.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {c.campania}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {c.cultivo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {c.rindeReal !== null ? (
                        <span className="font-semibold text-slate-900">{c.rindeReal} <span className="text-xs text-slate-500 font-normal">qq/ha</span></span>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs max-w-xs truncate">
                      {c.observaciones || <span className="text-slate-400 italic">Sin observaciones</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEliminarCampania(c.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition"
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
