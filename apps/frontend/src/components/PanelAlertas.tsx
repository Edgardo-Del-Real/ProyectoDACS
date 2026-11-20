import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  actualizarAlertaLeida,
  enviarEmailPrueba,
  obtenerAlertas,
  reenviarEmailAlerta,
  verificarAlertasAhora,
  type AlertaItem,
  type ResumenAlertas,
  type UmbralesAlerta,
} from '../api/alertas';
import { ApiError } from '../api/http';

interface PanelAlertasProps {
  /** Si se especifica, acota el listado y la verificación a una única parcela. */
  parcelaId?: string;
  /** Indica si el usuario posee al menos una parcela para habilitar la verificación. */
  tieneParcelas?: boolean;
  /** Incrementar para forzar recarga cuando cambia el pronóstico o la lista de parcelas. */
  revision?: number;
}

function formatearFechaEvento(fechaIso: string): string {
  const partes = fechaIso.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaIso;
}

function derivarResumenDeAlertas(lista: AlertaItem[]): ResumenAlertas {
  return {
    total: lista.length,
    noLeidas: lista.filter((a) => !a.leida).length,
    heladas: lista.filter((a) => a.tipo === 'HELADA').length,
    sequias: lista.filter((a) => a.tipo === 'SEQUIA').length,
  };
}

export const PanelAlertas: React.FC<PanelAlertasProps> = ({
  parcelaId,
  tieneParcelas = true,
  revision = 0,
}) => {
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [resumen, setResumen] = useState<ResumenAlertas>({
    total: 0,
    noLeidas: 0,
    heladas: 0,
    sequias: 0,
  });
  const [umbrales, setUmbrales] = useState<UmbralesAlerta>({
    heladaC: 0,
    ventanaHeladaDias: 3,
    sequiaMm: 10,
    ventanaDedupeSequiaDias: 3,
  });

  const [cargando, setCargando] = useState<boolean>(true);
  const [verificando, setVerificando] = useState<boolean>(false);
  const [probandoEmail, setProbandoEmail] = useState<boolean>(false);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackVerificacion, setFeedbackVerificacion] = useState<string | null>(null);
  const [mostrarLeidas, setMostrarLeidas] = useState<boolean>(false);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const cargarAlertas = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setError(null);
      try {
        const data = await obtenerAlertas({ parcelaId, signal });
        if (!signal?.aborted) {
          setAlertas(data.alertas);
          setResumen(data.resumen);
          setUmbrales(data.umbrales);
        }
      } catch (err) {
        if (signal?.aborted) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar las alertas climáticas.';
        setError(msg);
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    [parcelaId],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarAlertas(controller.signal);
    return () => controller.abort();
  }, [cargarAlertas, revision]);

  const handleVerificarAhora = async () => {
    setVerificando(true);
    setError(null);
    setFeedbackVerificacion(null);
    try {
      const resultado = await verificarAlertasAhora(parcelaId);
      setAlertas(resultado.alertas);
      setResumen(resultado.resumen);
      setUmbrales(resultado.umbrales);

      if (resultado.nuevas.length > 0) {
        setFeedbackVerificacion(
          `Se detectaron ${resultado.nuevas.length} nueva(s) alerta(s) y se despachó el aviso por email.`,
        );
      } else if (resultado.omitidasPorDedupe > 0) {
        setFeedbackVerificacion(
          `Verificación completada: ${resultado.omitidasPorDedupe} evento(s) ya habían sido alertados (sin emails duplicados).`,
        );
      } else {
        setFeedbackVerificacion(
          'Verificación completada: no se detectaron riesgos de helada ni estrés hídrico en el pronóstico actual.',
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo ejecutar la verificación de alertas.',
      );
    } finally {
      setVerificando(false);
    }
  };

  const handleToggleLeida = async (alerta: AlertaItem) => {
    setActualizandoId(alerta.id);
    try {
      const actualizada = await actualizarAlertaLeida(alerta.id, !alerta.leida);
      setAlertas((prev) => {
        const actualizadas = prev.map((a) => (a.id === alerta.id ? actualizada : a));
        setResumen(derivarResumenDeAlertas(actualizadas));
        return actualizadas;
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo actualizar el estado de la alerta.',
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const handleProbarEmail = async () => {
    setProbandoEmail(true);
    setError(null);
    setFeedbackVerificacion(null);
    try {
      const res = await enviarEmailPrueba();
      setFeedbackVerificacion(`✅ ${res.mensaje}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al enviar el correo de prueba. Verificá la configuración SMTP.',
      );
    } finally {
      setProbandoEmail(false);
    }
  };

  const handleReenviarEmail = async (alerta: AlertaItem) => {
    setReenviandoId(alerta.id);
    setError(null);
    setFeedbackVerificacion(null);
    try {
      const res = await reenviarEmailAlerta(alerta.id);
      setAlertas((prev) => {
        const actualizadas = prev.map((a) => (a.id === alerta.id ? res.alerta : a));
        setResumen(derivarResumenDeAlertas(actualizadas));
        return actualizadas;
      });
      setFeedbackVerificacion(`✅ ${res.mensaje}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo reenviar el correo. Verificá tu configuración SMTP.',
      );
    } finally {
      setReenviandoId(null);
    }
  };

  const alertasVisibles = mostrarLeidas
    ? alertas
    : alertas.filter((a) => !a.leida);

  return (
    <section
      aria-labelledby="titulo-alertas-climaticas"
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
    >
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              id="titulo-alertas-climaticas"
              className="text-base font-bold text-slate-900 flex items-center gap-2"
            >
              <span>🔔</span> Alertas de Helada y Sequía
            </h3>
            {resumen.noLeidas > 0 ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                {resumen.noLeidas} {resumen.noLeidas === 1 ? 'activa' : 'activas'}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Al día
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Helada ≤ {umbrales.heladaC} °C ({umbrales.ventanaHeladaDias * 24} h) • Estrés hídrico &lt;{' '}
            {umbrales.sequiaMm} mm (7 días) • Notificación por email con dedupe
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <button
            type="button"
            onClick={handleProbarEmail}
            disabled={probandoEmail}
            title="Envía un correo de prueba a tu email registrado para comprobar tu configuración SMTP"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
          >
            <span>{probandoEmail ? '⏳' : '📧'}</span>
            <span>{probandoEmail ? 'Enviando prueba...' : 'Probar email'}</span>
          </button>
          <button
            type="button"
            onClick={handleVerificarAhora}
            disabled={verificando || !tieneParcelas}
            title={tieneParcelas ? 'Evaluar pronósticos y detectar heladas/sequías' : 'Registrá una parcela para verificar'}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>{verificando ? '⏳' : '🔄'}</span>
            <span>{verificando ? 'Verificando...' : 'Verificar ahora'}</span>
          </button>
        </div>
      </div>

      {/* Contadores rápidos y filtro */}
      {resumen.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 font-medium">
              ❄️ Heladas: <strong>{resumen.heladas}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-medium">
              🌵 Sequías: <strong>{resumen.sequias}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMostrarLeidas((prev) => !prev)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
          >
            {mostrarLeidas
              ? `Ocultar leídas (${resumen.total - resumen.noLeidas})`
              : `Ver historial completo (${resumen.total})`}
          </button>
        </div>
      )}

      {/* Feedback de verificación manual */}
      {feedbackVerificacion && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2"
        >
          <span>✅ {feedbackVerificacion}</span>
          <button
            type="button"
            onClick={() => setFeedbackVerificacion(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2"
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => void cargarAlertas()}
            className="font-semibold underline hover:text-red-900"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Listado de alertas */}
      {cargando ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          Consultando registro de alertas...
        </div>
      ) : alertasVisibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center space-y-1.5">
          <div className="text-2xl">🛡️</div>
          <p className="text-xs font-semibold text-slate-700">
            {resumen.total > 0 && !mostrarLeidas
              ? 'No tenés alertas pendientes por revisar.'
              : 'Sin alertas de helada ni estrés hídrico registradas.'}
          </p>
          <p className="text-[11px] text-slate-500">
            {tieneParcelas
              ? 'El worker evalúa automáticamente el pronóstico de tus parcelas y te envía un único email por evento detectado.'
              : 'Registrá una parcela para activar el monitoreo automático de heladas y sequías.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertasVisibles.map((alerta) => {
            const esHelada = alerta.tipo === 'HELADA';
            const cardClasses = esHelada
              ? 'border-sky-500 bg-sky-200/40'
              : 'border-amber-500 bg-amber-50/60';
            const badgeClasses = esHelada
              ? 'bg-sky-200 text-sky-900 border-sky-400'
              : 'bg-amber-100 text-amber-900 border-amber-300';

            return (
              <div
                key={alerta.id}
                className={`rounded-xl border p-3.5 transition space-y-2 ${cardClasses} ${
                  alerta.leida ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${badgeClasses}`}
                    >
                      {esHelada ? '❄️ Helada' : '🌵 Estrés Hídrico'}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      📅 {formatearFechaEvento(alerta.fechaEvento)}
                    </span>
                    <span className="text-xs font-bold text-slate-900 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                      {esHelada
                        ? `Mín: ${alerta.valorDetectado} °C`
                        : `Acum: ${alerta.valorDetectado} mm`}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={actualizandoId === alerta.id}
                    onClick={() => handleToggleLeida(alerta)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shrink-0"
                  >
                    {alerta.leida ? 'Marcar activa' : '✓ Entendido'}
                  </button>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed">{alerta.mensaje}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    {!parcelaId && (
                      <Link
                        to={`/parcelas/${alerta.parcelaId}`}
                        className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        📍 {alerta.parcelaNombre || 'Ver parcela'}
                      </Link>
                    )}
                    {alerta.emailEnviado ? (
                      <span
                        className="inline-flex items-center gap-1 text-emerald-700 font-medium"
                        title={
                          alerta.enviadoAt
                            ? `Enviado el ${new Date(alerta.enviadoAt).toLocaleString('es-AR')}`
                            : 'Email enviado'
                        }
                      >
                        ✉️ Email enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium" title="No se pudo despachar el email (revisá tu configuración SMTP)">
                        ⚠️ Email no enviado
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={reenviandoId === alerta.id}
                      onClick={() => handleReenviarEmail(alerta)}
                      title="Enviar o reenviar la alerta por email a tu correo registrado"
                      className="px-2 py-0.5 bg-white hover:bg-emerald-50 disabled:opacity-60 text-emerald-700 border border-emerald-300 hover:border-emerald-400 rounded-md text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer ml-1"
                    >
                      <span>{reenviandoId === alerta.id ? '⏳' : '✉️'}</span>
                      <span>{reenviandoId === alerta.id ? 'Enviando...' : 'Reenviar email'}</span>
                    </button>
                  </div>

                  <span>
                    Detectada: {new Date(alerta.createdAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
