import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness check (RNF-16)
  const healthSchema = {
    schema: {
      tags: ['Sistema'],
      summary: 'Liveness probe — Verificación de salud del proceso',
      description: 'Devuelve 200 si el servidor HTTP de Fastify está en ejecución.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            service: { type: 'string', example: 'bff' },
            uptime: { type: 'number', example: 124.5 },
            timestamp: { type: 'string', example: '2026-10-23T19:00:00.000Z' },
          },
        },
      },
    },
  };

  app.get('/health', healthSchema, async () => {
    return {
      status: 'ok',
      service: 'bff',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/health', healthSchema, async () => {
    return {
      status: 'ok',
      service: 'bff',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness check (RNF-16) — verifica conexión a PostgreSQL vía Prisma
  const readySchema = {
    schema: {
      tags: ['Sistema'],
      summary: 'Readiness probe — Verificación de base de datos',
      description: 'Valida la conectividad con la base de datos relacional PostgreSQL.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ready' },
            db: { type: 'string', example: 'up' },
            timestamp: { type: 'string', example: '2026-10-23T19:00:00.000Z' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'degraded' },
            db: { type: 'string', example: 'down' },
            error: { type: 'string', example: 'database_unavailable' },
          },
        },
      },
    },
  };

  const checkDb = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        db: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      req.log.warn({ err }, 'db not ready');
      return reply.code(503).send({
        status: 'degraded',
        db: 'down',
        error: 'database_unavailable',
      });
    }
  };

  app.get('/ready', readySchema, async (req, reply) => {
    return checkDb(req, reply);
  });

  app.get('/api/ready', readySchema, async (req, reply) => {
    return checkDb(req, reply);
  });
};
