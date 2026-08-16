import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  isAllowedReturnUrl,
  isCheckoutSessionForOrganization,
  requireStripeConfiguration,
  verifyStripeWebhookSignature,
} from './billing.js';

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

test('Stripe configuration fails closed when either required secret is absent', () => {
  assert.throws(() => requireStripeConfiguration('', 'configured-webhook'), /not configured/);
  assert.throws(() => requireStripeConfiguration('configured-secret', ''), /not configured/);
  assert.doesNotThrow(() => requireStripeConfiguration('configured-secret', 'configured-webhook'));
});

test('checkout and portal return URLs reject an untrusted frontend origin', () => {
  const portal = 'https://app-staging.privacyready.co.uk';
  assert.equal(isAllowedReturnUrl('https://app-staging.privacyready.co.uk/dashboard', portal), true);
  assert.equal(isAllowedReturnUrl('https://evil.example/dashboard', portal), false);
  assert.equal(isAllowedReturnUrl('not a url', portal), false);
});

test('completed checkout sessions cannot update the wrong tenant', () => {
  const session = { status: 'complete', payment_status: 'paid', client_reference_id: 'org-a' };
  assert.equal(isCheckoutSessionForOrganization(session, 'org-a'), true);
  assert.equal(isCheckoutSessionForOrganization(session, 'org-b'), false);
});
