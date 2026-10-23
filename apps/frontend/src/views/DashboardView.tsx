import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

interface Parcela {
  id: string;
  nombre: string | null;
  hectareas: number;
  createdAt: string;
}

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

export const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [climaPrincipal, setClimaPrincipal] = useState<PronosticoResponse | null>(null);
  const [cargandoClima, setCargandoClima] = useState<boolean>(false);

  const getToken = () => localStorage.getItem('token') || localStorage.getItem('dacs_token');

  const cargarClimaParcela = useCallback(async (parcelaId: string) => {
    const token = getToken();
    if (!token) return;

    setCargandoClima(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${parcelaId}/clima`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data: PronosticoResponse = await res.json();
        setClimaPrincipal(data);
      }
    } catch (err) {
      console.error('Error al cargar clima de la parcela principal:', err);
    } finally {
      setCargandoClima(false);
    }
  }, []);

  const cargarDatos = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('No hay sesión activa. Iniciá sesión para ver tus parcelas.');
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Sesión expirada. Por favor, iniciá sesión nuevamente.');
        }
        throw new Error('No se pudieron obtener las parcelas del servidor.');
      }

      const data: Parcela[] = await res.json();
      setParcelas(data);

      // Si tiene al menos una parcela, cargamos el pronóstico de la primera
      if (data.length > 0) {
        await cargarClimaParcela(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el BFF.');
    } finally {
      setCargando(false);
    }
  }, [cargarClimaParcela]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel de Control Agrícola</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bienvenido, <span className="font-semibold text-slate-700">{user?.nombre || user?.email}</span> — Rol: <span className="text-emerald-700 font-medium">{user?.rol}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/parcelas/nueva"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-2"
          >
            <span>+</span> Nueva Parcela
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={cargarDatos}
            className="font-semibold underline hover:text-red-900 ml-4"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Parcelas reales */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Tus Parcelas Registradas</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {cargando ? 'Cargando...' : `${parcelas.length} ${parcelas.length === 1 ? 'parcela' : 'parcelas'}`}
              </span>
            </div>

            {cargando ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Cargando parcelas desde el servidor...
              </div>
            ) : parcelas.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/70 space-y-3">
                <div className="text-4xl">🌱</div>
                <h3 className="text-base font-semibold text-slate-800">
                  Todavía no tenés parcelas registradas
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Dibujá el contorno de tu primer campo sobre el mapa satelital para calcular la superficie y recibir pronósticos hiperlocales.
                </p>
                <div className="pt-2">
                  <Link
                    to="/parcelas/nueva"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                  >
                    <span>+</span> Dibujar mi primera parcela
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {parcelas.map((p) => (
                  <div
                    key={p.id}
                    className="border border-slate-200 hover:border-emerald-500 rounded-xl p-4 transition bg-slate-50/40 hover:bg-emerald-50/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-base">
                          {p.nombre || 'Parcela sin nombre'}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                          Activa
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Superficie: <strong>{p.hectareas.toFixed(2)} ha</strong> • Alta:{' '}
                        {new Date(p.createdAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/parcelas/${p.id}`}
                        className="px-3.5 py-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-emerald-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 shadow-sm"
                      >
                        Ver Clima y Campañas ➔
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Clima hiperlocal de la parcela */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Clima Hiperlocal (Open-Meteo)
              </h3>
              {climaPrincipal?.stale && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold" title="Datos en caché">
                  Caché
                </span>
              )}
            </div>

            {cargandoClima ? (
              <p className="text-slate-400 text-xs text-center py-4">Consultando Open-Meteo...</p>
            ) : climaPrincipal && climaPrincipal.pronostico.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-700 font-semibold block">
                      {climaPrincipal.parcelaNombre || 'Tu Parcela'}
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-0.5">
                      {climaPrincipal.pronostico[0].tempMax}° / {climaPrincipal.pronostico[0].tempMin}°C
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      🌧️ Lluvia prevista: {climaPrincipal.pronostico[0].precipitacion} mm
                    </div>
                  </div>
                  <div className="text-4xl">☀️</div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs text-slate-600 gap-1">
                  {climaPrincipal.pronostico.slice(1, 4).map((d) => (
                    <div key={d.fecha} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-slate-500 font-medium capitalize">
                        {new Date(d.fecha).toLocaleDateString('es-AR', { weekday: 'short' })}
                      </div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">
                        {d.tempMax}° / {d.tempMin}°
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {d.precipitacion} mm
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-right">
                  <Link
                    to={`/parcelas/${climaPrincipal.parcelaId}`}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1"
                  >
                    Ver pronóstico completo de 7 días ➔
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs space-y-2">
                <div className="text-3xl">🌦️</div>
                <p>
                  {parcelas.length === 0
                    ? 'Registrá tu primera parcela para activar el pronóstico hiperlocal en tiempo real.'
                    : 'Seleccioná una parcela para consultar su clima.'}
                </p>
              </div>
            )}
          </div>

          {/* Card informativa de Alertas */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <span>🌾</span> Recomendación del Suelo
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Registrá el historial de cosechas de cada lote en su pantalla de detalle para habilitar el cálculo de rotaciones y anticipar riesgos de helada (US-06 / US-09).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
