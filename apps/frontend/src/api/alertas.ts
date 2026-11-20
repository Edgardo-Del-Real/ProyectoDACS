import { apiFetch } from './http';

export type TipoAlerta = 'HELADA' | 'SEQUIA' | 'SIEMBRA' | 'COSECHA' | 'PRECIO';

export interface AlertaItem {
  id: string;
  userId: string;
  parcelaId: string;
  parcelaNombre: string | null;
  parcelaHectareas?: number;
  tipo: TipoAlerta;
  fechaEvento: string;
  valorDetectado: number;
  umbral: number;
  mensaje: string;
  emailEnviado: boolean;
  enviadoAt: string | null;
  leida: boolean;
  createdAt: string;
}

export interface ResumenAlertas {
  total: number;
  noLeidas: number;
  heladas: number;
  sequias: number;
}

export interface UmbralesAlerta {
  heladaC: number;
  ventanaHeladaDias: number;
  sequiaMm: number;
  ventanaDedupeSequiaDias: number;
}

export interface ListarAlertasResponse {
  alertas: AlertaItem[];
  resumen: ResumenAlertas;
  umbrales: UmbralesAlerta;
}

export interface VerificarAlertasResponse extends ListarAlertasResponse {
  parcelasEvaluadas: number;
  nuevas: AlertaItem[];
  omitidasPorDedupe: number;
}

/** GET /api/alertas — obtiene las alertas climáticas del productor autenticado. */
export function obtenerAlertas(filtros?: {
  parcelaId?: string;
  soloNoLeidas?: boolean;
  signal?: AbortSignal;
}): Promise<ListarAlertasResponse> {
  const params = new URLSearchParams();
  if (filtros?.parcelaId) {
    params.set('parcelaId', filtros.parcelaId);
  }
  if (filtros?.soloNoLeidas) {
    params.set('soloNoLeidas', 'true');
  }
  const query = params.toString();
  const path = query ? `/api/alertas?${query}` : '/api/alertas';
  return apiFetch<ListarAlertasResponse>(path, { signal: filtros?.signal });
}

/** POST /api/alertas/verificar — ejecuta la evaluación de helada y sequía con dedupe y email. */
export function verificarAlertasAhora(parcelaId?: string): Promise<VerificarAlertasResponse> {
  return apiFetch<VerificarAlertasResponse>('/api/alertas/verificar', {
    method: 'POST',
    body: parcelaId ? { parcelaId } : {},
  });
}

/** PATCH /api/alertas/:id/leida — marca una alerta como leída o no leída en el panel. */
export function actualizarAlertaLeida(id: string, leida = true): Promise<AlertaItem> {
  return apiFetch<AlertaItem>(`/api/alertas/${encodeURIComponent(id)}/leida`, {
    method: 'PATCH',
    body: { leida },
  });
}

/** POST /api/alertas/test-email — envía un correo de prueba vía Nodemailer. */
export function enviarEmailPrueba(): Promise<{ ok: boolean; mensaje: string; destinatario: string }> {
  return apiFetch<{ ok: boolean; mensaje: string; destinatario: string }>('/api/alertas/test-email', {
    method: 'POST',
  });
}

/** POST /api/alertas/:id/reenviar-email — reenvía el correo de una alerta registrada. */
export function reenviarEmailAlerta(id: string): Promise<{ alerta: AlertaItem; mensaje: string }> {
  return apiFetch<{ alerta: AlertaItem; mensaje: string }>(
    `/api/alertas/${encodeURIComponent(id)}/reenviar-email`,
    {
      method: 'POST',
    },
  );
}

