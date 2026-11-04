import type { Polygon } from 'geojson';
import { apiFetch } from './http';

export interface ParcelaDetalleResponse {
  id: string;
  nombre: string | null;
  poligono: Polygon;
  hectareas: number;
  createdAt: string;
}

/** PUT /api/parcelas/:id — renombra una parcela del usuario autenticado. */
export function actualizarNombreParcela(
  id: string,
  nombre: string,
): Promise<ParcelaDetalleResponse> {
  return apiFetch<ParcelaDetalleResponse>(`/api/parcelas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { nombre },
  });
}

/** DELETE /api/parcelas/:id — elimina la parcela y su historial en cascada. */
export function eliminarParcela(id: string): Promise<void> {
  return apiFetch<void>(`/api/parcelas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
