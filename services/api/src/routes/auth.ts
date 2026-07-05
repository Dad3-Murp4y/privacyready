import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

// TypeBox schemas for validation and sanitization
const RegisterSchema = {
  body: Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    fullName: Type.String({ minLength: 2 }),
    organizationName: Type.String({ minLength: 2 })
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
    const { email, password, fullName, organizationName } = request.body as any;

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
      return tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          organizationId: org.id,
          role: 'ADMIN'
        }
      });
    });

    const token = app.jwt.sign({ sub: user.id, org: user.organizationId });
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
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ sub: user.id, org: user.organizationId });
    return { token };
  });

};
