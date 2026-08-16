import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcrypt';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './auth.js';

type TestUser = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  organizationId: string;
  role: string;
  emailVerified: boolean;
  emailVerifyTokenHash: string | null;
  emailVerifyExpires: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetExpires: Date | null;
  requiresPasswordChange: boolean;
};

function digest(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fakePrisma(initialUsers: TestUser[] = []) {
  const users = structuredClone(initialUsers);
  let userSequence = users.length;
  let orgSequence = 0;

  const userApi = {
    findUnique: async ({ where }: any) => users.find((user) =>
      (where.id !== undefined && user.id === where.id) ||
      (where.email !== undefined && user.email === where.email),
    ),
    create: async ({ data }: any) => {
      const user: TestUser = {
        id: `user-${++userSequence}`,
        email: data.email,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        organizationId: data.organizationId,
        role: data.role,
        emailVerified: false,
        emailVerifyTokenHash: null,
        emailVerifyExpires: null,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        requiresPasswordChange: false,
      };
      users.push(user);
      return user;
    },
    update: async ({ where, data }: any) => {
      const user = users.find((candidate) => candidate.id === where.id);
      if (!user) throw new Error('synthetic user not found');
      Object.assign(user, data);
      return user;
    },
  };
  const client = {
    user: userApi,
    organization: {
      create: async ({ data }: any) => ({ id: `org-${++orgSequence}`, ...data }),
    },
    scan: { updateMany: async () => ({ count: 1 }) },
    $transaction: async (operation: (tx: any) => unknown) => operation({
      user: userApi,
      organization: {
        create: async ({ data }: any) => ({ id: `org-${++orgSequence}`, ...data }),
      },
      scan: { updateMany: async () => ({ count: 1 }) },
    }),
  };
  return { client, users };
}

async function testApp(options: any) {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: 'synthetic-jwt-signing-material-for-tests' });
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await app.register(authRoutes, { prefix: '/api', ...options });
  await app.ready();
  return app;
}

const registration = {
  email: 'new.user@example.test',
  password: 'Synthetic1!',
  fullName: 'Synthetic User',
  organizationName: 'Synthetic Organisation',
};

test('successful registration sends verification but keeps the account unverified', async (t) => {
  const store = fakePrisma();
  const deliveries: string[] = [];
  const app = await testApp({
    prismaClient: store.client,
    sendVerification: async (_email: string, _name: string, url: string) => { deliveries.push(url); },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registration });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { message: 'Account created. Check your email to verify your address before logging in.' });
  assert.equal(deliveries.length, 1);
  const user = store.users[0];
  assert.equal(user.emailVerified, false);
  assert.match(user.emailVerifyTokenHash ?? '', /^[a-f0-9]{64}$/);
  const deliveredToken = new URL(deliveries[0]).searchParams.get('token');
  assert.ok(deliveredToken);
  assert.equal(user.emailVerifyTokenHash, digest(deliveredToken));
  assert.equal(JSON.stringify(response.json()).includes(deliveredToken), false);
});

test('verification delivery failures never verify the user or permit login', async (t) => {
  const store = fakePrisma();
  let attempts = 0;
  const app = await testApp({
    prismaClient: store.client,
    sendVerification: async () => {
      attempts += 1;
      if (attempts === 2) return null;
      throw new Error('synthetic provider failure with internal-detail-marker');
    },
  });
  t.after(() => app.close());

  const registered = await app.inject({ method: 'POST', url: '/api/auth/register', payload: registration });
  assert.equal(registered.statusCode, 201);
  assert.equal(JSON.stringify(registered.json()).includes('internal-detail-marker'), false);
  const user = store.users[0];
  assert.equal(user.emailVerified, false);

  for (let index = 0; index < 2; index += 1) {
    const resent = await app.inject({
      method: 'POST', url: '/api/auth/resend-verification', payload: { email: registration.email },
    });
    assert.equal(resent.statusCode, 200);
    assert.equal(resent.json().message, 'If that email is registered and unverified, a new verification link has been sent.');
    assert.equal(user.emailVerified, false);
  }
  assert.equal(attempts, 3);

  const login = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { email: registration.email, password: registration.password },
  });
  assert.equal(login.statusCode, 403);
  assert.equal(login.headers['set-cookie'], undefined);
  assert.equal(user.emailVerified, false);
});

test('password-reset delivery success stores only a hash and returns no token', async (t) => {
  const originalHash = await bcrypt.hash('Original1!', 4);
  const user: TestUser = {
    id: 'known-user', email: 'known@example.test', fullName: 'Known User', passwordHash: originalHash,
    organizationId: 'org-known', role: 'MEMBER', emailVerified: true,
    emailVerifyTokenHash: null, emailVerifyExpires: null, passwordResetTokenHash: null,
    passwordResetExpires: null, requiresPasswordChange: false,
  };
  const store = fakePrisma([user]);
  let deliveredUrl = '';
  const app = await testApp({
    prismaClient: store.client,
    sendPasswordReset: async (_email: string, _name: string, url: string) => { deliveredUrl = url; },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: user.email } });
  assert.equal(response.statusCode, 200);
  const rawToken = new URL(deliveredUrl).searchParams.get('token');
  assert.ok(rawToken);
  assert.equal(store.users[0].passwordResetTokenHash, digest(rawToken));
  assert.notEqual(store.users[0].passwordResetTokenHash, rawToken);
  assert.equal(store.users[0].passwordHash, originalHash);
  assert.equal(JSON.stringify(response.json()).includes(rawToken), false);
});

test('password-reset delivery failure preserves the password and invalidates reset state', async (t) => {
  const originalHash = await bcrypt.hash('Original1!', 4);
  const user: TestUser = {
    id: 'known-user', email: 'known@example.test', fullName: 'Known User', passwordHash: originalHash,
    organizationId: 'org-known', role: 'MEMBER', emailVerified: true,
    emailVerifyTokenHash: null, emailVerifyExpires: null, passwordResetTokenHash: null,
    passwordResetExpires: null, requiresPasswordChange: false,
  };
  const store = fakePrisma([user]);
  let providerCalled = false;
  const app = await testApp({
    prismaClient: store.client,
    sendPasswordReset: async () => {
      providerCalled = true;
      throw new Error('synthetic SES internals credentials marker');
    },
  });
  t.after(() => app.close());

  const known = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: user.email } });
  const unknown = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'unknown@example.test' } });
  assert.equal(providerCalled, true);
  assert.equal(known.statusCode, 200);
  assert.deepEqual(known.json(), unknown.json());
  assert.equal(JSON.stringify(known.json()).includes('synthetic SES'), false);
  assert.equal(store.users[0].passwordHash, originalHash);
  assert.equal(store.users[0].passwordResetTokenHash, null);
  assert.equal(store.users[0].passwordResetExpires, null);
});
