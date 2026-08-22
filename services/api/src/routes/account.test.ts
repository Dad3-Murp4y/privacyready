import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { accountRoutes } from './account.js';

function store() {
  const organizations: Record<string, any> = {
    'org-a': { id: 'org-a', subscriptionStatus: 'active', deletionRequestedAt: null },
    'org-b': { id: 'org-b', subscriptionStatus: 'canceled', deletionRequestedAt: null },
  };
  const users: Record<string, any> = {
    admin: { id: 'admin', organizationId: 'org-a', role: 'ADMIN' },
    member: { id: 'member', organizationId: 'org-a', role: 'MEMBER' },
    foreign: { id: 'foreign', organizationId: 'org-b', role: 'ADMIN' },
  };
  return {
    organizations,
    client: {
      user: { findUnique: async ({ where }: any) => users[where.id] ?? null },
      organization: {
        findUnique: async ({ where, select }: any) => {
          const value = organizations[where.id];
          if (!value) return null;
          return Object.fromEntries(Object.keys(select).map((key) => [key, value[key]]));
        },
        updateMany: async ({ where, data }: any) => {
          const value = organizations[where.id];
          const requiresNull = where.deletionRequestedAt === null;
          const requiresNotNull = where.deletionRequestedAt?.not === null;
          if (!value || (requiresNull && value.deletionRequestedAt !== null) || (requiresNotNull && value.deletionRequestedAt === null)) return { count: 0 };
          Object.assign(value, data);
          return { count: 1 };
        },
      },
    },
  };
}

async function appFor(client: any) {
  const app = Fastify();
  await app.register(jwt, { secret: 'account-test-jwt-secret-long-enough' });
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await app.register(accountRoutes, { prismaClient: client });
  return app;
}

function bearer(app: any, sub: string) {
  return { authorization: `Bearer ${app.jwt.sign({ sub })}` };
}

test('organisation administrator can request and cancel deletion without changing subscription', async (t) => {
  const data = store();
  const app = await appFor(data.client);
  t.after(() => app.close());
  const request = await app.inject({ method: 'POST', url: '/api/account/deletion-request', headers: bearer(app, 'admin') });
  assert.equal(request.statusCode, 202);
  assert.ok(data.organizations['org-a'].deletionRequestedAt instanceof Date);
  assert.equal(data.organizations['org-a'].subscriptionStatus, 'active');
  const cancel = await app.inject({ method: 'DELETE', url: '/api/account/deletion-request', headers: bearer(app, 'admin') });
  assert.equal(cancel.statusCode, 200);
  assert.equal(data.organizations['org-a'].deletionRequestedAt, null);
});

test('member cannot request deletion and tenant is derived from the authenticated user', async (t) => {
  const data = store();
  const app = await appFor(data.client);
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'POST', url: '/api/account/deletion-request', headers: bearer(app, 'member') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/account/deletion-request', headers: bearer(app, 'admin'), payload: { organizationId: 'org-b' } })).statusCode, 202);
  assert.equal(data.organizations['org-b'].deletionRequestedAt, null);
});

test('forged tenant and role claims cannot cancel another organisation deletion request', async (t) => {
  const data = store();
  data.organizations['org-b'].deletionRequestedAt = new Date();
  const app = await appFor(data.client);
  t.after(() => app.close());
  const authorization = `Bearer ${app.jwt.sign({ sub: 'member', org: 'org-b', role: 'SUPERADMIN' })}`;
  const response = await app.inject({ method: 'DELETE', url: '/api/account/deletion-request', headers: { authorization } });
  assert.equal(response.statusCode, 403);
  assert.ok(data.organizations['org-b'].deletionRequestedAt instanceof Date);
});
