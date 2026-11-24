import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiFetch, ApiError, getToken, API_URL } from './http';

describe('api/http', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getToken', () => {
    it('devuelve el token guardado en dacs_token', () => {
      localStorage.setItem('dacs_token', 'jwt-test-123');
      expect(getToken()).toBe('jwt-test-123');
    });

    it('devuelve el token guardado en token si no existe dacs_token', () => {
      localStorage.setItem('token', 'jwt-fallback-456');
      expect(getToken()).toBe('jwt-fallback-456');
    });

    it('devuelve null si no hay token en localStorage', () => {
      expect(getToken()).toBeNull();
    });
  });

  describe('apiFetch', () => {
    it('lanza ApiError con status 401 si no hay token de sesión', async () => {
      await expect(apiFetch('/test')).rejects.toThrow(ApiError);
      await expect(apiFetch('/test')).rejects.toMatchObject({
        status: 401,
        message: 'No hay sesión activa. Por favor, iniciá sesión.',
      });
    });

    it('envía cabecera Authorization con Bearer token', async () => {
      localStorage.setItem('dacs_token', 'token-valido');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const data = await apiFetch<{ ok: boolean }>('/parcelas');
      expect(data).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/parcelas`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer token-valido',
          },
        }),
      );
    });

    it('adjunta Content-Type json y serializa el body en peticiones POST', async () => {
      localStorage.setItem('dacs_token', 'token-valido');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = { nombre: 'Lote Norte' };
      const data = await apiFetch<{ id: string }>('/parcelas', {
        method: 'POST',
        body: payload,
      });

      expect(data).toEqual({ id: '123' });
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/parcelas`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-valido',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
      );
    });

    it('devuelve undefined cuando la respuesta es 204 No Content', async () => {
      localStorage.setItem('dacs_token', 'token-valido');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await apiFetch<void>('/parcelas/1', { method: 'DELETE' });
      expect(result).toBeUndefined();
    });

    it('lanza ApiError con el mensaje de error provisto por el backend en respuestas no-ok', async () => {
      localStorage.setItem('dacs_token', 'token-valido');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Parcela no encontrada' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiFetch('/parcelas/999')).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        message: 'Parcela no encontrada',
      });
    });

    it('utiliza mensaje de respaldo cuando el backend no devuelve JSON en respuestas no-ok', async () => {
      localStorage.setItem('dacs_token', 'token-valido');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json');
        },
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiFetch('/error')).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
        message: 'La operación falló (HTTP 500).',
      });
    });
  });
});
