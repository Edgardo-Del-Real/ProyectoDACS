import { API_URL, getToken, ApiError } from './http';

export interface AsociacionProductorItem {
  asociacionId: string;
  fechaAsociacion: string;
  productor: {
    id: string;
    nombre: string | null;
    email: string;
    rol: string;
    parcelas: {
      id: string;
      nombre: string | null;
      hectareas: number;
      createdAt: string;
    }[];
  };
}

/**
 * Descarga el informe técnico en PDF para una parcela dada (US-11).
 * Lanza ApiError con status 403 si la parcela no pertenece al usuario ni a un productor asociado.
 */
export async function descargarInformePdf(parcelaId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new ApiError('No hay sesión activa. Por favor, iniciá sesión.', 401);
  }

  const response = await fetch(
    `${API_URL}/api/parcelas/${encodeURIComponent(parcelaId)}/informe-pdf`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    let errorMsg = `Error al descargar el informe (HTTP ${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) errorMsg = data.error;
    } catch {
      // Ignorar fallo de parseo JSON en caso de error plano
    }
    throw new ApiError(errorMsg, response.status);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const disposition = response.headers.get('Content-Disposition');
  let filename = `informe-planificacion-${parcelaId}.pdf`;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Consulta la lista de productores vinculados a la cuenta técnica del usuario (US-11).
 */
export async function obtenerProductoresAsociados(): Promise<AsociacionProductorItem[]> {
  const token = getToken();
  if (!token) throw new ApiError('No hay sesión activa.', 401);

  const res = await fetch(`${API_URL}/api/tecnico/productores`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new ApiError('Error al obtener productores asociados', res.status);
  }

  return res.json() as Promise<AsociacionProductorItem[]>;
}
