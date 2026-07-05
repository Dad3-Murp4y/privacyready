import { FastifyInstance } from 'fastify';

export async function registerConsentRoutes(app: FastifyInstance) {
  app.get('/api/v1/consents', async () => ({
    items: [],
    note: 'Consent persistence is not implemented yet.',
  }));

  app.post('/api/v1/consents', async (_request, reply) => {
    reply.code(202);
    return {
      status: 'accepted',
      note: 'Consent write flow is scaffolded only.',
    };
  });
}
