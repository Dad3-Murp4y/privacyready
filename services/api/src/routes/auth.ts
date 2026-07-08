import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

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
          role: email.toLowerCase() === 'all.datawai@gmail.com' ? 'SUPERADMIN' : 'ADMIN'
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

    const token = app.jwt.sign({ sub: user.id, org: user.organizationId, role: user.role }, { expiresIn: '1h' });
    return { token };
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
