import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { sendTeamInviteEmail } from '../email.js';

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.privacyready.co.uk';
const VERIFY_TOKEN_TTL_HOURS = 24;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Client-side ("my organization") team management -- distinct from
// admin.ts, which is platform-wide and SUPERADMIN-only. This lets an
// org's own ADMIN manage the people inside their own organization,
// the same way most SaaS products let a workspace owner invite or
// remove teammates without needing platform-level access.
export const teamRoutes: FastifyPluginAsync = async (app) => {

  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      const tokenUser = request.user as any;
      const realUser = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
      if (!realUser) return reply.code(401).send({ error: 'Unauthorized' });
      request.user = { ...tokenUser, role: realUser.role, org: realUser.organizationId };
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tokenUser = request.user as any;
    if (tokenUser.role !== 'ADMIN' && tokenUser.role !== 'SUPERADMIN') {
      return reply.code(403).send({ error: 'Forbidden: Requires ADMIN role in your organization' });
    }
  });

  // List everyone in the caller's own organization.
  app.get('/api/team', async (request) => {
    const user = request.user as any;
    const teammates = await prisma.user.findMany({
      where: { organizationId: user.org },
      orderBy: { createdAt: 'desc' }
    });
    return teammates.map((t: any) => ({
      id: t.id,
      email: t.email,
      fullName: t.fullName,
      role: t.role,
      createdAt: t.createdAt
    }));
  });

  const CreateTeammateSchema = {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      fullName: Type.String({ minLength: 2 }),
      role: Type.Optional(Type.String())
    })
  };

  // Create a teammate directly in the caller's org and email them an
  // invite with a temporary password + verification link.
  app.post('/api/team', { schema: CreateTeammateSchema }, async (request, reply) => {
    const user = request.user as any;
    const { email, fullName, role } = request.body as any;

    const requestedRole = (role || 'MEMBER').toUpperCase();
    if (!['MEMBER', 'ADMIN'].includes(requestedRole)) {
      return reply.status(400).send({ error: "role must be MEMBER or ADMIN (use the platform admin panel to grant SUPERADMIN)" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(400).send({ error: 'Email already registered' });
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char random temp password
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const org = await prisma.organization.findUnique({ where: { id: user.org } });

    const teammate = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: requestedRole,
        organizationId: user.org
      }
    });

    // Same verification requirement as self-registration -- an org
    // admin vouching for someone doesn't prove they typed the right
    // email address, so the invitee still has to confirm it themselves.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: teammate.id },
      data: { emailVerifyTokenHash: hashToken(rawToken), emailVerifyExpires: expires }
    });

    const verifyUrl = `${PORTAL_URL}/verify-email?token=${rawToken}&uid=${teammate.id}`;
    let emailFailed = false;
    try {
      await sendTeamInviteEmail(email, fullName, org?.name || 'your organization', tempPassword, verifyUrl);
    } catch (err) {
      request.log.error(err, 'Failed to send team invite email');
      emailFailed = true;
    }

    return reply.status(201).send({
      id: teammate.id,
      email: teammate.email,
      fullName: teammate.fullName,
      role: teammate.role,
      // Only included when the email genuinely failed to send -- this is
      // the one case where the admin needs another way to hand it over.
      // On the normal path the invitee gets it via email only, since a
      // temp password sitting in a JSON response body ends up in logs,
      // browser history, and any proxy in between.
      ...(emailFailed ? {
        temporaryPassword: tempPassword,
        warning: 'Invite email failed to send -- share this temporary password with them directly.'
      } : {})
    });
  });

  // Remove a teammate from your own org. Can't remove yourself this
  // way, and can't leave an org with zero ADMINs.
  app.delete('/api/team/:id', async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    if (id === user.sub) {
      return reply.status(400).send({ error: "You can't remove your own account from your team this way." });
    }

    const target = await prisma.user.findFirst({ where: { id, organizationId: user.org } });
    if (!target) {
      return reply.status(404).send({ error: 'Teammate not found in your organization' });
    }

    if (target.role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') {
      return reply.status(403).send({ error: 'Only a SUPERADMIN can remove another SUPERADMIN.' });
    }

    if (target.role === 'ADMIN' || target.role === 'SUPERADMIN') {
      const remainingAdmins = await prisma.user.count({
        where: { organizationId: user.org, role: { in: ['ADMIN', 'SUPERADMIN'] }, id: { not: id } }
      });
      if (remainingAdmins === 0) {
        return reply.status(400).send({ error: 'Cannot remove the last admin of an organization.' });
      }
    }

    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });

};
