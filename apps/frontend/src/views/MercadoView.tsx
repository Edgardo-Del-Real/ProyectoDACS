import React, { useEffect, useState, useCallback, useId } from 'react';
import {
  obtenerCotizaciones,
  obtenerTendencia,
  type MercadoResumenResponse,
  type TendenciaMercadoResponse,
} from '../api/mercado.js';

export const MercadoView: React.FC = () => {
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<string>('Soja');
  const [resumen, setResumen] = useState<MercadoResumenResponse | null>(null);
  const [posicionGrafico, setPosicionGrafico] = useState<string>('DISPONIBLE');
  const [diasGrafico, setDiasGrafico] = useState<number>(30);
  const [tendencia, setTendencia] = useState<TendenciaMercadoResponse | null>(null);

  const [cargandoCotizaciones, setCargandoCotizaciones] = useState<boolean>(true);
  const [cargandoTendencia, setCargandoTendencia] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ fecha: string; valor: number; x: number; y: number } | null>(null);
  const chartGradientId = useId();

  // Cargar cotizaciones vigentes del cultivo seleccionado (US-07 Criterio 1)
  const cargarMercado = useCallback(async (cultivo: string) => {
    setCargandoCotizaciones(true);
    setError(null);
    try {
      const data = await obtenerCotizaciones(cultivo);
      setResumen(data);

      // Si la posición seleccionada para el gráfico no existe en las nuevas cotizaciones, volver a DISPONIBLE
      const tienePosicion = data.cotizaciones.some((c) => c.posicion === posicionGrafico);
      if (!tienePosicion) {
        setPosicionGrafico('DISPONIBLE');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar cotizaciones de mercado.');
    } finally {
      setCargandoCotizaciones(false);
    }
  }, [posicionGrafico]);

  // Cargar serie histórica para el gráfico de tendencias (US-07 Criterio 3)
  const cargarTendencia = useCallback(async (cultivo: string, posicion: string, dias: number) => {
    setCargandoTendencia(true);
    try {
      const data = await obtenerTendencia(cultivo, posicion, dias);
      setTendencia(data);
    } catch (err) {
      console.error('Error al cargar tendencia de mercado:', err);
    } finally {
      setCargandoTendencia(false);
    }
  }, []);

  useEffect(() => {
    // Sincronización inicial con la API al cambiar de cultivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarMercado(cultivoSeleccionado);
  }, [cultivoSeleccionado, cargarMercado]);

  useEffect(() => {
    // Sincronización de la serie histórica al cambiar parámetros del gráfico.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarTendencia(cultivoSeleccionado, posicionGrafico, diasGrafico);
  }, [cultivoSeleccionado, posicionGrafico, diasGrafico, cargarTendencia]);

  // Cálculo de coordenadas SVG para el gráfico de línea responsivo
  const renderGraficoSVG = () => {
    if (!tendencia || tendencia.puntos.length === 0) return null;

    const width = 800;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };

    const valores = tendencia.puntos.map((p) => p.valor);
    const minVal = Math.floor(Math.min(...valores) * 0.98);
    const maxVal = Math.ceil(Math.max(...valores) * 1.02);
    const rangoVal = maxVal - minVal || 1;

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const puntosCoord = tendencia.puntos.map((p, idx) => {
      const x = padding.left + (idx / (tendencia.puntos.length - 1 || 1)) * innerWidth;
      const y = padding.top + innerHeight - ((p.valor - minVal) / rangoVal) * innerHeight;
      return { x, y, fecha: p.fecha, valor: p.valor };
    });

    const pathD = puntosCoord.reduce(
      (acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`,
      '',
    );

    const areaD = `${pathD} L ${puntosCoord[puntosCoord.length - 1].x.toFixed(1)} ${padding.top + innerHeight} L ${puntosCoord[0].x.toFixed(1)} ${padding.top + innerHeight} Z`;

    // Niveles de referencia en el eje Y (4 líneas de cuadrícula)
    const lineasY = [0, 0.33, 0.66, 1].map((f) => {
      const val = minVal + rangoVal * f;
      const y = padding.top + innerHeight - f * innerHeight;
      return { valor: val.toFixed(1), y };
    });

    return (
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Cuadrícula horizontal y etiquetas de precio */}
          {lineasY.map((l, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={l.y}
                x2={width - padding.right}
                y2={l.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={l.y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                ${l.valor}
              </text>
            </g>
          ))}

          {/* Área sombreada bajo la curva */}
          <path d={areaD} fill={`url(#${chartGradientId})`} />

          {/* Línea principal de cotización */}
          <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos interactivos con tooltip */}
          {puntosCoord.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.fecha === p.fecha ? 5 : 3}
              className="fill-white stroke-emerald-600 stroke-2 cursor-pointer transition-all hover:scale-125"
              onMouseEnter={() => setHoveredPoint(p)}
            />
          ))}

          {/* Etiquetas del eje X (primer y último día) */}
          <text
            x={padding.left}
            y={height - 10}
            textAnchor="start"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {puntosCoord[0]?.fecha}
          </text>
          <text
            x={width - padding.right}
            y={height - 10}
            textAnchor="end"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {puntosCoord[puntosCoord.length - 1]?.fecha}
          </text>
        </svg>

        {/* Tooltip flotante */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg font-mono -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100 - 8}%`,
            }}
          >
            <div className="font-sans text-[10px] text-slate-300">{hoveredPoint.fecha}</div>
            <div className="font-bold text-emerald-400">${hoveredPoint.valor} USD/tn</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabecera de Mercado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <h1 className="text-2xl font-bold text-slate-900">Mercado de Granos y Futuros (US-07)</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Cotizaciones oficiales en tiempo real y posiciones a término de Matba Rofex para planificación de siembra.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => cargarMercado(cultivoSeleccionado)}
            disabled={cargandoCotizaciones}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            <span className={cargandoCotizaciones ? 'animate-spin' : ''}>🔄</span>
            {cargandoCotizaciones ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Alerta de fallback / datos desactualizados (US-07 Criterio 2) */}
      {resumen?.stale && (
        <div
          role="alert"
          className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
        >
          <span className="text-lg">⚠️</span>
          <div>
            <strong className="font-semibold">Aviso de cotizaciones en caché:</strong> No se pudo conectar con el feed en vivo de Matba Rofex. Mostrando últimos valores registrados al {new Date(resumen.ultimaActualizacion).toLocaleDateString('es-AR')}.
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => cargarMercado(cultivoSeleccionado)}
            className="font-semibold underline hover:text-red-900 ml-4"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Selector de Cultivo (Pastillas interactivas) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Seleccionar Grano:
        </label>
        <div className="flex flex-wrap gap-2">
          {['Soja', 'Maíz', 'Trigo', 'Girasol', 'Sorgo', 'Cebada'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCultivoSeleccionado(c)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                cultivoSeleccionado === c
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Spot Disponible */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Disponible Rosario (Spot)
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {cargandoCotizaciones ? (
              <span className="text-slate-400 text-base">Cargando...</span>
            ) : resumen?.spotActual ? (
              <>
                ${resumen.spotActual}{' '}
                <span className="text-xs font-semibold text-slate-500">USD/tn</span>
              </>
            ) : (
              <span className="text-slate-400 text-base italic">Sin cotización</span>
            )}
          </div>
          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block font-medium">
            Entrega Inmediata
          </span>
        </div>

        {/* Futuro más cercano */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Futuro Más Cercano ({resumen?.futuroCercano?.descripcionPosicion || '—'})
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {cargandoCotizaciones ? (
              <span className="text-slate-400 text-base">Cargando...</span>
            ) : resumen?.futuroCercano?.valor ? (
              <>
                ${resumen.futuroCercano.valor}{' '}
                <span className="text-xs font-semibold text-slate-500">USD/tn</span>
              </>
            ) : (
              <span className="text-slate-400 text-base italic">—</span>
            )}
          </div>
          <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block font-medium">
            Posición {resumen?.futuroCercano?.posicion}
          </span>
        </div>

        {/* Fuente y Fecha */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Mercado Regulado
          </span>
          <div className="text-lg font-bold text-slate-800 truncate">
            {resumen?.fuente || 'Matba Rofex'}
          </div>
          <p className="text-xs text-slate-500">
            Último corte:{' '}
            <strong>
              {resumen ? new Date(resumen.ultimaActualizacion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </strong>
          </p>
        </div>
      </div>

      {/* Grid: Tabla de Cotizaciones a Término y Gráfico de Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tabla de Futuros por Vencimiento (US-07 Criterio 1) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cotizaciones por Vencimiento</h2>
              <p className="text-xs text-slate-500">Contratos vigentes para {cultivoSeleccionado}</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
              Matba Rofex
            </span>
          </div>

          {cargandoCotizaciones ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2 align-middle"></div>
              Obteniendo posiciones...
            </div>
          ) : !resumen || resumen.cotizaciones.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm italic">
              No hay cotizaciones disponibles para este grano.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Posición</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Ajuste (USD)</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Var %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumen.cotizaciones.map((c) => {
                    const isSelected = posicionGrafico === c.posicion;
                    const isPositive = c.variacionDiaPct >= 0;

                    return (
                      <tr
                        key={c.posicion}
                        onClick={() => setPosicionGrafico(c.posicion)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-3 text-slate-900">
                          <div className="font-semibold text-xs sm:text-sm">{c.descripcionPosicion}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{c.posicion}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                          ${c.valor.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              isPositive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {c.variacionDiaPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gráfico de Tendencia Histórica (US-07 Criterio 3) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tendencia de Precio</h2>
              <p className="text-xs text-slate-500">
                Evolución de {cultivoSeleccionado} ({posicionGrafico})
              </p>
            </div>

            {/* Selector de ventana de tiempo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              {[15, 30, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiasGrafico(d)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    diasGrafico === d ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {cargandoTendencia ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2"></div>
              Calculando tendencia histórica...
            </div>
          ) : (
            <>
              {renderGraficoSVG()}

              {/* Estadísticas de la serie */}
              {tendencia && (
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mínimo</span>
                    <span className="text-xs font-bold text-slate-800">${tendencia.minimo}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Promedio</span>
                    <span className="text-xs font-bold text-slate-800">${tendencia.promedio}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Máximo</span>
                    <span className="text-xs font-bold text-slate-800">${tendencia.maximo}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Variación</span>
                    <span
                      className={`text-xs font-bold ${
                        tendencia.variacionTotalPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {tendencia.variacionTotalPct >= 0 ? '+' : ''}
                      {tendencia.variacionTotalPct}%
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
