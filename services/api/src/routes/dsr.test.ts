import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { registerDsrRoutes } from './dsr.js';

const users = {
  'user-a': { id: 'user-a', role: 'ADMIN', organizationId: 'org-a' },
  'user-b': { id: 'user-b', role: 'ADMIN', organizationId: 'org-b' },
};

function fakePrisma() {
  const records = [
    { id: 'dsr-a', organizationId: 'org-a', status: 'PENDING', createdAt: new Date(), resolvedAt: null },
    { id: 'dsr-b', organizationId: 'org-b', status: 'PENDING', createdAt: new Date(), resolvedAt: null },
  ];
  return {
    records,
    client: {
      user: { findUnique: async ({ where }: any) => (users as any)[where.id] ?? null },
      organization: { findFirst: async () => null },
      dsrRequest: {
        findMany: async ({ where }: any) => records.filter((record) => record.organizationId === where.organizationId),
        findFirst: async ({ where }: any) => records.find((record) => record.id === where.id && record.organizationId === where.organizationId) ?? null,
        update: async ({ where, data }: any) => {
          const record = records.find((candidate) => candidate.id === where.id);
          if (!record) throw new Error('not found');
          Object.assign(record, data);
          return record;
        },
        create: async ({ data }: any) => ({ id: 'created', status: 'PENDING', createdAt: new Date(), resolvedAt: null, ...data }),
      },
    },
  };
}

async function testApp(prismaClient: any) {
  const app = Fastify();
  await app.register(jwt, { secret: 'unit-test-jwt-secret-that-is-long-enough' });
  await registerDsrRoutes(app, { prismaClient });
  await app.ready();
  return app;
}

function bearer(app: Awaited<ReturnType<typeof testApp>>, userId: keyof typeof users) {
  return { authorization: `Bearer ${app.jwt.sign({ sub: userId })}` };
}

test('DSR lists are isolated by the authenticated organisation', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const responseA = await app.inject({ method: 'GET', url: '/api/dsr', headers: bearer(app, 'user-a') });
  const responseB = await app.inject({ method: 'GET', url: '/api/dsr', headers: bearer(app, 'user-b') });
  assert.deepEqual(responseA.json().map((record: any) => record.id), ['dsr-a']);
  assert.deepEqual(responseB.json().map((record: any) => record.id), ['dsr-b']);
});

test('one tenant cannot update another tenant DSR by guessing its ID', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/dsr/dsr-b',
    headers: bearer(app, 'user-a'),
    payload: { status: 'COMPLETED' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(store.records.find((record) => record.id === 'dsr-b')?.status, 'PENDING');
});

test('DSR creation always uses the authenticated organisation', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/dsr',
    headers: bearer(app, 'user-a'),
    payload: {
      subjectEmail: 'subject@example.com',
      requestType: 'ACCESS',
      organizationId: 'org-b',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().organizationId, 'org-a');
});
