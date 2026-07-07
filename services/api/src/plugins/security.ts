import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, cb) => {
      console.log("CORS REQUEST ORIGIN:", origin);
      if (!origin) {
        cb(null, true);
        return;
      }
      const allowed = [
        'https://portal.datawai.co.uk',
        'https://www.datawai.co.uk',
        'http://localhost:3001',
        'http://localhost:5173'
      ];
      try {
        const hostname = new URL(origin).hostname;
        if (allowed.includes(origin) || hostname === 'datawai.co.uk' || hostname.endsWith('.datawai.co.uk')) {
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
