import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { sendVerificationEmail } from '../email.js';

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.privacyready.co.uk';
const VERIFY_TOKEN_TTL_HOURS = 24;

// TypeBox schemas for validation and sanitization
const RegisterSchema = {
  body: Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ 
      minLength: 8,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
    }),
    fullName: Type.String({ minLength: 2 }),
    organizationName: Type.String({ minLength: 2 }),
    scanId: Type.Optional(Type.String())
  })
};

const LoginSchema = {
  body: Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String()
  })
};

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueVerificationEmail(userId: string, email: string, fullName: string) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyTokenHash: hashToken(rawToken), emailVerifyExpires: expires }
  });

  const verifyUrl = `${PORTAL_URL}/verify-email?token=${rawToken}&uid=${userId}`;
  await sendVerificationEmail(email, fullName, verifyUrl);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  
  app.post('/auth/register', { schema: RegisterSchema }, async (request, reply) => {
    const { email, password, fullName, organizationName, scanId } = request.body as any;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create Organization and User in a transaction
    const user = await prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: { name: organizationName }
      });
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          organizationId: org.id,
          role: process.env.SUPERADMIN_EMAIL && email.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase()
            ? 'SUPERADMIN'
            : 'ADMIN'
        }
      });
      
      // Claim the scan if provided
      if (scanId) {
        await tx.scan.updateMany({
          where: { id: scanId, organizationId: null },
          data: { organizationId: org.id }
        });
      }
      
      return newUser;
    });

    try {
      await issueVerificationEmail(user.id, user.email, user.fullName);
    } catch (err) {
      request.log.error(err, 'Failed to send verification email');
      // Don't fail registration if email sending has a transient issue --
      // the user can request a new link via /auth/resend-verification.
    }

    // No session token issued here on purpose -- login is blocked until
    // the email is verified, so there's nothing useful a token would do yet.
    return reply.status(201).send({
      message: 'Account created. Check your email to verify your address before logging in.'
    });
  });

  app.get('/auth/verify-email', async (request, reply) => {
    const { token, uid } = request.query as { token?: string; uid?: string };
    if (!token || !uid) {
      return reply.status(400).send({ error: 'Missing verification token' });
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || !user.emailVerifyTokenHash || !user.emailVerifyExpires) {
      return reply.status(400).send({ error: 'Invalid or already-used verification link' });
    }

    if (user.emailVerifyExpires < new Date()) {
      return reply.status(400).send({ error: 'Verification link expired. Request a new one.' });
    }

    if (hashToken(token) !== user.emailVerifyTokenHash) {
      return reply.status(400).send({ error: 'Invalid verification link' });
    }

    await prisma.user.update({
      where: { id: uid },
      data: { emailVerified: true, emailVerifyTokenHash: null, emailVerifyExpires: null }
    });

    return { message: 'Email verified. You can now log in.' };
  });

  const ResendSchema = { body: Type.Object({ email: Type.String({ format: 'email' }) }) };

  app.post('/auth/resend-verification', { schema: ResendSchema }, async (request, reply) => {
    const { email } = request.body as any;
    const user = await prisma.user.findUnique({ where: { email } });

    // Same response whether or not the account exists, so this can't be
    // used to enumerate registered emails.
    if (user && !user.emailVerified) {
      try {
        await issueVerificationEmail(user.id, user.email, user.fullName);
      } catch (err) {
        request.log.error(err, 'Failed to resend verification email');
      }
    }

    return { message: 'If that email is registered and unverified, a new verification link has been sent.' };
  });

  // Apply rate limit just to login
  app.post('/auth/login', { 
    schema: LoginSchema,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as any;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({ error: 'Please verify your email before logging in. Check your inbox, or request a new link via /auth/resend-verification.' });
    }

    const token = app.jwt.sign({ sub: user.id, org: user.organizationId, role: user.role }, { expiresIn: '1h' });
    return { token };
  });

  // Fetch current user identity
  app.get('/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tokenUser = request.user as any;
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.sub },
      include: { organization: true }
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationName: user.organization.name
    };
  });

};
