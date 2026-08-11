import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyStripeWebhookSignature } from './billing.js';

const webhookSecret = 'test-webhook-secret';
const timestamp = 1_700_000_000;
const rawPayload = Buffer.from('{"id":"evt_test","type":"checkout.session.completed"}', 'utf8');

function signatureFor(payload: Buffer) {
  return createHmac('sha256', webhookSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), payload]))
    .digest('hex');
}

test('accepts a valid Stripe v1 webhook signature for the original raw payload', () => {
  assert.equal(
    verifyStripeWebhookSignature(rawPayload, `t=${timestamp},v1=${signatureFor(rawPayload)}`, webhookSecret, timestamp),
    true,
  );
});

test('rejects a signature when the raw payload has been modified', () => {
  const modifiedPayload = Buffer.from('{"id":"evt_test","type":"invoice.payment_failed"}', 'utf8');

  assert.equal(
    verifyStripeWebhookSignature(modifiedPayload, `t=${timestamp},v1=${signatureFor(rawPayload)}`, webhookSecret, timestamp),
    false,
  );
});

test('rejects a stale Stripe webhook signature', () => {
  assert.equal(
    verifyStripeWebhookSignature(rawPayload, `t=${timestamp},v1=${signatureFor(rawPayload)}`, webhookSecret, timestamp + 301),
    false,
  );
});
