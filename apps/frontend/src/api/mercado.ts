import { apiFetch } from './http.js';

export interface CotizacionFuturo {
  id?: string;
  cultivo: string;
  posicion: string;
  descripcionPosicion: string;
  fecha: string;
  fuente: string;
  valor: number;
  moneda: string;
  variacionDiaPct: number;
}

export interface MercadoResumenResponse {
  cultivo: string;
  cultivosDisponibles: string[];
  cotizaciones: CotizacionFuturo[];
  spotActual: number | null;
  futuroCercano: CotizacionFuturo | null;
  ultimaActualizacion: string;
  stale: boolean;
  fuente: string;
}

export interface SerieHistoricaPunto {
  fecha: string;
  valor: number;
  posicion: string;
}

export interface TendenciaMercadoResponse {
  cultivo: string;
  posicion: string;
  puntos: SerieHistoricaPunto[];
  minimo: number;
  maximo: number;
  promedio: number;
  variacionTotalPct: number;
  stale: boolean;
}

export async function obtenerCotizaciones(cultivo = 'Soja'): Promise<MercadoResumenResponse> {
  return apiFetch<MercadoResumenResponse>(`/api/mercado/cotizaciones?cultivo=${encodeURIComponent(cultivo)}`);
}

export async function obtenerTendencia(
  cultivo = 'Soja',
  posicion = 'DISPONIBLE',
  dias = 30,
): Promise<TendenciaMercadoResponse> {
  return apiFetch<TendenciaMercadoResponse>(
    `/api/mercado/historico?cultivo=${encodeURIComponent(cultivo)}&posicion=${encodeURIComponent(posicion)}&dias=${dias}`,
  );
}
