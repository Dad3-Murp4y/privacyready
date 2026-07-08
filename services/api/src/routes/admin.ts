import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  
  // Verify JWT and SUPERADMIN role for all routes in this plugin
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
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

};
