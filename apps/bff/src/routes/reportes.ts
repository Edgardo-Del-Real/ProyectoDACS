import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { buscarParcelaConAcceso } from '../services/acceso-parcela.js';
import {
  InformePdfService,
  recopilarDatosInforme,
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
          'Genera y descarga un documento PDF con los datos agronómicos, rotación plurianual, clima y cotizaciones de la parcela. Anti-enumeración: responde 404 si la parcela no existe o el usuario no tiene acceso autorizado.',
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
      const parcelaId = request.params.id;
      const usuario = {
        id: request.user.id,
        email: request.user.email,
        nombre: (request.user as { nombre?: string }).nombre,
        rol: request.user.rol,
      };

      try {
        // Criterio 3 (Anti-enumeración): Solo dueño o técnico con acceso otorgado por el productor
        const parcela = await buscarParcelaConAcceso(parcelaId, usuario.id, usuario.rol);

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
        }

        // Criterios 1 y 2: Generar PDF con planificación y proyecciones
        const pdfBuffer = await InformePdfService.generarPdf(usuario, parcelaId);

        const nombreLimpio = parcela.nombre
          ? parcela.nombre
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
          error: 'Error interno al generar el informe técnico en PDF',
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
          'Devuelve la información estructurada que nutre el informe PDF. Anti-enumeración: responde 404 si la parcela no existe o no tiene acceso.',
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
      const parcelaId = request.params.id;
      const usuario = {
        id: request.user.id,
        email: request.user.email,
        nombre: (request.user as { nombre?: string }).nombre,
        rol: request.user.rol,
      };

      try {
        const parcela = await buscarParcelaConAcceso(parcelaId, usuario.id, usuario.rol);

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
        }

        const datos = await recopilarDatosInforme(usuario, parcelaId);
        return datos;
      } catch (error) {
        request.log.error({ err: error, parcelaId }, 'Error al consultar datos del informe');
        return reply.code(500).send({
          error: 'Error interno al consultar los datos del informe',
        });
      }
    },
  );

  // ==========================================================================
  // FLUJO DE VINCULACIÓN CON CONSENTIMIENTO (Opción A): El productor otorga acceso
  // ==========================================================================

  // POST /api/productor/tecnicos - El productor otorga acceso a un técnico extensionista
  app.post<{
    Body: { email: string };
  }>(
    '/productor/tecnicos',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Otorgar acceso de asesor técnico a un extensionista (US-11 / Opción A)',
        description:
          'Permite que el productor autorice a un técnico a consultar sus parcelas y generar informes agronómicos.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
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
      const productorId = request.user.id;
      const { email } = request.body || {};

      if (!email || typeof email !== 'string') {
        return reply.code(400).send({
          error: 'Debe ingresar el email del técnico extensionista a vincular',
        });
      }

      // Respuesta uniforme anti-enumeración: tanto si el email no existe como si no es TECNICO
      const tecnico = await prisma.usuario.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          rol: 'TECNICO',
        },
        select: { id: true, nombre: true, email: true, rol: true },
      });

      if (!tecnico) {
        return reply.code(404).send({
          error: 'No se encontró un técnico extensionista registrado con ese correo electrónico',
        });
      }

      if (tecnico.id === productorId) {
        return reply.code(400).send({
          error: 'No podés asignarte a vos mismo como asesor técnico',
        });
      }

      const existente = await prisma.asociacionProductor.findUnique({
        where: {
          tecnicoId_productorId: {
            tecnicoId: tecnico.id,
            productorId,
          },
        },
      });

      if (existente) {
        return reply.code(200).send({
          mensaje: 'El técnico ya tiene acceso autorizado a tus parcelas',
          asociacionId: existente.id,
          tecnico: {
            id: tecnico.id,
            nombre: tecnico.nombre,
            email: tecnico.email,
          },
        });
      }

      const nueva = await prisma.asociacionProductor.create({
        data: {
          tecnicoId: tecnico.id,
          productorId,
        },
      });

      return reply.code(201).send({
        mensaje: 'Técnico extensionista vinculado con éxito',
        asociacionId: nueva.id,
        tecnico: {
          id: tecnico.id,
          nombre: tecnico.nombre,
          email: tecnico.email,
        },
      });
    },
  );

  // GET /api/productor/tecnicos - Listar técnicos autorizados por el productor
  app.get(
    '/productor/tecnicos',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Listar técnicos extensionistas autorizados por el productor (US-11)',
        security: [{ bearerAuth: [] }],
        response: {
          401: errorSchema,
          500: errorSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request) => {
      const productorId = request.user.id;

      const asociaciones = await prisma.asociacionProductor.findMany({
        where: { productorId },
        include: {
          tecnico: {
            select: {
              id: true,
              nombre: true,
              email: true,
              rol: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return asociaciones.map((a) => ({
        asociacionId: a.id,
        fechaAsociacion: a.createdAt.toISOString(),
        tecnico: a.tecnico,
      }));
    },
  );

  // DELETE /api/productor/tecnicos/:tecnicoId - Revocar acceso a un técnico
  app.delete<{ Params: { tecnicoId: string } }>(
    '/productor/tecnicos/:tecnicoId',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Revocar acceso de asesor técnico otorgado previamente a un extensionista',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['tecnicoId'],
          properties: { tecnicoId: { type: 'string' } },
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
      const productorId = request.user.id;
      const { tecnicoId } = request.params;

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

      return { ok: true, mensaje: 'Acceso técnico revocado con éxito' };
    },
  );

  // ==========================================================================
  // ENDPOINTS DE CONSULTA PARA TÉCNICOS EXTENSIONISTAS
  // ==========================================================================

  // GET /api/tecnico/productores - Listar productores que han autorizado al técnico
  app.get(
    '/tecnico/productores',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Listar productores que han otorgado acceso a la cuenta técnica (US-11)',
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

  // DELETE /api/tecnico/productores/:productorId - Técnico se desvincula de asesorar a un productor
  app.delete<{ Params: { productorId: string } }>(
    '/tecnico/productores/:productorId',
    {
      schema: {
        tags: ['Reportes'],
        summary: 'Desvincularse de asesorar a un productor',
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
