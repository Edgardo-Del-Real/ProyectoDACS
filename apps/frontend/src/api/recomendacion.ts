import { apiFetch } from './http';

export interface DiaClima {
  fecha: string;
  tempMax: number;
  tempMin: number;
  precipitacion: number;
}

export interface ClimaUtilizado {
  fuente: 'live' | 'cache' | 'no_disponible';
  antiguedadHoras: number | null;
  tempMinProxima: number | null;
  diasConRiesgoHelada: number;
  dias: DiaClima[];
}

export interface PrecioUtilizado {
  fuente: 'bd' | 'simulado' | 'no_disponible';
  antiguedadDias: number | null;
  moneda: string;
  valores: Record<string, number>;
}

export interface HistorialRecomendacion {
  tieneHistorial: boolean;
  ultimoCultivo: {
    cultivo: string;
    campania: string;
    familiaBotanica: string | null;
  } | null;
  sugerencia: string | null;
}

export interface FactorPuntaje {
  nombre: 'rotacion' | 'clima' | 'precio';
  peso: number;
  valor: number;
  aporte: number;
  motivo: string;
}

export interface RecomendacionCultivo {
  cultivo: string;
  familiaBotanica: string;
  puntaje: number;
  motivo: string;
  factores: FactorPuntaje[];
}

export interface AlternativaRecomendacion {
  cultivo: string;
  puntaje: number;
  motivo: string;
}

export interface RecomendacionResponse {
  parcela: { id: string; nombre: string | null };
  fecha: string;
  recomendacion: RecomendacionCultivo | null;
  alternativas: AlternativaRecomendacion[];
  pesosAplicados: { rotacion: number; clima: number; precio: number };
  climaUtilizado: ClimaUtilizado;
  precioUtilizado: PrecioUtilizado;
  historial: HistorialRecomendacion;
  advertencias: string[];
}

/** POST /api/parcelas/:id/recomendacion — recomienda el cultivo de la próxima campaña. */
export function obtenerRecomendacion(
  id: string,
  signal?: AbortSignal,
): Promise<RecomendacionResponse> {
  return apiFetch<RecomendacionResponse>(
    `/api/parcelas/${encodeURIComponent(id)}/recomendacion`,
    { method: 'POST', signal },
  );
}
