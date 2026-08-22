import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { registerDsrRoutes } from './dsr.js';

const users = {
  'user-a': { id: 'user-a', role: 'ADMIN', organizationId: 'org-a' },
  'user-b': { id: 'user-b', role: 'ADMIN', organizationId: 'org-b' },
  'user-free': { id: 'user-free', role: 'ADMIN', organizationId: 'org-free' },
};

const organizations = {
  'org-a': { id: 'org-a', subscriptionStatus: 'active' },
  'org-b': { id: 'org-b', subscriptionStatus: 'active' },
  'org-free': { id: 'org-free', subscriptionStatus: 'inactive' },
};

function fakePrisma() {
  const records: Array<{ id: string; organizationId: string; status: string; createdAt: Date; resolvedAt: Date | null }> = [
    { id: 'dsr-a', organizationId: 'org-a', status: 'PENDING', createdAt: new Date(), resolvedAt: null },
    { id: 'dsr-b', organizationId: 'org-b', status: 'PENDING', createdAt: new Date(), resolvedAt: null },
  ];
  return {
    records,
    client: {
      user: { findUnique: async ({ where }: any) => (users as any)[where.id] ?? null },
      organization: {
        findUnique: async ({ where }: any) => (organizations as any)[where.id] ?? null,
        findFirst: async ({ where }: any) => where.name === 'Public Organisation' ? { id: 'org-a' } : null,
      },
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

test('unauthenticated DSR access is rejected', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/dsr' });
  assert.equal(response.statusCode, 401);
});

test('a free organisation cannot retrieve DSR records or probe an individual ID', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const headers = bearer(app, 'user-free');
  const list = await app.inject({ method: 'GET', url: '/api/dsr', headers });
  const individual = await app.inject({ method: 'GET', url: '/api/dsr/dsr-a', headers });

  assert.equal(list.statusCode, 403);
  assert.deepEqual(list.json(), { error: 'Premium subscription required' });
  assert.equal(individual.statusCode, 403);
  assert.deepEqual(individual.json(), { error: 'Premium subscription required' });
});

test('a free organisation cannot create or manage DSR records', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const headers = bearer(app, 'user-free');

  const create = await app.inject({ method: 'POST', url: '/api/dsr', headers, payload: { subjectEmail: 'subject@example.test', requestType: 'ACCESS' } });
  const update = await app.inject({ method: 'PATCH', url: '/api/dsr/dsr-a', headers, payload: { status: 'COMPLETED' } });

  assert.equal(create.statusCode, 403);
  assert.equal(update.statusCode, 403);
  assert.equal(store.records.find((record) => record.id === 'dsr-a')?.status, 'PENDING');
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

test('public DSR submission remains available without authentication', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/public/dsr',
    payload: { organizationName: 'Public Organisation', subjectEmail: 'subject@example.test', requestType: 'ACCESS' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().success, true);
});

test('public and authenticated DSR routes reject oversized free text without truncation', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const oversized = 'x'.repeat(2001);
  const publicResponse = await app.inject({
    method: 'POST', url: '/api/public/dsr',
    payload: { organizationName: 'Public Organisation', subjectEmail: 'subject@example.test', requestType: 'ACCESS', reasonText: oversized },
  });
  const authenticatedResponse = await app.inject({
    method: 'POST', url: '/api/dsr', headers: bearer(app, 'user-a'),
    payload: { subjectEmail: 'subject@example.test', requestType: 'ACCESS', reasonText: oversized },
  });
  assert.equal(publicResponse.statusCode, 400);
  assert.equal(authenticatedResponse.statusCode, 400);
});

test('public and authenticated DSR routes reject oversized email addresses server-side', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const oversizedEmail = `${'a'.repeat(245)}@example.test`;
  assert.ok(oversizedEmail.length > 254);
  const publicResponse = await app.inject({
    method: 'POST', url: '/api/public/dsr',
    payload: { organizationName: 'Public Organisation', subjectEmail: oversizedEmail, requestType: 'ACCESS' },
  });
  const authenticatedResponse = await app.inject({
    method: 'POST', url: '/api/dsr', headers: bearer(app, 'user-a'),
    payload: { subjectEmail: oversizedEmail, requestType: 'ACCESS' },
  });
  assert.equal(publicResponse.statusCode, 400);
  assert.equal(authenticatedResponse.statusCode, 400);
});

test('closing and reopening a DSR maintains an explicit retention anchor', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const complete = await app.inject({ method: 'PATCH', url: '/api/dsr/dsr-a', headers: bearer(app, 'user-a'), payload: { status: 'COMPLETED' } });
  assert.equal(complete.statusCode, 200);
  assert.ok(store.records[0].resolvedAt instanceof Date);
  const reopen = await app.inject({ method: 'PATCH', url: '/api/dsr/dsr-a', headers: bearer(app, 'user-a'), payload: { status: 'IN_REVIEW' } });
  assert.equal(reopen.statusCode, 200);
  assert.equal(store.records[0].resolvedAt, null);
});
