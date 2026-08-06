import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const allowed = [
        'https://portal.privacyready.co.uk',
        'https://www.privacyready.co.uk',
        'http://localhost:3001',
        'http://localhost:5173',
        // CloudFront domains — needed while DNS nameservers are still propagating
        'https://d2kdrhnufwgxlm.cloudfront.net',
        'https://d31hapjj2foyik.cloudfront.net',
      ];
      try {
        const hostname = new URL(origin).hostname;
        if (allowed.includes(origin) || hostname === 'privacyready.co.uk' || hostname.endsWith('.privacyready.co.uk')) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'), false);
        }
      } catch (_) {
        cb(new Error('Invalid Origin'), false);
      }
    },
    credentials: true,
  });
}
