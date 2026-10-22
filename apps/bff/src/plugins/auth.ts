import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; rol: string };
    user: { id: string; email: string; rol: string };
  }
}

export async function setupAuth(app: FastifyInstance): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET no está configurado. Definilo en el entorno (o en docker-compose.yml) antes de levantar el BFF.',
    );
  }

  await app.register(fastifyJwt, {
    secret,
    sign: {
      expiresIn: '8h',
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized', message: 'Token inválido o expirado' });
    }
  });
}
