import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireActiveSubscription } from '../entitlement.js';

type ConsentPrisma = Pick<typeof prisma, 'user' | 'organization'>;

export async function registerConsentRoutes(app: FastifyInstance, dependencies: { prismaClient?: ConsentPrisma } = {}) {
  const prismaClient = dependencies.prismaClient ?? prisma;
  const premium = (request: any, reply: any) => requireActiveSubscription(request, reply, prismaClient);
  app.get('/api/v1/consents', { preHandler: premium }, async () => ({ items: [], note: 'Consent persistence is not implemented yet.' }));
  app.post('/api/v1/consents', { preHandler: premium }, async (_request, reply) => reply.code(501).send({ error: 'Consent persistence is not implemented yet.' }));
}
