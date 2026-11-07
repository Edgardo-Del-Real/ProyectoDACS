/**
 * Cliente HTTP mínimo para el frontend.
 *
 * Centraliza tres cosas que antes se repetían en cada página: la resolución del
 * token, la base URL de la API y el manejo uniforme de errores de respuesta.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? '';

/** Error de la API con el status HTTP disponible para decidir cómo reaccionar. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('dacs_token') || localStorage.getItem('token');
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Ejecuta una request autenticada contra el BFF.
 *
 * Lanza `ApiError` cuando la respuesta no es 2xx, usando el mensaje que envía el
 * backend (`error` o `message`) y un texto de respaldo cuando no viene ninguno.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const token = getToken();
  if (!token) {
    throw new ApiError('No hay sesión activa. Por favor, iniciá sesión.', 401);
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const mensaje =
      (data as { error?: string; message?: string } | null)?.error ??
      (data as { error?: string; message?: string } | null)?.message ??
      `La operación falló (HTTP ${response.status}).`;
    throw new ApiError(mensaje, response.status);
  }

  // 204 No Content: no hay body que parsear.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
