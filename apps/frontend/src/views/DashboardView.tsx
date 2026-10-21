import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const DashboardView: React.FC = () => {
  const { user } = useAuth();

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
        <div>
          <Link
            to="/parcelas/nueva"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-2"
          >
            <span>+</span> Nueva Parcela
          </Link>
        </div>
      </div>

      {/* Grid de Estado y Parcelas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Lista de Parcelas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Tus Parcelas Registradas</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                1 Parcela activa
              </span>
            </div>

            {/* Tarjeta de Parcela de Muestra */}
            <div className="border border-slate-200 hover:border-emerald-500 rounded-xl p-4 transition bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-900">Lote Norte (Chacra 4)</h3>
                  <p className="text-xs text-slate-500">Superficie: 85.4 Hectáreas • Suelo Argiudol</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Campaña 2024/25
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                  Último cultivo: <strong>Maíz tardío</strong>
                </span>
                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                  Rotación sugerida: <strong>Soja 1ra</strong>
                </span>
              </div>
            </div>

            {/* Placeholder de integración de mapa */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
              <div className="text-3xl mb-2">🗺️</div>
              <h4 className="text-sm font-semibold text-slate-700">Visor de Mapa Satelital (Leaflet / US-01)</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                El componente de mapa interactivo con dibujo de polígonos GeoJSON y cálculo de hectáreas se integrará aquí en el próximo slice.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Clima y Alertas Activas */}
        <div className="space-y-4">
          {/* Card Clima */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Clima Hiperlocal (Open-Meteo)</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-extrabold text-slate-900">22°C</div>
                <div className="text-xs text-slate-500">Despejado • Viento 12 km/h NE</div>
              </div>
              <div className="text-4xl">☀️</div>
            </div>
            <div className="pt-2 border-t border-slate-100 grid grid-cols-3 text-center text-xs text-slate-600">
              <div>
                <div className="text-slate-400">Jue</div>
                <div className="font-semibold">24° / 12°</div>
              </div>
              <div>
                <div className="text-slate-400">Vie</div>
                <div className="font-semibold">21° / 10°</div>
              </div>
              <div>
                <div className="text-slate-400">Sáb</div>
                <div className="font-semibold">18° / 6°</div>
              </div>
            </div>
          </div>

          {/* Card Alertas */}
          <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <span>⚠️</span> Alerta de Helada Preventiva
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Descenso marcado de temperatura previsto para el domingo en la madrugada (mínima estimada 1.5 °C en superficie).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
