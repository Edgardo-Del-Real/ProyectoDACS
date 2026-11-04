import { useEffect, useState } from 'react';

interface PasoRotacion {
  orden: number;
  campania: string;
  estado: 'sugerido' | 'sin_alternativa' | 'datos_insuficientes';
  cultivo: string | null;
  familiaBotanica: string | null;
  aniosEsperaMismaFamilia: number | null;
  efectoSuelo: string | null;
  recomendacionSucesion: string | null;
  fuente: string | null;
  motivoSeleccion: string;
}

interface CultivoCatalogo {
  nombre: string;
  familiaBotanica: string | null;
  efectoSuelo: string | null;
  aniosEsperaMismaFamilia: number | null;
  recomendacionSucesion: string | null;
  fuente: string | null;
}

interface PlanRotacionResponse {
  parcelaId: string;
  parcelaNombre: string | null;
  tieneHistorial: boolean;
  ultimoCultivo: { campania: string; cultivo: string; familiaBotanica: string | null } | null;
  secuencia: PasoRotacion[];
  catalogo: CultivoCatalogo[];
  supuestos: string[];
  registrosIgnorados: number;
}

const CULTIVOS_POR_DEFECTO = [
  'Soja 1ra',
  'Maíz tardío',
  'Trigo pan',
  'Girasol',
  'Sorgo granífero',
  'Cebada cervecera',
];

const OPCIONES_ANIOS = [2, 3, 4, 5, 6];

export function PlanRotacion({ id, revision }: { id: string; revision: number }) {
  const [plan, setPlan] = useState<PlanRotacionResponse | null>(null);
  const [cargandoPlan, setCargandoPlan] = useState(true);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [anios, setAnios] = useState<number>(4);
  const [cultivosExcluidos, setCultivosExcluidos] = useState<string[]>([]);
  const [intento, setIntento] = useState(0);

  const toggleCultivo = (nombre: string) => {
    setCultivosExcluidos((prev) =>
      prev.includes(nombre) ? prev.filter((c) => c !== nombre) : [...prev, nombre],
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    const cargarPlan = async () => {
      setCargandoPlan(true);
      setErrorPlan(null);
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('dacs_token');
        if (!token) throw new Error('No hay sesión activa. Por favor, iniciá sesión.');

        const params = new URLSearchParams({ anios: String(anios) });
        if (cultivosExcluidos.length > 0) {
          params.set('excluir', cultivosExcluidos.join(','));
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL ?? ''}/api/parcelas/${encodeURIComponent(id)}/rotacion?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error || data?.message || 'Error al obtener el plan de rotación',
          );
        }
        const data: PlanRotacionResponse = await response.json();
        if (!controller.signal.aborted) setPlan(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorPlan(
          err instanceof Error ? err.message : 'No se pudo cargar el plan de rotación',
        );
      } finally {
        if (!controller.signal.aborted) setCargandoPlan(false);
      }
    };

    void cargarPlan();
    return () => controller.abort();
  }, [id, revision, anios, cultivosExcluidos, intento]);

  const listaCultivosDisponibles =
    plan && plan.catalogo.length > 0
      ? plan.catalogo.map((c) => c.nombre)
      : CULTIVOS_POR_DEFECTO;

  return (
    <section
      aria-labelledby="titulo-rotacion"
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
    >
      {/* Cabecera y selector de horizonte */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 id="titulo-rotacion" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🌾</span> Plan de rotación plurianual a {anios} años
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Herramienta orientativa de apoyo a la decisión según el historial del lote y el catálogo agronómico. Consultá siempre con un ingeniero agrónomo.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="select-anios-rotacion" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Horizonte:
          </label>
          <select
            id="select-anios-rotacion"
            value={anios}
            onChange={(e) => setAnios(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
          >
            {OPCIONES_ANIOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion} campañas ({opcion} años)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selector de cultivos que el productor trabaja en el lote */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Cultivos viables en tu lote (hacé clic para activar o excluir):
          </span>
          {cultivosExcluidos.length > 0 && (
            <button
              type="button"
              onClick={() => setCultivosExcluidos([])}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline self-start sm:self-auto"
            >
              Habilitar todos
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {listaCultivosDisponibles.map((nombreCultivo) => {
            const activo = !cultivosExcluidos.includes(nombreCultivo);
            return (
              <button
                key={nombreCultivo}
                type="button"
                aria-pressed={activo}
                onClick={() => toggleCultivo(nombreCultivo)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  activo
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs hover:bg-emerald-700'
                    : 'bg-white text-slate-500 border-slate-300 line-through hover:bg-slate-100'
                }`}
              >
                <span>{activo ? '✓' : '✕'}</span>
                <span>{nombreCultivo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {cargandoPlan ? (
        <div role="status" className="py-8 text-center text-slate-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-emerald-600 mr-2 align-middle"></div>
          Cargando plan de rotación...
        </div>
      ) : errorPlan ? (
        <div
          role="alert"
          className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-800 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <p className="font-medium">{errorPlan}</p>
          <button
            type="button"
            onClick={() => setIntento((actual) => actual + 1)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition self-start sm:self-auto"
          >
            Reintentar plan de rotación
          </button>
        </div>
      ) : (
        plan && (
          <div className="space-y-4">
            {!plan.tieneHistorial && (
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                No hay historial utilizable para elaborar el plan. Registrá una campaña válida arriba; revisá los avisos si ya cargaste registros.
              </div>
            )}

            {plan.ultimoCultivo && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-900">Último cultivo considerado:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {plan.ultimoCultivo.cultivo}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-800">Campaña {plan.ultimoCultivo.campania}</span>
                {plan.ultimoCultivo.familiaBotanica && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                      Familia: {plan.ultimoCultivo.familiaBotanica}
                    </span>
                  </>
                )}
              </div>
            )}

            {(plan.supuestos.length > 0 || plan.registrosIgnorados > 0) && (
              <aside
                aria-label="Avisos y supuestos del plan"
                className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-2"
              >
                <h3 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span>⚠️</span> Avisos y supuestos del motor
                </h3>
                {plan.registrosIgnorados > 0 && (
                  <p>
                    Registros ignorados por el motor:{' '}
                    <strong className="font-bold">{plan.registrosIgnorados}</strong>. Revisá las campañas del historial.
                  </p>
                )}
                {plan.supuestos.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1">
                    {plan.supuestos.map((supuesto, index) => (
                      <li key={index}>{supuesto}</li>
                    ))}
                  </ul>
                )}
              </aside>
            )}

            {plan.secuencia.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No hay una secuencia disponible con los datos actuales.
              </p>
            ) : (
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0 m-0">
                {plan.secuencia.map((paso) => {
                  const esSugerido = paso.estado === 'sugerido';
                  return (
                    <li
                      key={`${paso.orden}-${paso.campania}`}
                      className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-emerald-200 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Paso {paso.orden}
                          </span>
                          <h3 className="text-base font-bold text-slate-900">
                            Campaña {paso.campania}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            esSugerido
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {esSugerido
                            ? `Sugerido: ${paso.cultivo ?? 'Cultivo no informado'}`
                            : paso.estado === 'sin_alternativa'
                              ? 'Sin alternativa compatible'
                              : 'Datos insuficientes'}
                        </span>
                      </div>

                      {paso.familiaBotanica && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="bg-white px-2.5 py-0.5 rounded-md border border-slate-200 font-medium">
                            🌿 Familia: <strong>{paso.familiaBotanica}</strong>
                          </span>
                          {paso.aniosEsperaMismaFamilia !== null && (
                            <span className="bg-white px-2.5 py-0.5 rounded-md border border-slate-200 font-medium">
                              ⏳ Espera mín.: <strong>{paso.aniosEsperaMismaFamilia} año(s)</strong>
                            </span>
                          )}
                        </div>
                      )}

                      <details className="group bg-white rounded-xl border border-slate-200 p-3 text-xs sm:text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-emerald-700 hover:text-emerald-800 select-none">
                          Ver efecto en el suelo y motivo
                        </summary>
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs leading-relaxed">
                          <p>
                            <strong className="text-slate-900">Motivo de selección:</strong>{' '}
                            {paso.motivoSeleccion}
                          </p>
                          <p>
                            <strong className="text-slate-900">Efecto esperado sobre el suelo:</strong>{' '}
                            {paso.efectoSuelo ?? 'Sin información disponible.'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Familia botánica:</strong>{' '}
                            {paso.familiaBotanica ?? 'Sin información disponible.'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Espera para repetir familia:</strong>{' '}
                            {paso.aniosEsperaMismaFamilia === null
                              ? 'Sin información disponible.'
                              : `${paso.aniosEsperaMismaFamilia} año(s)`}
                          </p>
                          <p>
                            <strong className="text-slate-900">Recomendación de sucesión:</strong>{' '}
                            {paso.recomendacionSucesion ?? 'Sin información disponible.'}
                          </p>
                          <p className="text-slate-500">
                            <strong className="text-slate-700">Fuente:</strong>{' '}
                            {paso.fuente ?? 'Sin fuente informada.'}
                          </p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )
      )}
    </section>
  );
}
