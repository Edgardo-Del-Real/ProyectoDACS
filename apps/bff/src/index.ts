import Fastify from 'fastify';
import cors from '@fastify/cors';
import { setupSwagger } from './plugins/swagger.js';
import { setupAuth } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { parcelasRoutes } from './routes/parcelas.js';
import { climaRoutes } from './routes/clima.js';
import { healthRoutes } from './routes/health.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

// RNF-12: Configuración de CORS restringido
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

await app.register(cors, {
  origin: (origin, cb) => {
    // Permitir requests sin header Origin (curl, server-to-server, healthchecks)
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      cb(null, true);
      return;
    }
    // En desarrollo, permitir orígenes locales dinámicos
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error(`CORS bloqueado para el origen: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
});

// RNF-06: Documentación interactiva OpenAPI 3.0 / Swagger UI
await setupSwagger(app);

// Setup de JWT y autenticación
await setupAuth(app);

// RNF-16: Rutas de salud y disponibilidad (/health y /ready)
await app.register(healthRoutes);

// Rutas de autenticación
await app.register(authRoutes, { prefix: '/api/auth' });

// Rutas de parcelas
await app.register(parcelasRoutes, { prefix: '/api/parcelas' });

// Rutas de clima
await app.register(climaRoutes, { prefix: '/api/parcelas' });

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
