import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';
import { authRoutes } from '../routes/auth.js';
import { claimAnonymousScan, registerScanRoutes } from '../routes/scan.js';
import { registerDsrRoutes } from '../routes/dsr.js';
import { teamRoutes } from '../routes/team.js';
import { isCheckoutSessionForOrganization } from '../routes/billing.js';
import { runRetention } from '../retention.js';

assert.equal(process.env.RUN_POSTGRES_INTEGRATION, 'true', 'Run through npm run test:integration');
assert.ok(process.env.DATABASE_URL?.includes('privacyready_test'), 'Refusing to use a non-test database');

process.env.SCANNER_API_KEY = 'synthetic-postgres-integration-scanner-key';
const prisma = new PrismaClient();
const jwtSecret = 'synthetic-postgres-integration-jwt-signing-secret';

const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');

async function clearDatabase() {
  await prisma.$transaction([
    prisma.suppressionList.deleteMany(),
    prisma.dsrRequest.deleteMany(),
    prisma.scan.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}

async function createTenant(name: string, suffix: string) {
  const organization = await prisma.organization.create({ data: { name } });
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@integration.invalid`,
      fullName: `${name} Admin`,
      passwordHash: await bcrypt.hash('Synthetic1!Password', 4),
      role: 'ADMIN',
      emailVerified: true,
      organizationId: organization.id,
    },
  });
  return { organization, user };
}

async function authenticatedApp(user: { id: string; organizationId: string; role: string }) {
  const app = Fastify();
  await app.register(jwt, { secret: jwtSecret });
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await registerScanRoutes(app, { prismaClient: prisma });
  await registerDsrRoutes(app, { prismaClient: prisma });
  await app.register(teamRoutes, { prismaClient: prisma, sendInvite: async () => ({ MessageId: 'synthetic', $metadata: {} }) });
  const authorization = `Bearer ${app.jwt.sign({ sub: user.id, org: user.organizationId, role: user.role })}`;
  return { app, authorization };
}

test('real PostgreSQL security and persistence contracts', async (t) => {
  await t.test('registration persists an unverified user and organisation', async () => {
    await clearDatabase();
    const app = Fastify();
    await app.register(jwt, { secret: jwtSecret });
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await app.register(authRoutes, {
      prefix: '/api', prismaClient: prisma,
      sendVerification: async () => ({ MessageId: 'synthetic', $metadata: {} }),
      sendPasswordReset: async () => ({ MessageId: 'synthetic', $metadata: {} }),
    });
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {
      email: 'new-user@integration.invalid', password: 'Synthetic1!Password', fullName: 'New User', organizationName: 'New Org',
    }});
    assert.equal(response.statusCode, 201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new-user@integration.invalid' }, include: { organization: true } });
    assert.equal(user.emailVerified, false);
    assert.equal(user.organization.name, 'New Org');
    assert.ok(user.emailVerifyTokenHash);
    assert.ok(user.emailVerifyExpires && user.emailVerifyExpires > new Date());
    await app.close();
  });

  await t.test('failed reset delivery clears persisted reset state', async () => {
    await clearDatabase();
    const { user } = await createTenant('Reset Org', 'reset-user');
    const oldHash = user.passwordHash;
    const app = Fastify();
    await app.register(jwt, { secret: jwtSecret });
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await app.register(authRoutes, { prefix: '/api', prismaClient: prisma,
      sendVerification: async () => ({ MessageId: 'synthetic', $metadata: {} }),
      sendPasswordReset: async () => { throw new Error('synthetic provider failure'); },
    });
    const response = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: user.email } });
    assert.equal(response.statusCode, 200);
    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(persisted.passwordHash, oldHash);
    assert.equal(persisted.passwordResetTokenHash, null);
    assert.equal(persisted.passwordResetExpires, null);
    assert.equal(response.body.includes('token'), false);
    await app.close();
  });

  await t.test('successful reset delivery persists only a token hash and expiry', async () => {
    await clearDatabase();
    const { user } = await createTenant('Reset Success Org', 'reset-success');
    let deliveredUrl = '';
    const app = Fastify();
    await app.register(jwt, { secret: jwtSecret });
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await app.register(authRoutes, { prefix: '/api', prismaClient: prisma,
      sendVerification: async () => ({ MessageId: 'synthetic', $metadata: {} }),
      sendPasswordReset: async (_email, _name, url) => { deliveredUrl = url; return { MessageId: 'synthetic', $metadata: {} }; },
    });
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: user.email } })).statusCode, 200);
    const raw = new URL(deliveredUrl).searchParams.get('token');
    assert.ok(raw);
    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(persisted.passwordResetTokenHash, tokenHash(raw));
    assert.notEqual(persisted.passwordResetTokenHash, raw);
    assert.ok(persisted.passwordResetExpires && persisted.passwordResetExpires > new Date());
    await app.close();
  });

  await t.test('public scan persists a hash and returns the raw claim token once', async () => {
    await clearDatabase();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ score: 82, risk_level: 'low', findings: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const app = Fastify();
    await app.register(jwt, { secret: jwtSecret });
    await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await registerScanRoutes(app, { prismaClient: prisma });
    try {
      const response = await app.inject({ method: 'POST', url: '/api/public/scan', payload: { scanType: 'website', targetIdentifier: 'integration-public.example' } });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.match(body.claimToken, /^[a-f0-9]{64}$/);
      const persisted = await prisma.scan.findUniqueOrThrow({ where: { id: body.id } });
      assert.equal(persisted.organizationId, null);
      assert.equal(persisted.claimTokenHash, tokenHash(body.claimToken));
      assert.notEqual(persisted.claimTokenHash, body.claimToken);
      assert.ok(persisted.claimTokenExpires && persisted.claimTokenExpires > new Date());
      assert.equal(JSON.stringify(persisted).includes(body.claimToken), false);
    } finally {
      globalThis.fetch = originalFetch;
      await app.close();
    }
  });

  await t.test('anonymous claim is hashed, atomic, single-use, and tenant-bound', async () => {
    await clearDatabase();
    const a = await createTenant('Org A', 'admin-a');
    const b = await createTenant('Org B', 'admin-b');
    assert.notEqual(a.organization.id, b.organization.id);
    const raw = 'a'.repeat(64);
    const scan = await prisma.scan.create({ data: {
      scanType: 'website', targetIdentifier: 'https://example.invalid', status: 'COMPLETED',
      claimTokenHash: tokenHash(raw), claimTokenExpires: new Date(Date.now() + 60_000),
    }});
    const [first, second] = await Promise.all([
      claimAnonymousScan(prisma, a.organization.id, raw),
      claimAnonymousScan(prisma, b.organization.id, raw),
    ]);
    assert.equal([first, second].filter(Boolean).length, 1);
    const persisted = await prisma.scan.findUniqueOrThrow({ where: { id: scan.id } });
    assert.equal(persisted.claimTokenHash, null);
    assert.equal(persisted.claimTokenExpires, null);
    assert.ok([a.organization.id, b.organization.id].includes(persisted.organizationId!));
    assert.equal(JSON.stringify(persisted).includes(raw), false);
    assert.equal(await claimAnonymousScan(prisma, a.organization.id, raw), null);
  });

  await t.test('scan, DSR, and team routes enforce real tenant identifiers', async () => {
    await clearDatabase();
    const a = await createTenant('Org A', 'route-admin-a');
    const b = await createTenant('Org B', 'route-admin-b');
    await prisma.organization.update({ where: { id: a.organization.id }, data: { subscriptionStatus: 'active' } });
    const foreignScan = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'foreign.invalid', organizationId: b.organization.id } });
    const ownScan = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'own.invalid', organizationId: a.organization.id } });
    const foreignDsr = await prisma.dsrRequest.create({ data: { organizationId: b.organization.id, subjectEmail: 'foreign@integration.invalid', requestType: 'ACCESS', dueDate: new Date(Date.now() + 86_400_000) } });
    const foreignMember = await prisma.user.create({ data: { email: 'member-b@integration.invalid', fullName: 'Member B', passwordHash: 'synthetic', organizationId: b.organization.id } });
    const { app, authorization } = await authenticatedApp(a.user);
    const scans = await app.inject({ method: 'GET', url: '/api/scan', headers: { authorization } });
    assert.equal(scans.statusCode, 200);
    assert.deepEqual(scans.json().map((item: { id: string }) => item.id), [ownScan.id]);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/scan/${foreignScan.id}`, headers: { authorization } })).statusCode, 404);
    const dsrs = await app.inject({ method: 'GET', url: '/api/dsr', headers: { authorization } });
    assert.equal(dsrs.statusCode, 200);
    assert.equal(dsrs.json().some((item: { id: string }) => item.id === foreignDsr.id), false);
    assert.equal((await app.inject({ method: 'PATCH', url: `/api/dsr/${foreignDsr.id}`, headers: { authorization }, payload: { status: 'COMPLETED' } })).statusCode, 404);
    const team = await app.inject({ method: 'GET', url: '/api/team', headers: { authorization } });
    assert.equal(team.statusCode, 200);
    assert.equal(team.json().some((item: { id: string }) => item.id === foreignMember.id), false);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/team/${foreignMember.id}`, headers: { authorization } })).statusCode, 404);
    await app.close();
  });

  await t.test('checkout binding and PostgreSQL constraints match application assumptions', async () => {
    await clearDatabase();
    const a = await createTenant('Billing A', 'billing-a');
    const b = await createTenant('Billing B', 'billing-b');
    assert.equal(isCheckoutSessionForOrganization({ payment_status: 'paid', client_reference_id: a.organization.id }, a.organization.id), true);
    assert.equal(isCheckoutSessionForOrganization({ payment_status: 'paid', client_reference_id: b.organization.id }, a.organization.id), false);
    await assert.rejects(() => prisma.user.create({ data: { email: a.user.email, fullName: 'Duplicate', passwordHash: 'synthetic', organizationId: b.organization.id } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
    await assert.rejects(() => prisma.user.create({ data: { email: 'bad-fk@integration.invalid', fullName: 'Bad FK', passwordHash: 'synthetic', organizationId: '00000000-0000-0000-0000-000000000000' } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003');
    const scan = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'cascade.invalid', organizationId: a.organization.id } });
    const dsr = await prisma.dsrRequest.create({ data: { organizationId: a.organization.id, subjectEmail: 'cascade@integration.invalid', requestType: 'ERASURE', dueDate: new Date() } });
    await prisma.organization.delete({ where: { id: a.organization.id } });
    assert.equal(await prisma.user.findUnique({ where: { id: a.user.id } }), null);
    assert.equal(await prisma.scan.findUnique({ where: { id: scan.id } }), null);
    assert.equal(await prisma.dsrRequest.findUnique({ where: { id: dsr.id } }), null);
  });

  await t.test('retention selects only expired records and preserves active or recent data', async () => {
    await clearDatabase();
    const now = new Date('2026-08-22T12:00:00.000Z');
    const eligibleOrg = await createTenant('Deletion Requested', 'retention-delete');
    await prisma.organization.update({ where: { id: eligibleOrg.organization.id }, data: { deletionRequestedAt: new Date('2026-07-20T12:00:00.000Z') } });
    const recoveringOrg = await createTenant('Recovery Period', 'retention-recovering');
    await prisma.organization.update({ where: { id: recoveringOrg.organization.id }, data: { deletionRequestedAt: new Date('2026-07-24T12:00:00.000Z') } });
    const activeOrg = await createTenant('Active Organisation', 'retention-active');
    const oldScan = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'old.example', organizationId: activeOrg.organization.id, createdAt: new Date('2025-08-20T12:00:00.000Z') } });
    const recentScan = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'recent.example', organizationId: activeOrg.organization.id, createdAt: new Date('2025-08-23T12:00:00.000Z') } });
    const expiredAnonymous = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'expired-anonymous.example', claimTokenHash: 'expired', claimTokenExpires: new Date('2026-08-21T11:59:59.000Z') } });
    const graceAnonymous = await prisma.scan.create({ data: { scanType: 'website', targetIdentifier: 'grace-anonymous.example', claimTokenHash: 'grace', claimTokenExpires: new Date('2026-08-21T12:00:01.000Z') } });
    const oldDsr = await prisma.dsrRequest.create({ data: { organizationId: activeOrg.organization.id, subjectEmail: 'old-dsr@example.test', requestType: 'ACCESS', status: 'COMPLETED', dueDate: now, resolvedAt: new Date('2024-08-20T12:00:00.000Z') } });
    const recentDsr = await prisma.dsrRequest.create({ data: { organizationId: activeOrg.organization.id, subjectEmail: 'recent-dsr@example.test', requestType: 'ACCESS', status: 'COMPLETED', dueDate: now, resolvedAt: new Date('2024-08-23T12:00:00.000Z') } });
    const openDsr = await prisma.dsrRequest.create({ data: { organizationId: activeOrg.organization.id, subjectEmail: 'open-dsr@example.test', requestType: 'ACCESS', status: 'PENDING', dueDate: now, resolvedAt: new Date('2024-08-20T12:00:00.000Z') } });
    await prisma.user.update({ where: { id: activeOrg.user.id }, data: {
      emailVerifyTokenHash: 'expired-token', emailVerifyExpires: new Date('2026-08-22T11:59:59.000Z'),
      passwordResetTokenHash: 'recent-reset-token', passwordResetExpires: new Date('2026-08-22T12:00:01.000Z'),
    } });
    await prisma.suppressionList.create({ data: { email: 'preserve@example.test', reason: 'COMPLAINT' } });

    const dryRun = await runRetention(prisma, { now });
    assert.deepEqual(dryRun.eligible, { organizations: 1, scans: 1, anonymousScans: 1, closedDsrRequests: 1, expiredVerificationTokens: 1, expiredPasswordResetTokens: 0 });
    assert.ok(await prisma.scan.findUnique({ where: { id: oldScan.id } }));

    const executed = await runRetention(prisma, { now, execute: true });
    assert.equal(executed.mode, 'execute');
    assert.equal(await prisma.organization.findUnique({ where: { id: eligibleOrg.organization.id } }), null);
    assert.ok(await prisma.organization.findUnique({ where: { id: recoveringOrg.organization.id } }));
    assert.equal(await prisma.scan.findUnique({ where: { id: oldScan.id } }), null);
    assert.ok(await prisma.scan.findUnique({ where: { id: recentScan.id } }));
    assert.equal(await prisma.scan.findUnique({ where: { id: expiredAnonymous.id } }), null);
    assert.ok(await prisma.scan.findUnique({ where: { id: graceAnonymous.id } }));
    assert.equal(await prisma.dsrRequest.findUnique({ where: { id: oldDsr.id } }), null);
    assert.ok(await prisma.dsrRequest.findUnique({ where: { id: recentDsr.id } }));
    assert.ok(await prisma.dsrRequest.findUnique({ where: { id: openDsr.id } }));
    assert.ok(await prisma.suppressionList.findUnique({ where: { email: 'preserve@example.test' } }));
    const activeUser = await prisma.user.findUniqueOrThrow({ where: { id: activeOrg.user.id } });
    assert.equal(activeUser.emailVerifyTokenHash, null);
    assert.equal(activeUser.emailVerifyExpires, null);
    assert.equal(activeUser.passwordResetTokenHash, 'recent-reset-token');
    assert.ok(activeUser.passwordResetExpires);

    const repeated = await runRetention(prisma, { now, execute: true });
    assert.deepEqual(repeated.affected, { organizations: 0, scans: 0, anonymousScans: 0, closedDsrRequests: 0, expiredVerificationTokens: 0, expiredPasswordResetTokens: 0 });
  });

  await clearDatabase();
  await prisma.$disconnect();
});
