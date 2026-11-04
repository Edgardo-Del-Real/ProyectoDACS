import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  obtenerCotizacionesMercado,
  obtenerTendenciaMercado,
} from '../services/mercado.js';
import {
  BolsaCerealesError,
  BolsaCerealesFormatoError,
} from '../services/bolsaCereales.js';

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

/**
 * Traduce el error a un status coherente:
 * 400 el cliente pidió algo que no existe, 502 el proveedor falló, 500 lo demás.
 */
function responderError(reply: FastifyReply, error: unknown) {
  if (error instanceof MercadoClientError) {
    return reply.code(400).send({ error: error.message });
  }
  if (error instanceof BolsaCerealesFormatoError) {
    return reply.code(502).send({ error: error.message });
  }
  if (error instanceof BolsaCerealesError) {
    return reply.code(502).send({ error: error.message });
  }
  return reply.code(500).send({ error: 'Error al consultar el mercado' });
}

export const mercadoRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/mercado/cotizaciones - Spot y curva de vencimientos
  app.get<{
    Querystring: { cultivo?: string };
  }>(
    '/cotizaciones',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Consultar cotizaciones FOB oficiales por vencimiento (US-07)',
        description:
          'Devuelve el spot y la curva de futuros publicados por la Bolsa de Cereales de Buenos Aires (Precios FOB según Ley 21.453).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            cultivo: { type: 'string', default: 'Soja', maxLength: 40 },
          },
        },
        response: { 400: errorSchema, 401: errorSchema, 502: errorSchema, 500: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        return await obtenerCotizacionesMercado(request.query.cultivo ?? 'Soja');
      } catch (error) {
        request.log.error({ err: error }, 'Error al consultar cotizaciones de mercado');
        return responderError(reply, error);
      }
    },
  );

  // GET /api/mercado/historico - Serie histórica para el gráfico de tendencia
  app.get<{
    Querystring: { cultivo?: string; posicion?: string; dias?: number };
  }>(
    '/historico',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Consultar serie histórica de precios para el gráfico de tendencias (US-07)',
        description:
          'Devuelve los snapshots diarios guardados para el cultivo y la posición indicados. Sin datos suficientes devuelve la serie vacía.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            cultivo: { type: 'string', default: 'Soja', maxLength: 40 },
            posicion: { type: 'string', default: 'DISPONIBLE', maxLength: 20 },
            dias: { type: 'integer', default: 30, minimum: 1, maximum: 365 },
          },
        },
        response: { 400: errorSchema, 401: errorSchema, 500: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { cultivo = 'Soja', posicion = 'DISPONIBLE', dias = 30 } = request.query;
      try {
        return await obtenerTendenciaMercado(cultivo, posicion, Number(dias));
      } catch (error) {
        request.log.error({ err: error }, 'Error al consultar histórico de mercado');
        return responderError(reply, error);
      }
    },
  );

  // GET /api/mercado/cultivos - Lista de cultivos soportados (única fuente: mercadoCatalogo)
  app.get(
    '/cultivos',
    {
      schema: {
        tags: ['Mercado'],
        summary: 'Listar cultivos disponibles para cotización de mercado',
        security: [{ bearerAuth: [] }],
        response: { 401: errorSchema },
      },
      preHandler: [app.authenticate],
    },
    async () => {
      return { cultivos: [...CULTIVOS_MERCADO_VALIDOS] };
    },
  );
};
