import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './db.js';
import { setupAuth } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { parcelasRoutes } from './routes/parcelas.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Setup de JWT y autenticación
await setupAuth(app);

// Rutas de autenticación
await app.register(authRoutes, { prefix: '/api/auth' });

// Rutas de parcelas
await app.register(parcelasRoutes, { prefix: '/api/parcelas' });

app.get('/health', async () => {
  return { status: 'ok', service: 'bff', version: '0.0.0' };
});

app.get('/api/health', async () => {
  return { status: 'ok', service: 'bff', version: '0.0.0' };
});

app.get('/ready', async (req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', db: 'up' };
  } catch (err) {
    req.log.warn({ err }, 'db not ready');
    reply.code(503);
    return { status: 'degraded', db: 'down' };
  }
});

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
