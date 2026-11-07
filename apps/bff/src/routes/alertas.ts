import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import {
  alertaEmailService,
  listarAlertasDeUsuario,
  marcarAlertaLeida,
  reenviarEmailAlerta,
  verificarAlertasDeUsuario,
} from '../services/alertas/alertas.js';

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

export const alertasRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/alertas - Listar alertas registradas del productor (US-06 Criterio 4)
  app.get<{
    Querystring: { parcelaId?: string; soloNoLeidas?: string };
  }>(
    '/',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Listar alertas de helada y estrés hídrico del productor (US-06)',
        description:
          'Devuelve las alertas climáticas registradas para las parcelas del usuario autenticado, junto con el resumen de conteos y los umbrales activos.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            parcelaId: {
              type: 'string',
              description: 'Filtrar alertas de una parcela específica',
            },
            soloNoLeidas: {
              type: 'string',
              enum: ['true', 'false'],
              description: 'Si es "true", devuelve únicamente alertas no leídas',
            },
          },
        },
        response: {
          401: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const parcelaId = request.query.parcelaId?.trim() || undefined;
      const soloNoLeidas = request.query.soloNoLeidas === 'true';

      try {
        const resultado = await listarAlertasDeUsuario(userId, {
          parcelaId,
          soloNoLeidas,
        });
        return resultado;
      } catch (error) {
        request.log.error({ err: error }, 'Error al listar alertas del usuario');
        return reply.code(500).send({ error: 'Error al obtener las alertas registradas' });
      }
    },
  );

  // POST /api/alertas/verificar - Ejecutar verificación inmediata con dedupe y envío de email
  app.post<{
    Body?: { parcelaId?: string };
  }>(
    '/verificar',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Ejecutar verificación de alertas de helada y sequía con deduplicación (US-06)',
        description:
          'Evalúa el pronóstico de 7 días de las parcelas del usuario (helada ≤ 0 °C en 72 h y precipitación acumulada bajo umbral), envía emails para eventos nuevos e ignora eventos ya alertados.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          nullable: true,
          properties: {
            parcelaId: {
              type: 'string',
              description: 'Opcional: evaluar únicamente esta parcela',
            },
          },
        },
        response: {
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const parcelaId = request.body?.parcelaId?.trim() || undefined;

      try {
        if (parcelaId) {
          const parcela = await prisma.parcela.findFirst({
            where: { id: parcelaId, userId },
            select: { id: true },
          });
          if (!parcela) {
            return reply.code(404).send({ error: 'Parcela no encontrada' });
          }
        }

        const verificacion = await verificarAlertasDeUsuario(userId, parcelaId);
        const listadoActualizado = await listarAlertasDeUsuario(userId, {
          parcelaId,
        });

        return {
          ...verificacion,
          ...listadoActualizado,
        };
      } catch (error) {
        request.log.error({ err: error }, 'Error al ejecutar verificación de alertas');
        return reply.code(500).send({ error: 'Error al verificar las alertas climáticas' });
      }
    },
  );

  // PATCH /api/alertas/:id/leida - Marcar alerta como leída / revisada en el panel
  app.patch<{
    Params: { id: string };
    Body?: { leida?: boolean };
  }>(
    '/:id/leida',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Marcar una alerta como leída o no leída en el panel (US-06)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        body: {
          type: 'object',
          nullable: true,
          properties: {
            leida: { type: 'boolean' },
          },
        },
        response: {
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const alertaId = request.params.id;
      const leida = request.body?.leida ?? true;

      try {
        const actualizada = await marcarAlertaLeida(userId, alertaId, leida);
        if (!actualizada) {
          return reply.code(404).send({ error: 'Alerta no encontrada' });
        }
        return actualizada;
      } catch (error) {
        request.log.error({ err: error, alertaId }, 'Error al actualizar estado de alerta');
        return reply.code(500).send({ error: 'Error al actualizar la alerta' });
      }
    },
  );

  // POST /api/alertas/test-email - Enviar correo de prueba para validar configuración SMTP (Nodemailer)
  app.post(
    '/test-email',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Enviar correo de prueba mediante Nodemailer al usuario autenticado (US-06)',
        description:
          'Verifica la conexión con el servidor SMTP configurado y despacha un correo de comprobación.',
        security: [{ bearerAuth: [] }],
        response: {
          401: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;

      try {
        const usuario = await prisma.usuario.findUnique({
          where: { id: userId },
          select: { email: true, nombre: true },
        });

        if (!usuario) {
          return reply.code(404).send({ error: 'Usuario no encontrado' });
        }

        const payload = await alertaEmailService.enviarTestEmail(usuario.email, usuario.nombre);
        return {
          ok: true,
          mensaje: `Correo de prueba enviado con éxito a ${usuario.email}`,
          destinatario: payload.to,
        };
      } catch (error) {
        request.log.error({ err: error }, 'Error al enviar correo de prueba vía Nodemailer');
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Error al enviar correo de prueba',
        });
      }
    },
  );

  // POST /api/alertas/:id/reenviar-email - Reenviar correo de una alerta específica
  app.post<{
    Params: { id: string };
  }>(
    '/:id/reenviar-email',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Reenviar notificación por correo de una alerta registrada (US-06)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        response: {
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const alertaId = request.params.id;

      try {
        const resultado = await reenviarEmailAlerta(userId, alertaId);
        return resultado;
      } catch (error) {
        request.log.error({ err: error, alertaId }, 'Error al reenviar correo de alerta');
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Error al reenviar el correo',
        });
      }
    },
  );
};

