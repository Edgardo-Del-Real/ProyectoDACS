import type { FastifyPluginAsync } from 'fastify';
import {
  obtenerCotizacionesMercado,
  obtenerTendenciaMercado,
  CULTIVOS_MERCADO_VALIDOS,
} from '../services/mercado.js';

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

export const mercadoRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/mercado/cotizaciones - Cotizaciones vigentes por vencimiento
  app.get<{
    Querystring: { cultivo?: string };
  }>(
    '/cotizaciones',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Consultar cotizaciones de futuros vigentes por vencimiento (US-07)',
        description: 'Obtiene las cotizaciones de futuros de Matba Rofex para el cultivo seleccionado.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            cultivo: { type: 'string', default: 'Soja' },
          },
        },
        response: { 400: errorSchema, 401: errorSchema, 500: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const cultivo = request.query.cultivo || 'Soja';
      try {
        const data = await obtenerCotizacionesMercado(cultivo);
        return data;
      } catch (err) {
        request.log.error({ err }, 'Error al consultar cotizaciones de mercado');
        const msg = err instanceof Error ? err.message : 'Error al obtener cotizaciones';
        return reply.code(400).send({ error: msg });
      }
    },
  );

  // GET /api/mercado/historico - Serie histórica para gráfico de tendencia (Criterio 3)
  app.get<{
    Querystring: { cultivo?: string; posicion?: string; dias?: number };
  }>(
    '/historico',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Consultar serie histórica de precios para gráfico de tendencias (US-07)',
        description: 'Devuelve los puntos históricos diarios para el cultivo y posición especificados.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            cultivo: { type: 'string', default: 'Soja' },
            posicion: { type: 'string', default: 'DISPONIBLE' },
            dias: { type: 'integer', default: 30, minimum: 5, maximum: 365 },
          },
        },
        response: { 400: errorSchema, 401: errorSchema, 500: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { cultivo = 'Soja', posicion = 'DISPONIBLE', dias = 30 } = request.query;
      try {
        const data = await obtenerTendenciaMercado(cultivo, posicion, Number(dias));
        return data;
      } catch (err) {
        request.log.error({ err }, 'Error al consultar histórico de mercado');
        const msg = err instanceof Error ? err.message : 'Error al obtener histórico';
        return reply.code(400).send({ error: msg });
      }
    },
  );

  // GET /api/mercado/cultivos - Listar cultivos disponibles
  app.get(
    '/cultivos',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Listar cultivos disponibles para cotización de mercado',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async () => {
      return { cultivos: [...CULTIVOS_MERCADO_VALIDOS] };
    },
  );
};
