import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email.js';

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.privacyready.co.uk';
const VERIFY_TOKEN_TTL_HOURS = 24;

// TypeBox schemas for validation and sanitization
const RegisterSchema = {
  body: Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ 
      minLength: 8,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).{8,}$'
    }),
    fullName: Type.String({ minLength: 2 }),
    organizationName: Type.String({ minLength: 2 }),
    scanId: Type.Optional(Type.String()),
    // Required alongside scanId to actually claim it -- see note on
    // Scan.claimTokenHash in schema.prisma for why the id alone isn't enough.
    scanClaimToken: Type.Optional(Type.String())
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
  
  app.post('/auth/register', {
    schema: RegisterSchema,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { email, password, fullName, organizationName, scanId, scanClaimToken } = request.body as any;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // To prevent email enumeration, pretend registration succeeded
      return reply.status(201).send({
        message: 'Account created. Check your email to verify your address before logging in.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create Organization and User in a transaction
    let user;
    try {
      user = await prisma.$transaction(async (tx: any) => {
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

        // Claim the scan only if the caller can prove they're the one who
        // ran it, via the one-time token returned by /api/public/scan --
        // the scan id alone is not proof of ownership (see schema.prisma).
        if (scanId && scanClaimToken) {
          const updated = await tx.scan.updateMany({
            where: {
              id: scanId,
              organizationId: null,
              claimTokenHash: hashToken(scanClaimToken),
              claimTokenExpires: { gt: new Date() }
            },
            data: { organizationId: org.id, claimTokenHash: null, claimTokenExpires: null }
          });
          
          if (updated.count === 0) {
            throw new Error('INVALID_SCAN_CLAIM');
          }
        }

        return newUser;
      });
    } catch (err: any) {
      if (err.message === 'INVALID_SCAN_CLAIM') {
        return reply.code(400).send({ error: 'Invalid or expired scan claim token' });
      }
      throw err;
    }

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

  const VerifyEmailSchema = {
    body: Type.Object({
      token: Type.String(),
      uid: Type.String()
    })
  };

  // POST, not GET: a GET link is exactly what mail-scanning/prefetch
  // services (Outlook Safe Links, corporate spam filters, some inbox
  // preview features) will silently follow before the real user ever
  // clicks, which burns the one-time token. The emailed link now opens a
  // page with a "confirm" button (see VerifyEmail.tsx) that fires this
  // POST only on a real click.
  app.post('/auth/verify-email', { schema: VerifyEmailSchema }, async (request, reply) => {
    const { token, uid } = request.body as { token: string; uid: string };

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || !user.emailVerifyTokenHash || !user.emailVerifyExpires) {
      return reply.status(400).send({ error: 'Invalid or already-used verification link' });
    }

    if (user.emailVerifyExpires < new Date()) {
      return reply.status(400).send({ error: 'Verification link expired. Request a new one.' });
    }

    const providedHash = Buffer.from(hashToken(token));
    const storedHash = Buffer.from(user.emailVerifyTokenHash);
    const matches = providedHash.length === storedHash.length
      && crypto.timingSafeEqual(providedHash, storedHash);
    if (!matches) {
      return reply.status(400).send({ error: 'Invalid verification link' });
    }

    await prisma.user.update({
      where: { id: uid },
      data: { emailVerified: true, emailVerifyTokenHash: null, emailVerifyExpires: null }
    });

    return { message: 'Email verified. You can now log in.' };
  });

  const ResendSchema = { body: Type.Object({ email: Type.String({ format: 'email' }) }) };

  app.post('/auth/resend-verification', {
    schema: ResendSchema,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {
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
      // Run a dummy bcrypt hash to prevent timing side channels
      await bcrypt.hash(password, 12);
      // Same generic message as the wrong-password case below, on purpose --
      // "User not found" here would let an attacker enumerate which emails
      // are registered.
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({ error: 'Please verify your email before logging in. Check your inbox, or request a new link via /auth/resend-verification.' });
    }

    const token = app.jwt.sign({ sub: user.id, org: user.organizationId, role: user.role }, { expiresIn: '8h' });
    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = isProd ? 'Domain=.privacyready.co.uk; ' : '';
    reply.header('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=28800; ${cookieDomain}SameSite=Lax${isProd ? '; Secure' : ''}`);
    // Return the full JWT token so the frontend can use it as Authorization: Bearer
    const payload = token.split('.')[1];
    return { success: true, token, payload, requiresPasswordChange: user.requiresPasswordChange };
  });

  app.post('/auth/logout', async (request, reply) => {
    const isProd = process.env.NODE_ENV === 'production';
    reply.header('Set-Cookie', `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${isProd ? '; Secure' : ''}`);
    return { success: true };
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
      organizationName: user.organization.name,
      requiresPasswordChange: user.requiresPasswordChange
    };
  });

  app.post('/auth/forgot-password', {
    schema: { body: Type.Object({ email: Type.String({ format: 'email' }) }) },
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { email } = request.body as any;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: hashToken(rawToken), passwordResetExpires: expires }
      });
      const resetUrl = `${PORTAL_URL}/reset-password?token=${rawToken}&uid=${user.id}`;
      try {
        await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
      } catch (err) {
        request.log.error(err, 'Failed to send reset email');
      }
    }
    return { message: 'If that email is registered, a password reset link has been sent.' };
  });

  app.post('/auth/reset-password', {
    schema: {
      body: Type.Object({
        token: Type.String(),
        uid: Type.String(),
        newPassword: Type.String({ minLength: 8 })
      })
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { token, uid, newPassword } = request.body as any;
    const user = await prisma.user.findUnique({ where: { id: uid } });
    
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const providedHash = Buffer.from(hashToken(token));
    const storedHash = Buffer.from(user.passwordResetTokenHash);
    if (providedHash.length !== storedHash.length || !crypto.timingSafeEqual(providedHash, storedHash)) {
      return reply.status(400).send({ error: 'Invalid reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: uid },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        requiresPasswordChange: false
      }
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  });

  app.post('/auth/change-password', {
    schema: {
      body: Type.Object({
        oldPassword: Type.String(),
        newPassword: Type.String({ minLength: 8 })
      })
    }
  }, async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tokenUser = request.user as any;
    const user = await prisma.user.findUnique({ where: { id: tokenUser.sub } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const { oldPassword, newPassword } = request.body as any;
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) return reply.status(400).send({ error: 'Invalid old password' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, requiresPasswordChange: false }
    });

    return { message: 'Password changed successfully' };
  });

};
