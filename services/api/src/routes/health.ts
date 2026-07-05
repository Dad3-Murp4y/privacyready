import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    version: process.env.APP_VERSION ?? '2.1.0',
    timestamp: new Date().toISOString(),
  }));
}
