import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { registerSecurity } from './plugins/security.js';
import { registerConsentRoutes } from './routes/consent.js';
import { registerHealthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { registerScanRoutes } from './routes/scan.js';
import { adminRoutes } from './routes/admin.js';

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required and must not be empty. ' +
    'Refusing to start with a hardcoded fallback secret.'
  );
}
const JWT_SECRET = process.env.JWT_SECRET;

async function buildServer() {
  const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
  
  // Register JWT plugin
  await app.register(jwt, { secret: JWT_SECRET });
  
  // Register Rate Limiting plugin
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  await registerSecurity(app);
  await registerHealthRoutes(app);
  await registerConsentRoutes(app);
  
  // Register new SaaS auth routes
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(registerScanRoutes);
  await app.register(adminRoutes, { prefix: '/api' });

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
