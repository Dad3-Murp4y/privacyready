import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../db.js';

const VALID_REQUEST_TYPES = ['ACCESS', 'ERASURE', 'RECTIFICATION', 'PORTABILITY', 'RESTRICTION'];
const VALID_STATUSES = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'];
const DSR_DEADLINE_DAYS = 30; // GDPR Art. 12(3) — one month, extendable in complex cases

export async function registerDsrRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/dsr')) {
      return;
    }
    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorized' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId };
    } catch (err) {
      return reply.send(err);
    }
  });

  const CreateDsrSchema = {
    body: Type.Object({
      subjectEmail: Type.String({ format: 'email' }),
      subjectName: Type.Optional(Type.String()),
      requestType: Type.String(),
      reasonText: Type.Optional(Type.String())
    })
  };

  // List all DSR requests for the caller's organization.
  app.get('/api/dsr', async (request) => {
    const user = request.user as any;
    return prisma.dsrRequest.findMany({
      where: { organizationId: user.org },
      orderBy: { createdAt: 'desc' }
    });
  });

  // File a new DSR request (e.g. logged manually from a support channel).
  app.post('/api/dsr', { schema: CreateDsrSchema }, async (request, reply) => {
    const user = request.user as any;
    const { subjectEmail, subjectName, requestType, reasonText } = request.body as any;

    const normalizedType = requestType.toUpperCase();
    if (!VALID_REQUEST_TYPES.includes(normalizedType)) {
      return reply.status(400).send({ error: `requestType must be one of ${VALID_REQUEST_TYPES.join(', ')}` });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DSR_DEADLINE_DAYS);

    const dsr = await prisma.dsrRequest.create({
      data: {
        organizationId: user.org,
        subjectEmail,
        subjectName,
        requestType: normalizedType,
        reasonText,
        dueDate
      }
    });
    return reply.status(201).send(dsr);
  });

  const UpdateDsrSchema = {
    body: Type.Object({
      status: Type.String()
    })
  };

  // Update status (e.g. mark as Completed). Scoped to the caller's org so
  // one tenant can't touch another tenant's DSR records.
  app.patch('/api/dsr/:id', { schema: UpdateDsrSchema }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };
    const { status } = request.body as any;

    const normalizedStatus = status.toUpperCase();
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return reply.status(400).send({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
    }

    const existing = await prisma.dsrRequest.findFirst({
      where: { id, organizationId: user.org }
    });
    if (!existing) {
      return reply.status(404).send({ error: 'DSR request not found' });
    }

    const updated = await prisma.dsrRequest.update({
      where: { id },
      data: {
        status: normalizedStatus,
        resolvedAt: normalizedStatus === 'COMPLETED' ? new Date() : existing.resolvedAt
      }
    });
    return updated;
  });
}
