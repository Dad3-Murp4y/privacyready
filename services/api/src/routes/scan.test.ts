import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

process.env.SCANNER_API_KEY = 'unit-test-scanner-key';

const { claimAnonymousScan, registerScanRoutes } = await import('./scan.js');

type ScanRow = {
  id: string;
  scanType: string;
  targetIdentifier: string;
  status: string;
  organizationId: string | null;
  claimTokenHash: string | null;
  claimTokenExpires: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  score?: number;
  riskLevel?: string;
  findingsJson?: unknown;
};

const users = {
  'user-a': { id: 'user-a', role: 'ADMIN', organizationId: 'org-a' },
  'user-b': { id: 'user-b', role: 'ADMIN', organizationId: 'org-b' },
};

function digest(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function fakePrisma(initial: ScanRow[] = []) {
  const scans = structuredClone(initial);
  let sequence = scans.length;

  function matches(row: ScanRow, where: any): boolean {
    return Object.entries(where ?? {}).every(([key, expected]: [string, any]) => {
      const actual = (row as any)[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('gt' in expected) return actual instanceof Date && actual > expected.gt;
        if ('not' in expected) return actual !== expected.not;
      }
      return actual === expected;
    });
  }

  const client = {
    scan: {
      create: async ({ data }: any) => {
        const row: ScanRow = {
          id: `scan-${++sequence}`,
          scanType: data.scanType,
          targetIdentifier: data.targetIdentifier,
          status: data.status ?? 'PENDING',
          organizationId: data.organizationId ?? null,
          claimTokenHash: data.claimTokenHash ?? null,
          claimTokenExpires: data.claimTokenExpires ?? null,
          createdAt: new Date(Date.now() + sequence),
          completedAt: null,
        };
        scans.push(row);
        return structuredClone(row);
      },
      update: async ({ where, data }: any) => {
        const row = scans.find((candidate) => matches(candidate, where));
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        const matched = scans.filter((row) => matches(row, where));
        matched.forEach((row) => Object.assign(row, data));
        return { count: matched.length };
      },
      findFirst: async ({ where, orderBy, select }: any) => {
        let matched = scans.filter((row) => matches(row, where));
        if (orderBy?.createdAt === 'desc') matched = matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const row = matched[0];
        if (!row) return null;
        if (select) return Object.fromEntries(Object.keys(select).map((key) => [key, (row as any)[key]]));
        return structuredClone(row);
      },
      findMany: async ({ where }: any) => scans.filter((row) => matches(row, where)).map((row) => structuredClone(row)),
      delete: async ({ where }: any) => {
        const index = scans.findIndex((row) => matches(row, where));
        if (index < 0) throw new Error('not found');
        return scans.splice(index, 1)[0];
      },
    },
    user: {
      findUnique: async ({ where }: any) => (users as any)[where.id] ?? null,
    },
    organization: {
      findUnique: async ({ where }: any) => ({ id: where.id, subscriptionStatus: 'active' }),
    },
  };

  return { client, scans };
}

function anonymousScan(id: string, token: string, expires: Date, organizationId: string | null = null): ScanRow {
  return {
    id,
    scanType: 'website',
    targetIdentifier: 'example.com',
    status: 'COMPLETED',
    organizationId,
    claimTokenHash: digest(token),
    claimTokenExpires: expires,
    createdAt: new Date(),
    completedAt: new Date(),
  };
}

async function testApp(prismaClient: any) {
  const app = Fastify();
  await app.register(jwt, { secret: 'unit-test-jwt-secret-that-is-long-enough' });
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await registerScanRoutes(app, { prismaClient });
  await app.ready();
  return app;
}

function bearer(app: Awaited<ReturnType<typeof testApp>>, userId: keyof typeof users) {
  return { authorization: `Bearer ${app.jwt.sign({ sub: userId })}` };
}

test('public scan persists only the claim-token hash and returns the raw token once', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    gdpr_compliance_percentage: 90,
    risk_level: 'LOW',
    findings: [],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await app.inject({
    method: 'POST',
    url: '/api/public/scan',
    payload: { targetIdentifier: 'example.com', scanType: 'website' },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.match(body.claimToken, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(body).includes('unit-test-scanner-key'), false);
  assert.equal(JSON.stringify(body).includes('scanner.privacyready.local'), false);
  assert.equal(store.scans.length, 1);
  assert.equal(store.scans[0].claimTokenHash, digest(body.claimToken));
  assert.notEqual(store.scans[0].claimTokenHash, body.claimToken);
  assert.equal('claimToken' in store.scans[0], false);
});

test('valid authenticated claim uses the authenticated organisation and invalidates the token', async (t) => {
  const token = 'a'.repeat(64);
  const store = fakePrisma([anonymousScan('anonymous', token, new Date(Date.now() + 60_000))]);
  const app = await testApp(store.client);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-a'),
    payload: { claimToken: token, organizationId: 'org-b' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { id: 'anonymous', status: 'COMPLETED' });
  assert.equal(store.scans[0].organizationId, 'org-a');
  assert.equal(store.scans[0].claimTokenHash, null);
  assert.equal(store.scans[0].claimTokenExpires, null);
});

test('unauthenticated, invalid and expired claims are rejected without ownership detail', async (t) => {
  const validToken = 'b'.repeat(64);
  const expiredToken = 'c'.repeat(64);
  const store = fakePrisma([
    anonymousScan('valid', validToken, new Date(Date.now() + 60_000)),
    anonymousScan('expired', expiredToken, new Date(Date.now() - 60_000)),
  ]);
  const app = await testApp(store.client);
  t.after(() => app.close());

  const unauthenticated = await app.inject({ method: 'POST', url: '/api/scan/claim', payload: { claimToken: validToken } });
  assert.equal(unauthenticated.statusCode, 401);

  for (const token of ['d'.repeat(64), expiredToken]) {
    const response = await app.inject({
      method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-a'), payload: { claimToken: token },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: 'This free scan can no longer be claimed. Run a new scan from your dashboard.' });
  }
});

test('claimed tokens cannot be replayed or stolen by another tenant', async (t) => {
  const token = 'e'.repeat(64);
  const store = fakePrisma([anonymousScan('single-use', token, new Date(Date.now() + 60_000))]);
  const app = await testApp(store.client);
  t.after(() => app.close());

  const first = await app.inject({ method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-a'), payload: { claimToken: token } });
  const replay = await app.inject({ method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-a'), payload: { claimToken: token } });
  const theft = await app.inject({ method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-b'), payload: { claimToken: token } });

  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 400);
  assert.equal(theft.statusCode, 400);
  assert.equal(store.scans[0].organizationId, 'org-a');
});

test('the atomic claim primitive permits exactly one competing claimant', async () => {
  const token = 'f'.repeat(64);
  const store = fakePrisma([anonymousScan('race', token, new Date(Date.now() + 60_000))]);
  const results = await Promise.all([
    claimAnonymousScan(store.client as any, 'org-a', token),
    claimAnonymousScan(store.client as any, 'org-b', token),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.ok(['org-a', 'org-b'].includes(store.scans[0].organizationId ?? ''));
  assert.equal(store.scans[0].claimTokenHash, null);
});

test('scan history and deletion remain scoped to the authenticated tenant', async (t) => {
  const store = fakePrisma([
    anonymousScan('a-scan', '1'.repeat(64), new Date(), 'org-a'),
    anonymousScan('b-scan', '2'.repeat(64), new Date(), 'org-b'),
  ]);
  const app = await testApp(store.client);
  t.after(() => app.close());

  const historyA = await app.inject({ method: 'GET', url: '/api/scan', headers: bearer(app, 'user-a') });
  const historyB = await app.inject({ method: 'GET', url: '/api/scan', headers: bearer(app, 'user-b') });
  assert.deepEqual(historyA.json().map((scan: ScanRow) => scan.id), ['a-scan']);
  assert.deepEqual(historyB.json().map((scan: ScanRow) => scan.id), ['b-scan']);

  const crossTenantDelete = await app.inject({ method: 'DELETE', url: '/api/scan/b-scan', headers: bearer(app, 'user-a') });
  assert.equal(crossTenantDelete.statusCode, 404);
  assert.equal(store.scans.some((scan) => scan.id === 'b-scan'), true);

  const ownDelete = await app.inject({ method: 'DELETE', url: '/api/scan/a-scan', headers: bearer(app, 'user-a') });
  assert.equal(ownDelete.statusCode, 204);
  assert.equal(store.scans.some((scan) => scan.id === 'a-scan'), false);
});

test('authenticated scan creation derives ownership from each authenticated tenant', async (t) => {
  const store = fakePrisma();
  const app = await testApp(store.client);
  t.after(() => app.close());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    gdpr_compliance_percentage: 75,
    risk_level: 'MEDIUM',
    findings: [],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const userId of ['user-a', 'user-b'] as const) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: bearer(app, userId),
      payload: {
        targetIdentifier: `${userId}.example.com`,
        scanType: 'website',
        organizationId: userId === 'user-a' ? 'org-b' : 'org-a',
      },
    });
    assert.equal(response.statusCode, 200);
  }

  assert.deepEqual(store.scans.map((scan) => scan.organizationId), ['org-a', 'org-b']);
  const historyA = await app.inject({ method: 'GET', url: '/api/scan', headers: bearer(app, 'user-a') });
  const historyB = await app.inject({ method: 'GET', url: '/api/scan', headers: bearer(app, 'user-b') });
  assert.deepEqual(historyA.json().map((scan: ScanRow) => scan.organizationId), ['org-a']);
  assert.deepEqual(historyB.json().map((scan: ScanRow) => scan.organizationId), ['org-b']);
});

test('a tenant-owned scan cannot be claimed by token or direct identifier guessing', async (t) => {
  const token = '3'.repeat(64);
  const store = fakePrisma([anonymousScan('owned-by-b', token, new Date(Date.now() + 60_000), 'org-b')]);
  const app = await testApp(store.client);
  t.after(() => app.close());

  const claim = await app.inject({ method: 'POST', url: '/api/scan/claim', headers: bearer(app, 'user-a'), payload: { claimToken: token } });
  const readById = await app.inject({ method: 'GET', url: '/api/scan/owned-by-b', headers: bearer(app, 'user-a') });
  assert.equal(claim.statusCode, 400);
  assert.equal(readById.statusCode, 404); // No unscoped read-by-ID route exists.
  assert.equal(store.scans[0].organizationId, 'org-b');
});
