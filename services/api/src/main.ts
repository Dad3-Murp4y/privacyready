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
import { registerDsrRoutes } from './routes/dsr.js';
import { teamRoutes } from './routes/team.js';
import { adminRoutes } from './routes/admin.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerPolicyRoutes } from './routes/policies.js';
import { accountRoutes } from './routes/account.js';
import { safeErrorMetadata } from './safe-logging.js';

import { Redis } from 'ioredis';

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
  // API tasks are reachable only through the ALB. Trust the immediate proxy so
  // rate limiting keys on the real client address rather than the ALB address.
  const app = Fastify({ logger: true, trustProxy: 1 }).withTypeProvider<TypeBoxTypeProvider>();
  
  // Extract token from HttpOnly cookie and place in Authorization header
  app.addHook('onRequest', async (request, reply) => {
    const cookie = request.headers.cookie;
    if (cookie && !request.headers.authorization) {
      const match = cookie.match(/(?:^|;\s*)__Host-token=([^;]+)/);
      if (match) {
        request.headers.authorization = `Bearer ${match[1]}`;
      }
    }
  });
  
  // Register JWT plugin
  await app.register(jwt, { secret: JWT_SECRET });
  
  // Register Rate Limiting plugin
  const redisHost = process.env.REDIS_HOST;
  const rateLimitOpts: any = {
    max: 100,
    timeWindow: '1 minute'
  };
  
  if (redisHost) {
    rateLimitOpts.redis = new (Redis as any)({ host: redisHost, port: 6379 });
  }

  await app.register(rateLimit, rateLimitOpts);

  await registerSecurity(app);
  await registerHealthRoutes(app);
  await registerConsentRoutes(app);
  
  // Register new SaaS auth routes
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(registerScanRoutes);
  await app.register(registerDsrRoutes);
  await app.register(teamRoutes);
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(registerBillingRoutes, { prefix: '/api/billing' });
  await registerPolicyRoutes(app);
  await app.register(accountRoutes);


  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(safeErrorMetadata(error), 'API startup failed');
    process.exit(1);
  }
}

void start();
