import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';

type EntitlementPrisma = Pick<typeof prisma, 'user' | 'organization'>;

export async function requireActiveSubscription(request: FastifyRequest, reply: FastifyReply, prismaClient: EntitlementPrisma = prisma) {
  try {
    await request.jwtVerify();
    const tokenUser = request.user as any;
    const realUser = await prismaClient.user.findUnique({ where: { id: tokenUser.sub } });
    if (!realUser) { await reply.code(401).send({ error: 'Unauthorized' }); return false; }
    const organization = await prismaClient.organization.findUnique({ where: { id: realUser.organizationId }, select: { subscriptionStatus: true } });
    if (organization?.subscriptionStatus !== 'active') { await reply.code(403).send({ error: 'Premium subscription required' }); return false; }
    request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId };
    return true;
  } catch {
    await reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
}
