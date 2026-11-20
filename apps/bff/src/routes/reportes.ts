import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import {
  InformePdfService,
  recopilarDatosInforme,
  verificarPermisoInforme,
} from '../services/reportes/informe-pdf.js';

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

export const reportesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/parcelas/:id/informe-pdf - Descargar informe técnico en PDF (US-11)
  app.get<{ Params: { id: string } }>(
    '/parcelas/:id/informe-pdf',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Descargar informe técnico agronómico en PDF con planificación y proyecciones (US-11)',
        description:
          'Genera y descarga un documento PDF que incluye la parcela, el cultivo sugerido para la próxima campaña, la secuencia de rotación plurianual, el clima hiperlocal y los precios/márgenes económicos considerados. Responde 403 si la parcela no pertenece al usuario ni a un productor asociado a su cuenta técnica (CA 3).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        response: {
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parcelaId = request.params.id;
      const usuario = {
        id: request.user.id,
        email: request.user.email,
        nombre: (request.user as { nombre?: string }).nombre,
        rol: request.user.rol,
      };

      try {
        // Criterio 3: Verificar permisos (dueño o técnico con productor asociado)
        const permiso = await verificarPermisoInforme(usuario, parcelaId);

        if (!permiso.permitida) {
          if (permiso.motivo === 'NOT_FOUND') {
            return reply.code(404).send({ error: permiso.error });
          }
          // 403 estricto según especificación US-11 CA 3
          return reply.code(403).send({ error: permiso.error });
        }

        // Criterios 1 y 2: Generar PDF con planificación y proyecciones
        const pdfBuffer = await InformePdfService.generarPdf(usuario, parcelaId);

        const nombreLimpio = permiso.parcela.nombre
          ? permiso.parcela.nombre
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/_+/g, '_')
          : 'parcela';

        const filename = `informe-${nombreLimpio}-${parcelaId.substring(0, 6)}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .header('Content-Length', pdfBuffer.length)
          .send(pdfBuffer);
      } catch (error) {
        request.log.error({ err: error, parcelaId }, 'Error al generar informe PDF de la parcela');
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Error al generar el informe en PDF',
        });
      }
    },
  );

  // GET /api/parcelas/:id/informe - Consultar datos estructurados del informe en JSON (US-11)
  app.get<{ Params: { id: string } }>(
    '/parcelas/:id/informe',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Obtener datos consolidados del informe agronómico en JSON (US-11)',
        description:
          'Devuelve la información estructurada que nutre el informe PDF (parcela, recomendación, rotación, clima, cotizaciones y proyección económica).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        response: {
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parcelaId = request.params.id;
      const usuario = {
        id: request.user.id,
        email: request.user.email,
        nombre: (request.user as { nombre?: string }).nombre,
        rol: request.user.rol,
      };

      try {
        const permiso = await verificarPermisoInforme(usuario, parcelaId);

        if (!permiso.permitida) {
          if (permiso.motivo === 'NOT_FOUND') {
            return reply.code(404).send({ error: permiso.error });
          }
          return reply.code(403).send({ error: permiso.error });
        }

        const datos = await recopilarDatosInforme(usuario, parcelaId);
        return datos;
      } catch (error) {
        request.log.error({ err: error, parcelaId }, 'Error al obtener datos del informe');
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Error al consultar los datos del informe',
        });
      }
    },
  );

  // GET /api/tecnico/productores - Listar productores asociados a la cuenta técnica
  app.get(
    '/tecnico/productores',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Listar productores asociados a la cuenta técnica (US-11)',
        security: [{ bearerAuth: [] }],
        response: {
          401: errorSchema,
          403: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      if (request.user.rol !== 'TECNICO') {
        return reply.code(403).send({
          error: 'Acceso denegado: solo los técnicos extensionistas pueden consultar productores asesorados',
        });
      }

      const tecnicoId = request.user.id;

      const asociaciones = await prisma.asociacionProductor.findMany({
        where: { tecnicoId },
        include: {
          productor: {
            select: {
              id: true,
              nombre: true,
              email: true,
              rol: true,
              parcelas: {
                select: {
                  id: true,
                  nombre: true,
                  hectareas: true,
                  createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return asociaciones.map((a) => ({
        asociacionId: a.id,
        fechaAsociacion: a.createdAt.toISOString(),
        productor: a.productor,
      }));
    },
  );

  // POST /api/tecnico/productores - Asociar un productor a la cuenta técnica por email o ID
  app.post<{
    Body: { email?: string; productorId?: string };
  }>(
    '/tecnico/productores',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Vincular un productor a la cuenta técnica para habilitar informes de asesoramiento (US-11)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            productorId: { type: 'string' },
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
      if (request.user.rol !== 'TECNICO') {
        return reply.code(403).send({
          error: 'Acceso denegado: solo los técnicos extensionistas pueden vincular productores asesorados',
        });
      }

      const tecnicoId = request.user.id;
      const { email, productorId } = request.body || {};

      if (!email && !productorId) {
        return reply.code(400).send({
          error: 'Debe ingresar el email o el id del productor a vincular',
        });
      }

      const productor = await prisma.usuario.findFirst({
        where: email
          ? { email: email.toLowerCase().trim() }
          : { id: productorId },
        select: { id: true, nombre: true, email: true, rol: true },
      });

      if (!productor) {
        return reply.code(404).send({ error: 'Productor no encontrado' });
      }

      if (productor.id === tecnicoId) {
        return reply.code(400).send({
          error: 'No podés asociarte a vos mismo como productor asesorado',
        });
      }

      if (productor.rol !== 'AGRICULTOR') {
        return reply.code(400).send({
          error: 'Solo se pueden vincular cuentas de usuarios con rol agricultor/productor',
        });
      }

      const existente = await prisma.asociacionProductor.findUnique({
        where: {
          tecnicoId_productorId: {
            tecnicoId,
            productorId: productor.id,
          },
        },
      });

      if (existente) {
        return reply.code(200).send({
          mensaje: 'El productor ya se encuentra asociado a tu cuenta técnica',
          asociacionId: existente.id,
          productor: {
            id: productor.id,
            nombre: productor.nombre,
            email: productor.email,
          },
        });
      }

      const nueva = await prisma.asociacionProductor.create({
        data: {
          tecnicoId,
          productorId: productor.id,
        },
      });

      return reply.code(201).send({
        mensaje: 'Productor asociado con éxito',
        asociacionId: nueva.id,
        productor: {
          id: productor.id,
          nombre: productor.nombre,
          email: productor.email,
        },
      });
    },
  );

  // DELETE /api/tecnico/productores/:productorId - Desvincular productor
  app.delete<{ Params: { productorId: string } }>(
    '/tecnico/productores/:productorId',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Desvincular un productor de la cuenta técnica',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productorId'],
          properties: { productorId: { type: 'string' } },
        },
        response: {
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      if (request.user.rol !== 'TECNICO') {
        return reply.code(403).send({
          error: 'Acceso denegado: solo los técnicos extensionistas pueden gestionar asociaciones de productores',
        });
      }

      const tecnicoId = request.user.id;
      const { productorId } = request.params;

      const asociacion = await prisma.asociacionProductor.findUnique({
        where: {
          tecnicoId_productorId: {
            tecnicoId,
            productorId,
          },
        },
      });

      if (!asociacion) {
        return reply.code(404).send({ error: 'Asociación no encontrada' });
      }

      await prisma.asociacionProductor.delete({
        where: { id: asociacion.id },
      });

      return { ok: true, mensaje: 'Productor desvinculado con éxito' };
    },
  );
};
