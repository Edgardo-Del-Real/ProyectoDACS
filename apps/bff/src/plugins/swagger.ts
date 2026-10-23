import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function setupSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'ProyectoDACS — API BFF',
        description:
          'Backend For Frontend (BFF) para la plataforma de pequeños productores agropecuarios argentinos. Documentación OpenAPI 3.0 (RNF-06).',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Entorno de Desarrollo Local',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Ingresá el token JWT obtenido en POST /api/auth/login',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Registro, inicio de sesión y perfil de usuario' },
        { name: 'Parcelas', description: 'Delimitación satelital y gestión de lotes' },
        { name: 'Clima', description: 'Pronósticos hiperlocales y alertas climáticas' },
        { name: 'Campanias', description: 'Historial de cultivos y rotaciones' },
        { name: 'Sistema', description: 'Monitoreo de salud y disponibilidad (RNF-16)' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
}
