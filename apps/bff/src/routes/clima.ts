import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { obtenerPronostico } from '../services/openmeteo.js';

export const climaRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/parcelas/:id/clima - Obtener pronóstico de 7 días
  app.get<{ Params: { id: string } }>(
    '/:id/clima',
    {
      schema: {
        tags: ['Clima'],
        summary: 'Obtener pronóstico hiperlocal de 7 días (US-05)',
        description:
          'Consulta Open-Meteo con TTL de 3 horas en caché para las coordenadas del centroide de la parcela.',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const parcelaId = request.params.id;

      try {
        // Verificar que la parcela pertenece al usuario
        const parcela = await prisma.parcela.findFirst({
          where: { id: parcelaId, userId },
        });

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
        }

        const resultado = await obtenerPronostico(parcelaId);

        if (!resultado) {
          return reply.code(404).send({ error: 'Pronóstico no disponible' });
        }

        return {
          ...resultado,
          parcelaId,
          parcelaNombre: parcela.nombre,
        };
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          error: 'Error al obtener el pronóstico',
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    },
  );
};
