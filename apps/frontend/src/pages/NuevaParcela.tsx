import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
    setErrorMsg(null);
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
      navigate('/panel');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error de conexión';
      setErrorMsg(`Error al guardar la parcela: ${message}`);
    } finally {
      setGuardando(false);
    }
  };

  const puedeGuardar =
    nombre.trim().length > 0 && poligono !== null && !guardando && !excedeMaximo;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header con navegación de vuelta */}
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Nueva parcela</h1>
          <p className="text-sm text-slate-500 mt-1">
            Delimitá tu campo en el mapa satelital para calcular su superficie y habilitar el pronóstico agronómico.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between"
          role="alert"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tarjeta del formulario */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label htmlFor="nombre-parcela" className="block text-sm font-semibold text-slate-700 mb-2">
            Nombre de la parcela *
          </label>
          <input
            id="nombre-parcela"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Lote Norte - La Esmeralda"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition"
          />
        </div>

        {/* Instrucciones del mapa */}
        <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-4 text-emerald-900 text-sm flex items-start gap-3">
          <span className="text-lg">🗺️</span>
          <div className="space-y-1">
            <p className="font-semibold text-emerald-950">Cómo dibujar el lote:</p>
            <p className="text-xs sm:text-sm text-emerald-800">
              Usá la herramienta de dibujo (ícono de polígono arriba a la izquierda del mapa) y hacé clic en cada vértice del campo para cerrar el lote.
            </p>
          </div>
        </div>

        {/* Contenedor del Mapa */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
          <MapaPoligono onPolygonChange={handlePolygonChange} />
        </div>

        {/* Resumen de Superficie y Validación */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">
              Superficie estimada
            </span>
            {hectareas !== null ? (
              <span className="text-2xl font-bold text-slate-900">
                {hectareas.toFixed(2)} <span className="text-base font-normal text-slate-600">ha</span>
              </span>
            ) : (
              <span className="text-sm text-slate-500 italic">
                Dibujá un polígono en el mapa para calcular
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 sm:text-right">
            Límite máximo por parcela: <span className="font-semibold text-slate-700">{MAX_HECTAREAS_PARCELA.toLocaleString('es-AR')} ha</span>
          </div>
        </div>

        {excedeMaximo && (
          <div
            role="alert"
            className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3"
          >
            <span className="text-lg">⚠️</span>
            <div>
              <strong className="font-semibold">Superficie excedida:</strong> El polígono delimitado supera el máximo permitido de {MAX_HECTAREAS_PARCELA.toLocaleString('es-AR')} ha por parcela. Por favor delimitá un lote más chico o dividí el campo en parcelas separadas.
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            to="/panel"
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl text-center transition"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Guardando…
              </>
            ) : (
              'Guardar parcela'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
