import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { RETENTION_POLICY } from '../retention.js';

type AccountPrisma = Pick<typeof prisma, 'user' | 'organization'>;

export const accountRoutes: FastifyPluginAsync<{ prismaClient?: AccountPrisma }> = async (app, options) => {
  const prismaClient = options.prismaClient ?? prisma;

  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      const tokenUser = request.user as { sub: string };
      const realUser = await prismaClient.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorised' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId };
    } catch {
      return reply.code(401).send({ error: 'Unauthorised' });
    }
  });

  app.get('/api/account/deletion', async (request, reply) => {
    const user = request.user as { org: string };
    const organization = await prismaClient.organization.findUnique({
      where: { id: user.org },
      select: { deletionRequestedAt: true, subscriptionStatus: true },
    });
    if (!organization) return reply.code(404).send({ error: 'Organisation not found' });
    return {
      deletionRequestedAt: organization.deletionRequestedAt,
      recoveryDays: RETENTION_POLICY.organizationRecoveryDays,
      subscriptionStatus: organization.subscriptionStatus,
    };
  });

  app.post('/api/account/deletion-request', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const user = request.user as { org: string; role: string };
    if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: 'Organisation administrator access required' });
    }
    const requestedAt = new Date();
    const result = await prismaClient.organization.updateMany({
      where: { id: user.org, deletionRequestedAt: null },
      data: { deletionRequestedAt: requestedAt },
    });
    const organization = await prismaClient.organization.findUnique({
      where: { id: user.org },
      select: { deletionRequestedAt: true, subscriptionStatus: true },
    });
    if (!organization) return reply.code(404).send({ error: 'Organisation not found' });
    return reply.code(result.count === 1 ? 202 : 200).send({
      deletionRequestedAt: organization.deletionRequestedAt,
      recoveryDays: RETENTION_POLICY.organizationRecoveryDays,
      subscriptionStatus: organization.subscriptionStatus,
      message: 'Organisation deletion has been requested. Subscription cancellation remains a separate billing action.',
    });
  });

  app.delete('/api/account/deletion-request', async (request, reply) => {
    const user = request.user as { org: string; role: string };
    if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: 'Organisation administrator access required' });
    }
    const result = await prismaClient.organization.updateMany({
      where: { id: user.org, deletionRequestedAt: { not: null } },
      data: { deletionRequestedAt: null },
    });
    return { cancelled: result.count === 1 };
  });
};
