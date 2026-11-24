import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actualizarNombreParcela, eliminarParcela } from './parcelas';
import * as httpModule from './http';

describe('api/parcelas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('actualizarNombreParcela', () => {
    it('llama a apiFetch con método PUT y nombre en el body', async () => {
      const mockResponse = {
        id: 'parcela-1',
        nombre: 'Lote Norte Nuevo',
        poligono: { type: 'Polygon' as const, coordinates: [] },
        hectareas: 10,
        createdAt: '2026-01-01',
      };
      const apiFetchSpy = vi.spyOn(httpModule, 'apiFetch').mockResolvedValue(mockResponse);

      const res = await actualizarNombreParcela('parcela-1', 'Lote Norte Nuevo');

      expect(res).toEqual(mockResponse);
      expect(apiFetchSpy).toHaveBeenCalledWith('/api/parcelas/parcela-1', {
        method: 'PUT',
        body: { nombre: 'Lote Norte Nuevo' },
      });
    });
  });

  describe('eliminarParcela', () => {
    it('llama a apiFetch con método DELETE y el id en la ruta', async () => {
      const apiFetchSpy = vi.spyOn(httpModule, 'apiFetch').mockResolvedValue(undefined);

      await eliminarParcela('parcela-abc');

      expect(apiFetchSpy).toHaveBeenCalledWith('/api/parcelas/parcela-abc', {
        method: 'DELETE',
      });
    });
  });
});
