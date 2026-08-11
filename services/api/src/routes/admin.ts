import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';

const VALID_ROLES = ['MEMBER', 'ADMIN', 'SUPERADMIN'];

export const adminRoutes: FastifyPluginAsync = async (app) => {
  
  // Verify JWT and SUPERADMIN role for all routes in this plugin
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorized' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId, email: realUser.email };
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tokenUser = request.user as any;
    if (tokenUser.role !== 'SUPERADMIN') {
      return reply.code(403).send({ error: 'Forbidden: Requires SUPERADMIN role' });
    }
  });

  app.get('/admin/stats', async (request, reply) => {
    const totalUsers = await prisma.user.count();
    const totalOrgs = await prisma.organization.count();
    const totalScans = await prisma.scan.count();
    
    const completedScans = await prisma.scan.findMany({
      where: { status: 'COMPLETED', score: { not: null } },
      select: { score: true }
    });

    const avgScore = completedScans.length > 0
      ? Math.round(completedScans.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedScans.length)
      : 0;

    return { totalUsers, totalOrgs, totalScans, avgScore };
  });

  app.get('/admin/users', async (request, reply) => {
    const users = await prisma.user.findMany({
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationName: user.organization.name,
      createdAt: user.createdAt
    }));
  });

  // Promote/demote any user's platform role. This is the real way to
  // add another admin now -- no more hardcoded bootstrap email.
  app.patch('/admin/users/:id', async (request, reply) => {
    const tokenUser = request.user as any;
    const { id } = request.params as { id: string };
    const { role } = request.body as any;

    if (!role || !VALID_ROLES.includes(role)) {
      return reply.status(400).send({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
    }

    if (id === tokenUser.sub && role !== 'SUPERADMIN') {
      return reply.status(400).send({ error: "You can't demote your own account -- ask another superadmin to do it." });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role }
    });

    return { id: updated.id, email: updated.email, role: updated.role };
  });

  // Delete any user platform-wide.
  app.delete('/admin/users/:id', async (request, reply) => {
    const tokenUser = request.user as any;
    const { id } = request.params as { id: string };

    if (id === tokenUser.sub) {
      return reply.status(400).send({ error: "You can't delete your own account while logged in as it." });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });

  // List all organizations (a second admin view, not just users).
  app.get('/admin/organizations', async (request, reply) => {
    const orgs = await prisma.organization.findMany({
      include: { _count: { select: { users: true, scans: true, dsrRequests: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return orgs.map((org: any) => ({
      id: org.id,
      name: org.name,
      industry: org.industry,
      userCount: org._count.users,
      scanCount: org._count.scans,
      dsrCount: org._count.dsrRequests,
      createdAt: org.createdAt
    }));
  });

  // Delete an organization and everything under it (cascades to users,
  // scans, DSRs per the schema's onDelete: Cascade).
  app.delete('/admin/organizations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    await prisma.organization.delete({ where: { id } });
    return reply.status(204).send();
  });

  app.get('/admin/organizations/:id/details', async (request, reply) => {
    const { id } = request.params as { id: string };

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, email: true, fullName: true, role: true, createdAt: true }
        },
        scans: {
          select: { id: true, targetIdentifier: true, status: true, score: true, scanType: true, riskLevel: true, findingsJson: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        dsrRequests: {
          select: { id: true, requestType: true, status: true, subjectEmail: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    return org;
  });

};
