import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { obtenerCatalogoRotacion, obtenerPlanRotacion } from '../services/rotacion.js';

const HORIZONTE_MIN = 1;
const HORIZONTE_MAX = 6;
const HORIZONTE_DEFECTO = 4;

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

export const rotacionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/catalogo-rotacion',
    {
      schema: {
        tags: ['Rotacion'],
        summary: 'Consultar catálogo semilla de cultivos y reglas de rotación del INTA (US-09)',
        security: [{ bearerAuth: [] }],
        response: { 401: errorSchema, 500: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const catalogo = await obtenerCatalogoRotacion();
        return { catalogo };
      } catch (error) {
        request.log.error({ err: error }, 'Error al obtener el catálogo de rotación');
        return reply.code(500).send({ error: 'Error al obtener el catálogo de rotación' });
      }
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { anios?: number; excluir?: string };
  }>(
    '/:id/rotacion',
    {
      schema: {
        tags: ['Rotacion'],
        summary: 'Obtener plan de rotación plurianual sugerido para una parcela (US-09)',
        description:
          'Genera una secuencia plurianual de cultivos alternando familias botánicas según los años de espera del catálogo semilla del INTA. Solo el propietario de la parcela puede consultarla.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        querystring: {
          type: 'object',
          properties: {
            anios: {
              type: 'integer',
              minimum: HORIZONTE_MIN,
              maximum: HORIZONTE_MAX,
              default: HORIZONTE_DEFECTO,
            },
            excluir: {
              type: 'string',
              description: 'Lista de cultivos separados por coma que el productor no siembra en el lote',
            },
          },
        },
        response: {
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const parcelaId = request.params.id;
      const horizonteAnios = request.query.anios ?? HORIZONTE_DEFECTO;
      const cultivosExcluidos = request.query.excluir
        ? request.query.excluir
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // AJV puede coercionar "Infinity" sin rechazarlo con su configuración no estricta.
      if (
        !Number.isInteger(horizonteAnios) ||
        horizonteAnios < HORIZONTE_MIN ||
        horizonteAnios > HORIZONTE_MAX
      ) {
        return reply
          .code(400)
          .send({ error: `anios debe ser un entero entre ${HORIZONTE_MIN} y ${HORIZONTE_MAX}` });
      }

      try {
        // Se busca solo por id para poder distinguir "no existe" (404) de "es de otro usuario" (403).
        const parcela = await prisma.parcela.findUnique({ where: { id: parcelaId } });

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
        }

        if (parcela.userId !== userId) {
          return reply.code(403).send({ error: 'No tenés permiso para acceder a esta parcela' });
        }

        const plan = await obtenerPlanRotacion(parcelaId, horizonteAnios, cultivosExcluidos);

        return {
          parcelaId,
          parcelaNombre: parcela.nombre,
          ...plan,
        };
      } catch (error) {
        request.log.error({ err: error, parcelaId }, 'Error al obtener el plan de rotación');
        return reply.code(500).send({ error: 'Error al obtener el plan de rotación' });
      }
    },
  );
};
