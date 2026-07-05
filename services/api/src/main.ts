import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { registerSecurity } from './plugins/security.js';
import { registerConsentRoutes } from './routes/consent.js';
import { registerHealthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_for_local_dev_only_1234';

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
  await app.register(authRoutes);

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
