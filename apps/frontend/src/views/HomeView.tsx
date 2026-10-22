import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export const HomeView: React.FC = () => {
  const { isAuthenticated, login } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold backdrop-blur">
            🌱 Decisión agronómica inteligente
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Gestión de parcelas y clima para pequeños productores.
          </h1>
          <p className="text-lg text-emerald-100 leading-relaxed">
            Delimitá tus lotes sobre mapa satelital, consultá pronósticos hiperlocales de 7 días, alertas de helada/sequía y recibí recomendaciones de rotación basadas en el mercado.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            {isAuthenticated ? (
              <Link
                to="/panel"
                className="px-6 py-3 rounded-xl bg-white text-emerald-800 font-bold hover:bg-emerald-50 shadow-md transition"
              >
                Ir a mi Panel de Parcelas ➔
              </Link>
            ) : (
              <button
                type="button"
                onClick={login}
                className="px-6 py-3 rounded-xl bg-white text-emerald-800 font-bold hover:bg-emerald-50 shadow-md transition"
              >
                Comenzar ahora (Iniciar sesión)
              </button>
            )}
            <a
              href="#caracteristicas"
              className="px-6 py-3 rounded-xl bg-emerald-900/60 text-white font-medium hover:bg-emerald-900/80 border border-emerald-400/30 transition"
            >
              Conocer funcionalidades
            </a>
          </div>
        </div>
      </div>

      {/* Características del Sistema */}
      <section id="caracteristicas" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900">Herramientas pensadas para el productor</h2>
          <p className="text-sm text-slate-600 mt-1">
            Arquitectura distribuida con microservicios orientada al agro argentino.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
              🗺️
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Delimitación Satelital (US-01)</h3>
            <p className="text-sm text-slate-600">
              Dibujá el contorno exacto de tu lote sobre mapas satelitales. Cálculo automático de superficie en hectáreas y persistencia de geometría GeoJSON.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
              ☀️
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Pronóstico y Alertas (US-05)</h3>
            <p className="text-sm text-slate-600">
              Integración en tiempo real con Open-Meteo. Pronóstico de lluvia, temperatura y detección de heladas (≤ 0 °C) específicas para tus coordenadas.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold">
              📈
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Mercado y Recomendación (US-07/08)</h3>
            <p className="text-sm text-slate-600">
              Cotizaciones futuras de Matba Rofex y rotación agronómica para maximizar rentabilidad cuidando el suelo.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
