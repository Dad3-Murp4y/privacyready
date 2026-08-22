import assert from 'node:assert/strict';
import test from 'node:test';
import { retentionCutoffs, retentionExecutionRequested, retentionFilters, runRetention } from './retention.js';

test('retention cutoffs preserve recovery and grace boundaries', () => {
  const now = new Date('2026-08-22T12:00:00.000Z');
  const cutoffs = retentionCutoffs(now);
  assert.equal(cutoffs.organization.toISOString(), '2026-07-23T12:00:00.000Z');
  assert.equal(cutoffs.scan.toISOString(), '2025-08-22T12:00:00.000Z');
  assert.equal(cutoffs.anonymousScan.toISOString(), '2026-08-21T12:00:00.000Z');
  assert.equal(cutoffs.closedDsr.toISOString(), '2024-08-22T12:00:00.000Z');
});

test('calendar-month cutoffs clamp leap days instead of selecting records early', () => {
  const cutoffs = retentionCutoffs(new Date('2024-02-29T12:00:00.000Z'));
  assert.equal(cutoffs.scan.toISOString(), '2023-02-28T12:00:00.000Z');
  assert.equal(cutoffs.closedDsr.toISOString(), '2022-02-28T12:00:00.000Z');
});

test('retention execution requires both the flag and exact confirmation', () => {
  assert.equal(retentionExecutionRequested([], undefined), false);
  assert.equal(retentionExecutionRequested([], 'DELETE_ELIGIBLE_RECORDS'), false);
  assert.throws(() => retentionExecutionRequested(['--execute'], undefined), /Execution requires/);
  assert.throws(() => retentionExecutionRequested(['--execute'], 'delete_eligible_records'), /Execution requires/);
  assert.equal(retentionExecutionRequested(['--execute'], 'DELETE_ELIGIBLE_RECORDS'), true);
});

test('retention filters require explicit deletion requests and closed DSRs', () => {
  const filters = retentionFilters(new Date('2026-08-22T12:00:00.000Z'));
  assert.deepEqual(filters.organizations.deletionRequestedAt.not, null);
  assert.deepEqual(filters.closedDsrRequests.status.in, ['COMPLETED', 'REJECTED']);
  assert.equal(filters.anonymousScans.organizationId, null);
  assert.deepEqual(filters.scans.organizationId, { not: null });
});

test('dry-run reports eligibility without invoking a transaction or deletion', async () => {
  let transactionCalled = false;
  const counts = [1, 2, 3, 4, 5, 6];
  const client = {
    organization: { count: async () => counts.shift() },
    scan: { count: async () => counts.shift() },
    dsrRequest: { count: async () => counts.shift() },
    user: { count: async () => counts.shift() },
    $transaction: async () => { transactionCalled = true; throw new Error('must not execute'); },
  } as any;
  const report = await runRetention(client, { now: new Date('2026-08-22T12:00:00.000Z') });
  assert.equal(report.mode, 'dry-run');
  assert.equal(transactionCalled, false);
  assert.deepEqual(report.eligible, {
    organizations: 1,
    scans: 2,
    anonymousScans: 3,
    closedDsrRequests: 4,
    expiredVerificationTokens: 5,
    expiredPasswordResetTokens: 6,
  });
});

test('transaction failures are propagated and never reported as successful execution', async () => {
  const client = {
    organization: { count: async () => 0 },
    scan: { count: async () => 0 },
    dsrRequest: { count: async () => 0 },
    user: { count: async () => 0 },
    $transaction: async () => { throw new Error('transaction rolled back'); },
  } as any;
  await assert.rejects(() => runRetention(client, { execute: true }), /transaction rolled back/);
});
