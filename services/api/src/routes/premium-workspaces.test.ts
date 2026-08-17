import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { registerConsentRoutes } from './consent.js';
import { registerPolicyRoutes } from './policies.js';

const users: Record<string, any> = { paid: { id: 'paid', organizationId: 'org-paid', role: 'ADMIN' }, free: { id: 'free', organizationId: 'org-free', role: 'ADMIN' }, 'super-paid': { id: 'super-paid', organizationId: 'org-paid', role: 'SUPERADMIN' }, 'super-free': { id: 'super-free', organizationId: 'org-free', role: 'SUPERADMIN' } };
const organizations: Record<string, any> = { 'org-paid': { id: 'org-paid', subscriptionStatus: 'active' }, 'org-free': { id: 'org-free', subscriptionStatus: 'free' } };
const prismaClient = { user: { findUnique: async ({ where }: any) => users[where.id] ?? null }, organization: { findUnique: async ({ where }: any) => organizations[where.id] ?? null } };

async function app() { const server = Fastify(); await server.register(jwt, { secret: 'synthetic-premium-workspace-test-secret' }); await registerConsentRoutes(server, { prismaClient: prismaClient as any }); await registerPolicyRoutes(server, { prismaClient: prismaClient as any }); await server.ready(); return server; }
const auth = (server: Awaited<ReturnType<typeof app>>, user: 'paid' | 'free' | 'super-paid' | 'super-free') => ({ authorization: `Bearer ${server.jwt.sign({ sub: user })}` });

test('consent scaffold rejects unauthenticated and free callers', async (t) => { const server = await app(); t.after(() => server.close()); assert.equal((await server.inject({ method: 'GET', url: '/api/v1/consents' })).statusCode, 401); assert.equal((await server.inject({ method: 'GET', url: '/api/v1/consents', headers: auth(server, 'free') })).statusCode, 403); assert.equal((await server.inject({ method: 'POST', url: '/api/v1/consents', headers: auth(server, 'free') })).statusCode, 403); });
test('paid consent read is honest and unsupported writes fail', async (t) => { const server = await app(); t.after(() => server.close()); const read = await server.inject({ method: 'GET', url: '/api/v1/consents', headers: auth(server, 'paid') }); assert.equal(read.statusCode, 200); assert.deepEqual(read.json().items, []); assert.equal((await server.inject({ method: 'POST', url: '/api/v1/consents', headers: auth(server, 'paid') })).statusCode, 501); });
test('policy generation is server-authorized and does not trust client organisation IDs', async (t) => { const server = await app(); t.after(() => server.close()); const payload = { businessName: 'Synthetic Ltd', contactEmail: 'privacy@example.test', dataTypes: 'Names and email addresses', thirdParties: 'Synthetic Processor', retentionMonths: 12, organizationId: 'org-paid' }; assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', payload })).statusCode, 401); assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'free'), payload })).statusCode, 403); const paid = await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'paid'), payload }); assert.equal(paid.statusCode, 200); assert.match(paid.json().policy, /Synthetic Ltd/); assert.doesNotMatch(paid.json().policy, /org-paid/); });

test('policy validation enforces practical field and retention limits', async (t) => {
  const server = await app(); t.after(() => server.close());
  const valid = { businessName: 'B'.repeat(200), contactEmail: 'privacy@example.test', dataTypes: 'D'.repeat(2000), thirdParties: 'P'.repeat(2000), retentionMonths: 120 };
  assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'paid'), payload: valid })).statusCode, 200);
  for (const payload of [
    { ...valid, businessName: 'B'.repeat(201) },
    { ...valid, dataTypes: 'D'.repeat(2001) },
    { ...valid, thirdParties: 'P'.repeat(2001) },
    { ...valid, contactEmail: 'not-an-email' },
    { ...valid, retentionMonths: 0 },
    { ...valid, retentionMonths: 121 },
  ]) assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'paid'), payload })).statusCode, 400);
});

test('HTML-like policy input remains inert text in the generated draft', async (t) => {
  const server = await app(); t.after(() => server.close());
  const payload = { businessName: '<script>alert(1)</script>', contactEmail: 'privacy@example.test', dataTypes: '<img src=x onerror=alert(1)>', thirdParties: '<b>Processor</b>', retentionMonths: 12 };
  const response = await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'paid'), payload });
  assert.equal(response.statusCode, 200);
  assert.match(response.json().policy, /<script>alert\(1\)<\/script>/i);
  assert.equal(response.headers['content-type']?.startsWith('application/json'), true);
});

test('SUPERADMIN follows the same organisation subscription entitlement', async (t) => {
  const server = await app(); t.after(() => server.close());
  const payload = { businessName: 'Synthetic Ltd', contactEmail: 'privacy@example.test', dataTypes: 'Names', thirdParties: 'Processor', retentionMonths: 12 };
  assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'super-paid'), payload })).statusCode, 200);
  assert.equal((await server.inject({ method: 'POST', url: '/api/policies/generate', headers: auth(server, 'super-free'), payload })).statusCode, 403);
  assert.equal((await server.inject({ method: 'GET', url: '/api/v1/consents', headers: auth(server, 'super-paid') })).statusCode, 200);
  assert.equal((await server.inject({ method: 'GET', url: '/api/v1/consents', headers: auth(server, 'super-free') })).statusCode, 403);
});
