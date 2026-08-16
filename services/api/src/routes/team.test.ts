import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { teamRoutes } from './team.js';

type TeamUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
  passwordHash: string;
  requiresPasswordChange: boolean;
  emailVerified: boolean;
  emailVerifyTokenHash?: string | null;
  emailVerifyExpires?: Date | null;
  createdAt: Date;
};

const seedUsers: TeamUser[] = [
  { id: 'admin-a', email: 'admin.a@example.test', fullName: 'Admin A', role: 'ADMIN', organizationId: 'org-a', passwordHash: 'synthetic', requiresPasswordChange: false, emailVerified: true, createdAt: new Date('2026-01-01') },
  { id: 'member-a', email: 'member.a@example.test', fullName: 'Member A', role: 'MEMBER', organizationId: 'org-a', passwordHash: 'synthetic', requiresPasswordChange: false, emailVerified: true, createdAt: new Date('2026-01-02') },
  { id: 'admin-b', email: 'admin.b@example.test', fullName: 'Admin B', role: 'ADMIN', organizationId: 'org-b', passwordHash: 'synthetic', requiresPasswordChange: false, emailVerified: true, createdAt: new Date('2026-01-03') },
  { id: 'member-b', email: 'member.b@example.test', fullName: 'Member B', role: 'MEMBER', organizationId: 'org-b', passwordHash: 'synthetic', requiresPasswordChange: false, emailVerified: true, createdAt: new Date('2026-01-04') },
];

function fakePrisma() {
  const users = structuredClone(seedUsers);
  let sequence = users.length;
  const client = {
    user: {
      findUnique: async ({ where }: any) => users.find((user) =>
        (where.id !== undefined && user.id === where.id) ||
        (where.email !== undefined && user.email === where.email),
      ) ?? null,
      findMany: async ({ where }: any) => users
        .filter((user) => user.organizationId === where.organizationId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      findFirst: async ({ where }: any) => users.find((user) =>
        user.id === where.id && user.organizationId === where.organizationId,
      ) ?? null,
      create: async ({ data }: any) => {
        const user: TeamUser = {
          id: `created-${++sequence}`,
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          organizationId: data.organizationId,
          passwordHash: data.passwordHash,
          requiresPasswordChange: data.requiresPasswordChange,
          emailVerified: false,
          createdAt: new Date(),
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
      count: async ({ where }: any) => users.filter((user) =>
        user.organizationId === where.organizationId &&
        where.role.in.includes(user.role) &&
        user.id !== where.id.not,
      ).length,
      delete: async ({ where }: any) => {
        const index = users.findIndex((user) => user.id === where.id);
        if (index < 0) throw new Error('synthetic user not found');
        return users.splice(index, 1)[0];
      },
    },
    organization: {
      findUnique: async ({ where }: any) => ({ id: where.id, name: where.id === 'org-a' ? 'Organisation A' : 'Organisation B' }),
    },
  };
  return { client, users };
}

async function testApp(prismaClient: any) {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: 'synthetic-jwt-signing-material-for-tests' });
  await app.register(teamRoutes, {
    prismaClient,
    sendInvite: async () => ({ MessageId: 'synthetic-message-id', $metadata: {} }),
  });
  await app.ready();
  return app;
}

function bearer(app: Awaited<ReturnType<typeof testApp>>, userId: string) {
  return { authorization: `Bearer ${app.jwt.sign({ sub: userId })}` };
}

test('each tenant admin lists only members from its authenticated organisation', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  assert.notEqual(store.users.find((user) => user.id === 'admin-a')?.organizationId, store.users.find((user) => user.id === 'admin-b')?.organizationId);
  const responseA = await app.inject({ method: 'GET', url: '/api/team', headers: bearer(app, 'admin-a') });
  const responseB = await app.inject({ method: 'GET', url: '/api/team', headers: bearer(app, 'admin-b') });
  assert.deepEqual(new Set(responseA.json().map((user: TeamUser) => user.id)), new Set(['admin-a', 'member-a']));
  assert.deepEqual(new Set(responseB.json().map((user: TeamUser) => user.id)), new Set(['admin-b', 'member-b']));
  assert.equal(responseA.body.includes('member.b@example.test'), false);
  assert.equal(responseB.body.includes('member.a@example.test'), false);
});

test('cross-tenant member ID deletion is indistinguishable from an invalid ID', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  for (const [admin, foreignMember] of [['admin-a', 'member-b'], ['admin-b', 'member-a']] as const) {
    const foreign = await app.inject({ method: 'DELETE', url: `/api/team/${foreignMember}`, headers: bearer(app, admin) });
    const unknown = await app.inject({ method: 'DELETE', url: '/api/team/nonexistent-member', headers: bearer(app, admin) });
    assert.equal(foreign.statusCode, 404);
    assert.deepEqual(foreign.json(), unknown.json());
  }
  assert.equal(store.users.some((user) => user.id === 'member-a'), true);
  assert.equal(store.users.some((user) => user.id === 'member-b'), true);
});

test('normal members cannot list, create, update, delete, or elevate team users', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  for (const member of ['member-a', 'member-b']) {
    const headers = bearer(app, member);
    const [list, create, update, remove] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/team', headers }),
      app.inject({ method: 'POST', url: '/api/team', headers, payload: { email: `${member}.invite@example.test`, fullName: 'Synthetic Invite', role: 'ADMIN' } }),
      app.inject({ method: 'PATCH', url: `/api/team/${member}`, headers, payload: { role: 'ADMIN' } }),
      app.inject({ method: 'DELETE', url: `/api/team/${member === 'member-a' ? 'admin-a' : 'admin-b'}`, headers }),
    ]);
    assert.equal(list.statusCode, 403);
    assert.equal(create.statusCode, 403);
    assert.equal(remove.statusCode, 403);
    assert.equal(update.statusCode, 404); // No tenant role-update route exists.
  }
  assert.equal(store.users.find((user) => user.id === 'member-a')?.role, 'MEMBER');
  assert.equal(store.users.find((user) => user.id === 'member-b')?.role, 'MEMBER');
});

test('admin-created members are forced into the authenticated tenant and cannot be SUPERADMIN', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  const created = await app.inject({
    method: 'POST',
    url: '/api/team',
    headers: bearer(app, 'admin-a'),
    payload: {
      email: 'new.member@example.test',
      fullName: 'New Member',
      role: 'MEMBER',
      organizationId: 'org-b',
    },
  });
  assert.equal(created.statusCode, 201);
  const newUser = store.users.find((user) => user.email === 'new.member@example.test');
  assert.equal(newUser?.organizationId, 'org-a');
  assert.equal(newUser?.role, 'MEMBER');
  assert.equal(newUser?.emailVerified, false);

  const elevated = await app.inject({
    method: 'POST', url: '/api/team', headers: bearer(app, 'admin-a'),
    payload: { email: 'elevated@example.test', fullName: 'Elevated User', role: 'SUPERADMIN', organizationId: 'org-b' },
  });
  assert.equal(elevated.statusCode, 400);
  assert.equal(store.users.some((user) => user.email === 'elevated@example.test'), false);
});

test('tenant admins have no team update route to alter roles in either tenant', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());

  for (const [admin, target] of [['admin-a', 'member-a'], ['admin-a', 'member-b'], ['admin-b', 'member-a']] as const) {
    const response = await app.inject({
      method: 'PATCH', url: `/api/team/${target}`, headers: bearer(app, admin), payload: { role: 'ADMIN', organizationId: 'org-a' },
    });
    assert.equal(response.statusCode, 404);
  }
  assert.equal(store.users.find((user) => user.id === 'member-a')?.role, 'MEMBER');
  assert.equal(store.users.find((user) => user.id === 'member-b')?.role, 'MEMBER');
});
