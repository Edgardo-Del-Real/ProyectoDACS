import React, { useEffect, useState, useCallback, useId } from 'react';
import {
  obtenerCotizaciones,
  obtenerTendencia,
  type MercadoResumenResponse,
  type TendenciaMercadoResponse,
} from '../api/mercado';

const FUENTE = 'Bolsa de Cereales de Buenos Aires';

const formatearFecha = (iso: string | null): string =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR') : '—';

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

  // Cotizaciones vigentes del cultivo seleccionado (US-07 Criterio 1)
  const cargarMercado = useCallback(async (cultivo: string) => {
    setCargandoCotizaciones(true);
    setError(null);
    try {
      setResumen(await obtenerCotizaciones(cultivo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron consultar las cotizaciones.');
    } finally {
      setCargandoCotizaciones(false);
    }
  }, []);

  // Serie histórica para el gráfico (US-07 Criterio 3)
  const cargarTendencia = useCallback(async (cultivo: string, posicion: string, dias: number) => {
    setCargandoTendencia(true);
    try {
      setTendencia(await obtenerTendencia(cultivo, posicion, dias));
    } catch (err) {
      console.error('Error al cargar la tendencia de mercado:', err);
      setTendencia(null);
    } finally {
      setCargandoTendencia(false);
    }
  }, []);

  // Cotizaciones al montar y al cambiar de grano.
  useEffect(() => {
    // Sincronización con la API al montar y al cambiar de cultivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarMercado(cultivoSeleccionado);
  }, [cultivoSeleccionado, cargarMercado]);

  useEffect(() => {
    // Sincronización de la serie histórica al cambiar los parámetros del gráfico.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarTendencia(cultivoSeleccionado, posicionGrafico, diasGrafico);
  }, [cultivoSeleccionado, posicionGrafico, diasGrafico, cargarTendencia]);

  const cultivos = resumen?.cultivosDisponibles ?? [];
  const puntos = tendencia?.puntos ?? [];
  const hayHistorial = puntos.length >= 2;

  const renderGraficoSVG = () => {
    if (!tendencia || !hayHistorial) return null;

    const width = 800;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };

    const valores = puntos.map((p) => p.valor);
    const minVal = Math.floor(Math.min(...valores) * 0.98);
    const maxVal = Math.ceil(Math.max(...valores) * 1.02);
    const rangoVal = maxVal - minVal || 1;

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const puntosCoord = puntos.map((p, idx) => ({
      x: padding.left + (idx / (puntos.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((p.valor - minVal) / rangoVal) * innerHeight,
      fecha: p.fecha,
      valor: p.valor,
    }));

    const pathD = puntosCoord
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const ultimoPunto = puntosCoord[puntosCoord.length - 1];
    const primerPunto = puntosCoord[0];
    const areaD = `${pathD} L ${ultimoPunto.x.toFixed(1)} ${padding.top + innerHeight} L ${primerPunto.x.toFixed(1)} ${padding.top + innerHeight} Z`;

    const lineasY = [0, 0.33, 0.66, 1].map((f) => ({
      valor: (minVal + rangoVal * f).toFixed(1),
      y: padding.top + innerHeight - f * innerHeight,
    }));

    return (
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 select-none"
          role="img"
          aria-labelledby={`${chartGradientId}-titulo`}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <title id={`${chartGradientId}-titulo`}>
            {`Evolución del precio de ${tendencia.cultivo} (${tendencia.posicion}) entre ${primerPunto.fecha} y ${ultimoPunto.fecha}. Mínimo ${tendencia.minimo}, máximo ${tendencia.maximo}, último valor ${ultimoPunto.valor} dólares por tonelada.`}
          </title>

          <defs>
            <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {lineasY.map((linea) => (
            <g key={linea.y}>
              <line
                x1={padding.left}
                y1={linea.y}
                x2={width - padding.right}
                y2={linea.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={linea.y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                ${linea.valor}
              </text>
            </g>
          ))}

          <path d={areaD} fill={`url(#${chartGradientId})`} />
          <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {puntosCoord.map((p, idx) => (
            <circle
              key={`${p.fecha}-${idx}`}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.fecha === p.fecha ? 5 : 3}
              className="fill-white stroke-emerald-600 stroke-2 cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPoint(p)}
            />
          ))}

          <text
            x={padding.left}
            y={height - 10}
            textAnchor="start"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {primerPunto.fecha}
          </text>
          <text
            x={width - padding.right}
            y={height - 10}
            textAnchor="end"
            className="text-[11px] fill-slate-500 font-medium"
          >
            {ultimoPunto.fecha}
          </text>
        </svg>

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
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <h1 className="text-2xl font-bold text-slate-900">Mercado de Granos y Futuros (US-07)</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Precios FOB oficiales (Ley 21.453) con curva de vencimientos. Fuente: {FUENTE}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void cargarMercado(cultivoSeleccionado)}
            disabled={cargandoCotizaciones}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            <span className={cargandoCotizaciones ? 'animate-spin' : ''}>🔄</span>
            {cargandoCotizaciones ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Datos desactualizados (US-07 Criterio 2) */}
      {resumen?.stale && (
        <div
          role="alert"
          className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
        >
          <span className="text-lg">⚠️</span>
          <div>
            <strong className="font-semibold">Cotizaciones desactualizadas.</strong>{' '}
            {resumen.ultimaActualizacion
              ? `El último cierre cargado es del ${formatearFecha(resumen.ultimaActualizacion)}.`
              : 'Todavía no se sincronizó el mercado.'}{' '}
            Los precios pueden no reflejar el mercado de hoy.
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void cargarMercado(cultivoSeleccionado)}
            className="font-semibold underline hover:text-red-900 ml-4"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Selector de grano: la lista la define el backend */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Seleccionar grano
        </span>
        <div className="flex flex-wrap gap-2">
          {cultivos.map((cultivo) => (
            <button
              key={cultivo}
              type="button"
              onClick={() => {
                // Cada grano tiene su propia curva: si la posición anterior no
                // existe en la nueva, el gráfico quedaría vacío sin explicación.
                setCultivoSeleccionado(cultivo);
                setPosicionGrafico('DISPONIBLE');
              }}
              aria-pressed={cultivoSeleccionado === cultivo}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                cultivoSeleccionado === cultivo
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {cultivo}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Disponible (spot FOB)
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {cargandoCotizaciones ? (
              <span className="text-slate-400 text-base">Cargando...</span>
            ) : resumen?.spotActual !== null && resumen?.spotActual !== undefined ? (
              <>
                ${resumen.spotActual}{' '}
                <span className="text-xs font-semibold text-slate-500">USD/tn</span>
              </>
            ) : (
              <span className="text-slate-400 text-base italic">Sin spot publicado</span>
            )}
          </div>
          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block font-medium">
            Entrega inmediata
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Futuro más cercano ({resumen?.futuroCercano?.descripcionPosicion ?? '—'})
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {cargandoCotizaciones ? (
              <span className="text-slate-400 text-base">Cargando...</span>
            ) : resumen?.futuroCercano ? (
              <>
                ${resumen.futuroCercano.valor}{' '}
                <span className="text-xs font-semibold text-slate-500">USD/tn</span>
              </>
            ) : (
              <span className="text-slate-400 text-base italic">Sin vencimientos</span>
            )}
          </div>
          <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block font-medium">
            Posición {resumen?.futuroCercano?.posicion ?? '—'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Último cierre
          </span>
          <div className="text-lg font-bold text-slate-800">
            {formatearFecha(resumen?.ultimaActualizacion ?? null)}
          </div>
          <p className="text-[11px] text-slate-500" title={resumen?.fuente ?? FUENTE}>
            {resumen?.fuente ? 'Precios FOB oficiales' : 'Sin datos sincronizados'}
          </p>
        </div>
      </div>

      {/* Avisos del backend (parser o sincronización) */}
      {resumen && resumen.advertencias.length > 0 && (
        <aside
          aria-label="Avisos del mercado"
          className="rounded-xl p-4 bg-slate-50 border border-slate-200 text-slate-700 text-xs space-y-1"
        >
          {resumen.advertencias.map((advertencia) => (
            <p key={advertencia}>• {advertencia}</p>
          ))}
        </aside>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tabla de vencimientos */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cotizaciones por vencimiento</h2>
              <p className="text-xs text-slate-500">Curva FOB de {cultivoSeleccionado}</p>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded uppercase">
              USD/tn
            </span>
          </div>

          {cargandoCotizaciones ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2 align-middle"></div>
              Obteniendo posiciones...
            </div>
          ) : !resumen || resumen.cotizaciones.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm italic">
              No hay cotizaciones cargadas para este grano. Sincronizá el mercado para verlas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Posición</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Valor (USD)</th>
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
                          {c.variacionDiaPct === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gráfico de tendencia */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tendencia de precio</h2>
              <p className="text-xs text-slate-500">
                {cultivoSeleccionado} · {posicionGrafico}
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              {[15, 30, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiasGrafico(d)}
                  aria-pressed={diasGrafico === d}
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
              Calculando tendencia...
            </div>
          ) : hayHistorial && tendencia ? (
            <>
              {renderGraficoSVG()}

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
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center gap-2 px-6">
              <span className="text-3xl">📉</span>
              <p className="text-sm font-medium text-slate-600">
                Todavía no hay historial suficiente para este grano y posición.
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                La serie se arma con el cierre de cada día. Se necesitan al menos dos días de datos
                sincronizados para dibujar la tendencia.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
