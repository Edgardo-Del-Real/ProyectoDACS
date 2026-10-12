import Fastify from 'fastify';
import cors from '@fastify/cors';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/health', async () => {
  return { status: 'ok', service: 'bff', version: '0.0.0' };
});

app.get('/api/health', async () => {
  return { status: 'ok', service: 'bff', version: '0.0.0' };
});

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
