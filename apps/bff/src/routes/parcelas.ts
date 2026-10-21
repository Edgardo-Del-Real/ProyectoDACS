import type { FastifyPluginAsync } from 'fastify';
import type { Polygon } from 'geojson';
import { prisma } from '../db.js';

interface CrearParcelaBody {
  nombre: string;
  poligono: Polygon;
  hectareas: number;
}

interface Punto {
  lng: number;
  lat: number;
}

/**
 * Valida que un polígono GeoJSON sea geométricamente válido:
 * - Mínimo 3 puntos distintos (4 coordenadas cerrando el ring)
 * - Primer y último punto deben coincidir (ring cerrado)
 * - No debe tener lados cruzados (self-intersection)
 */
function validarPoligono(poligono: unknown): { valido: true; data: Polygon } | { valido: false; error: string } {
  if (!poligono || typeof poligono !== 'object') {
    return { valido: false, error: 'El polígono debe ser un objeto' };
  }

  const p = poligono as Record<string, unknown>;
  
  if (p.type !== 'Polygon') {
    return { valido: false, error: 'El polígono debe tener type "Polygon"' };
  }

  const coords = p.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    return { valido: false, error: 'El polígono debe tener al menos un anillo de coordenadas' };
  }

  const ring = coords[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { valido: false, error: 'El polígono debe tener al menos 3 puntos (4 coordenadas cerrando el ring)' };
  }

  // Validar que el ring esté cerrado (primer punto == último punto)
  const primer = ring[0];
  const ultimo = ring[ring.length - 1];
  if (!Array.isArray(primer) || !Array.isArray(ultimo)) {
    return { valido: false, error: 'Coordenadas inválidas en el ring' };
  }
  if (primer[0] !== ultimo[0] || primer[1] !== ultimo[1]) {
    return { valido: false, error: 'El polígono debe estar cerrado (primer punto debe coincidir con el último)' };
  }

  // Validar que los primeros 3 puntos sean distintos
  const puntosUnicos = new Set<string>();
  for (let i = 0; i < Math.min(3, ring.length); i++) {
    const [lng, lat] = ring[i];
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return { valido: false, error: 'Coordenadas deben ser números' };
    }
    puntosUnicos.add(`${lng.toFixed(8)},${lat.toFixed(8)}`);
  }
  if (puntosUnicos.size < 3) {
    return { valido: false, error: 'El polígono debe tener al menos 3 puntos distintos' };
  }

  // Validar que no haya lados cruzados (self-intersection)
  if (tieneLadosCruzados(ring)) {
    return { valido: false, error: 'El polígono tiene lados cruzados (geometría inválida)' };
  }

  return { valido: true, data: poligono as Polygon };
}

/**
 * Detecta si un ring de coordenadas tiene lados que se cruzan entre sí.
 * Algoritmo O(n²) suficiente para polígonos de tamaño razonable (< 1000 puntos).
 */
function tieneLadosCruzados(ring: number[][]): boolean {
  const n = ring.length - 1; // Último punto == primero, no contar como lado separado

  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Saltar lados adyacentes (comparten vértice)
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;

      const b1 = ring[j];
      const b2 = ring[(j + 1) % n];

      if (segmentosSeCruzan(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Detecta si dos segmentos de línea se cruzan usando el algoritmo de orientación.
 */
function segmentosSeCruzan(a1: number[], a2: number[], b1: number[], b2: number[]): boolean {
  const d1 = orientacion(b1, b2, a1);
  const d2 = orientacion(b1, b2, a2);
  const d3 = orientacion(a1, a2, b1);
  const d4 = orientacion(a1, a2, b2);

  // Si las orientaciones son diferentes, los segmentos se cruzan
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Casos colineales (puntos en la misma línea)
  if (d1 === 0 && enSegmento(b1, b2, a1)) return true;
  if (d2 === 0 && enSegmento(b1, b2, a2)) return true;
  if (d3 === 0 && enSegmento(a1, a2, b1)) return true;
  if (d4 === 0 && enSegmento(a1, a2, b2)) return true;

  return false;
}

function orientacion(p: number[], q: number[], r: number[]): number {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(val) < 1e-10) return 0;
  return val > 0 ? 1 : -1;
}

function enSegmento(p: number[], q: number[], r: number[]): boolean {
  return (
    r[0] <= Math.max(p[0], q[0]) &&
    r[0] >= Math.min(p[0], q[0]) &&
    r[1] <= Math.max(p[1], q[1]) &&
    r[1] >= Math.min(p[1], q[1])
  );
}

export const parcelasRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/parcelas - Crear nueva parcela
  app.post<{ Body: CrearParcelaBody }>(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['nombre', 'poligono', 'hectareas'],
          properties: {
            nombre: { type: 'string', minLength: 1 },
            poligono: { type: 'object' },
            hectareas: { type: 'number', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.id;
      const { nombre, poligono, hectareas } = request.body;

      // Validar geometría del polígono
      const validacion = validarPoligono(poligono);
      if (!validacion.valido) {
        return reply.code(400).send({
          error: 'Geometría inválida',
          message: validacion.error,
        });
      }

      try {
        const parcela = await prisma.parcela.create({
          data: {
            nombre,
            poligono: validacion.data as any,
            hectareas,
            userId,
          },
        });

        return reply.code(201).send(parcela);
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({
          error: 'Error al crear la parcela',
          message: 'No se pudo guardar la parcela',
        });
      }
    },
  );

  // GET /api/parcelas - Listar parcelas del usuario autenticado
  app.get(
    '/',
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.user.id;
      const parcelas = await prisma.parcela.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return parcelas;
    },
  );
};
