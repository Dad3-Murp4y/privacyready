import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });
}
