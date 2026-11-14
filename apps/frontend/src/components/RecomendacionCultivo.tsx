import { useEffect, useState } from 'react';
import { ApiError } from '../api/http';
import { obtenerRecomendacion } from '../api/recomendacion';
import type {
  ClimaUtilizado,
  FactorPuntaje,
  PrecioUtilizado,
  RecomendacionResponse,
} from '../api/recomendacion';

const ORDEN_FACTORES = ['rotacion', 'clima', 'precio'] as const;

const ETIQUETAS_FACTOR: Record<FactorPuntaje['nombre'], string> = {
  rotacion: 'Rotación',
  clima: 'Clima',
  precio: 'Precio',
};

const BADGE_CLIMA: Record<ClimaUtilizado['fuente'], { texto: string; clases: string }> = {
  live: { texto: 'En vivo', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cache: { texto: 'Caché', clases: 'bg-amber-50 text-amber-800 border-amber-200' },
  no_disponible: { texto: 'No disponible', clases: 'bg-red-50 text-red-800 border-red-200' },
};

const BADGE_PRECIO: Record<PrecioUtilizado['fuente'], { texto: string; clases: string }> = {
  bd: { texto: 'Base de datos', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  simulado: { texto: 'Simulado', clases: 'bg-amber-50 text-amber-800 border-amber-200' },
  no_disponible: { texto: 'No disponible', clases: 'bg-red-50 text-red-800 border-red-200' },
};

function numero(valor: number, decimales = 1): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatearFecha(fecha: string): string {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  return new Date(soloFecha ? `${fecha}T00:00:00` : fecha).toLocaleDateString('es-AR');
}

function formatearAntiguedad(horas: number | null): string {
  if (typeof horas !== 'number' || Number.isNaN(horas)) return 'antigüedad desconocida';
  if (horas < 0.5) return 'recién obtenido';
  if (horas < 24) return `hace ${numero(horas)} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function colorPuntaje(puntaje: number): string {
  if (puntaje >= 70) return 'bg-emerald-500';
  if (puntaje >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

export function RecomendacionCultivo({ id, revision = 0 }: { id: string; revision?: number }) {
  const [datos, setDatos] = useState<RecomendacionResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const cargarRecomendacion = async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await obtenerRecomendacion(id, controller.signal);
        if (!controller.signal.aborted) setDatos(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo calcular la recomendación de cultivo',
        );
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };

    void cargarRecomendacion();
    return () => controller.abort();
  }, [id, revision, intento]);

  const recomendacion = datos?.recomendacion ?? null;
  const preciosOrdenados = datos
    ? Object.entries(datos.precioUtilizado.valores).sort((a, b) => b[1] - a[1])
    : [];
  const diasClima = datos?.climaUtilizado.dias.slice(0, 7) ?? [];

  return (
    <section
      aria-labelledby="titulo-recomendacion"
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 id="titulo-recomendacion" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🌱</span> Resultado de la recomendación
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Puntaje explicable según rotación, clima y precio de referencia.
          </p>
        </div>
        {datos && (
          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
            Calculado: {new Date(datos.fecha).toLocaleString('es-AR')}
          </span>
        )}
      </div>

      {cargando ? (
        <div role="status" className="py-8 text-center text-slate-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2 align-middle"></div>
          Calculando recomendación...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-800 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => setIntento((actual) => actual + 1)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition self-start sm:self-auto"
          >
            Reintentar
          </button>
        </div>
      ) : (
        datos && (
          <div className="space-y-6">
            {/* 1. Resultado */}
            {recomendacion ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Cultivo recomendado
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                      {recomendacion.cultivo}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Familia botánica: {recomendacion.familiaBotanica}
                    </p>
                  </div>
                  <span className="inline-flex items-baseline gap-1 self-start sm:self-auto px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="text-2xl font-bold">{numero(recomendacion.puntaje)}</span>
                    <span className="text-xs font-semibold">/ 100</span>
                  </span>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, indice) => (
                    <span
                      key={indice}
                      className={`h-2.5 flex-1 rounded-full ${
                        indice < Math.round(recomendacion.puntaje / 10)
                          ? colorPuntaje(recomendacion.puntaje)
                          : 'bg-slate-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
                <p className="font-semibold text-base">Sin recomendación de cultivo disponible</p>
                <p className="text-amber-800">
                  Ningún cultivo cumple con las condiciones agronómicas o no hay datos suficientes para recomendar una opción para la próxima campaña.
                </p>
                {datos.advertencias.length > 0 && (
                  <div className="pt-1">
                    <p className="font-medium text-xs uppercase tracking-wide text-amber-950 mb-1">
                      Motivos:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                      {datos.advertencias.map((advertencia, indice) => (
                        <li key={indice}>{advertencia}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 2. Motivo */}
            {recomendacion && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900">Por qué este cultivo</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{recomendacion.motivo}</p>
              </div>
            )}

            {/* 3. Qué se consideró */}
            {recomendacion && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Qué se consideró</h3>
                <ul className="space-y-3 list-none p-0 m-0">
                  {ORDEN_FACTORES.map((nombre) => {
                    const factor = recomendacion.factores.find((f) => f.nombre === nombre);
                    const pesoAplicado = datos.pesosAplicados[nombre];

                    if (!factor) {
                      return (
                        <li
                          key={nombre}
                          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-600">
                              {ETIQUETAS_FACTOR[nombre]}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              Peso {Math.round(pesoAplicado * 100)}% · factor no aplicado
                            </span>
                          </div>
                        </li>
                      );
                    }

                    const valorBarra = Math.min(100, Math.max(0, factor.valor));

                    return (
                      <li key={nombre} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {ETIQUETAS_FACTOR[factor.nombre]}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            Peso {Math.round(factor.peso * 100)}% · Valor{' '}
                            {numero(factor.valor, 0)}/100 · Aporte {numero(factor.aporte)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${valorBarra}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{factor.motivo}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 4. Clima considerado */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 mr-1">Clima considerado</h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    BADGE_CLIMA[datos.climaUtilizado.fuente].clases
                  }`}
                >
                  {BADGE_CLIMA[datos.climaUtilizado.fuente].texto}
                </span>
                <span className="text-xs text-slate-500">
                  {formatearAntiguedad(datos.climaUtilizado.antiguedadHoras)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Temperatura mínima próxima
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {typeof datos.climaUtilizado.tempMinProxima === 'number'
                      ? `${numero(datos.climaUtilizado.tempMinProxima)} °C`
                      : 'Sin dato'}
                  </p>
                </div>
                {typeof datos.climaUtilizado.diasConRiesgoHelada === 'number' && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Días con riesgo de helada
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {datos.climaUtilizado.diasConRiesgoHelada}
                    </p>
                  </div>
                )}
              </div>

              {diasClima.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <caption className="sr-only">
                      Pronóstico diario considerado para el cálculo de la recomendación
                    </caption>
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Fecha
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Mín
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Máx
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Precip.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {diasClima.map((dia) => (
                        <tr key={dia.fecha} className="hover:bg-slate-50/60 transition">
                          <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                            {formatearFecha(dia.fecha)}
                          </td>
                          <td className="px-3 py-2.5 text-blue-700 font-semibold whitespace-nowrap">
                            {numero(dia.tempMin)} °C
                          </td>
                          <td className="px-3 py-2.5 text-red-600 font-semibold whitespace-nowrap">
                            {numero(dia.tempMax)} °C
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                            {numero(dia.precipitacion)} mm
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No hay pronóstico disponible para el lote.
                </p>
              )}
            </div>

            {/* 5. Precio de referencia */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 mr-1">Precio de referencia</h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    BADGE_PRECIO[datos.precioUtilizado.fuente].clases
                  }`}
                >
                  {BADGE_PRECIO[datos.precioUtilizado.fuente].texto}
                </span>
                <span className="text-xs text-slate-500">
                  {datos.precioUtilizado.moneda}
                  {typeof datos.precioUtilizado.antiguedadDias === 'number' &&
                    ` · antigüedad ${datos.precioUtilizado.antiguedadDias} ${
                      datos.precioUtilizado.antiguedadDias === 1 ? 'día' : 'días'
                    }`}
                </span>
              </div>

              {preciosOrdenados.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <caption className="sr-only">
                      Precios de referencia usados en el cálculo
                    </caption>
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Cultivo
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {preciosOrdenados.map(([cultivo, precio]) => (
                        <tr key={cultivo} className="hover:bg-slate-50/60 transition">
                          <td className="px-3 py-2.5 font-medium text-slate-800">{cultivo}</td>
                          <td className="px-3 py-2.5 text-slate-700 text-right whitespace-nowrap">
                            {numero(precio)} {datos.precioUtilizado.moneda}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No hay valores de referencia disponibles.
                </p>
              )}
            </div>

            {/* 6. Historial */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Historial del lote</h3>
              {datos.historial.tieneHistorial && datos.historial.ultimoCultivo ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-900">Último cultivo:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {datos.historial.ultimoCultivo.cultivo}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-slate-800">
                    Campaña {datos.historial.ultimoCultivo.campania}
                  </span>
                  {datos.historial.ultimoCultivo.familiaBotanica && (
                    <>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                        Familia: {datos.historial.ultimoCultivo.familiaBotanica}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                  <p className="font-semibold">Sin historial de campañas</p>
                  <p className="mt-1">
                    {datos.historial.sugerencia ??
                      'Registrá el último cultivo del lote para mejorar la precisión de la recomendación.'}
                  </p>
                </div>
              )}
            </div>

            {/* 7. Advertencias (el caso sin recomendación ya las muestra arriba) */}
            {recomendacion && datos.advertencias.length > 0 && (
              <aside
                aria-label="Advertencias de la recomendación"
                className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2"
              >
                <h3 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span>⚠️</span> Advertencias
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {datos.advertencias.map((advertencia, indice) => (
                    <li key={indice}>{advertencia}</li>
                  ))}
                </ul>
              </aside>
            )}

            {/* 8. Alternativas */}
            {datos.alternativas.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Alternativas evaluadas</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
                  {datos.alternativas.map((alternativa) => (
                    <li
                      key={alternativa.cultivo}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {alternativa.cultivo}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                          {numero(alternativa.puntaje)} / 100
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {alternativa.motivo}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
