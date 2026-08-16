import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet);
  const portalUrl = process.env.PORTAL_URL || 'https://portal.privacyready.co.uk';
  const marketingUrl = process.env.MARKETING_URL || 'https://www.privacyready.co.uk';
  const allowed = new Set([portalUrl, marketingUrl]);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3001');
    allowed.add('http://localhost:5173');
  }
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      try {
        if (allowed.has(origin)) {
          cb(null, true);
        } else {
          // Do not throw here: @fastify/cors converts callback errors into a
          // 500 response before the origin/CSRF hook can issue its fail-closed
          // 403 response for unsafe requests.
          cb(null, false);
        }
      } catch (_) {
        cb(null, false);
      }
    },
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.url.startsWith('/api/billing/webhook')) return;
    const origin = request.headers.origin;
    if (origin && !allowed.has(origin)) {
      return reply.code(403).send({ error: 'Invalid request origin' });
    }
  });
}
