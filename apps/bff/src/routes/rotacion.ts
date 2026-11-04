import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import {
  HORIZONTE_MAXIMO,
  HORIZONTE_MINIMO,
  HORIZONTE_POR_DEFECTO,
  obtenerCatalogoRotacion,
  obtenerPlanRotacion,
} from '../services/rotacion.js';

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
              minimum: HORIZONTE_MINIMO,
              maximum: HORIZONTE_MAXIMO,
              default: HORIZONTE_POR_DEFECTO,
            },
            excluir: {
              type: 'string',
              maxLength: 500,
              description: 'Lista de cultivos separados por coma que el productor no siembra en el lote',
            },
          },
        },
        response: {
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const parcelaId = request.params.id;
      const horizonteAnios = request.query.anios ?? HORIZONTE_POR_DEFECTO;
      const cultivosExcluidos = request.query.excluir
        ? request.query.excluir
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // AJV puede coercionar "Infinity" sin rechazarlo con su configuración no estricta.
      if (
        !Number.isInteger(horizonteAnios) ||
        horizonteAnios < HORIZONTE_MINIMO ||
        horizonteAnios > HORIZONTE_MAXIMO
      ) {
        return reply.code(400).send({
          error: `anios debe ser un entero entre ${HORIZONTE_MINIMO} y ${HORIZONTE_MAXIMO}`,
        });
      }

      try {
        // Se filtra por dueño en la misma consulta: si la parcela existe pero es
        // de otro usuario se responde 404, igual que el resto del BFF. Un 403
        // confirmaría que el ID existe y habilitaría enumeración.
        const parcela = await prisma.parcela.findFirst({
          where: { id: parcelaId, userId },
        });

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
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
