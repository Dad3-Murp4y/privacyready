import assert from 'node:assert/strict';
import test from 'node:test';
import { maskedEmail, safeErrorMetadata } from './safe-logging.js';

test('safe error metadata excludes messages and arbitrary credential-bearing fields', () => {
  const metadata = safeErrorMetadata({
    name: 'ProviderError',
    code: 'REQUEST_FAILED',
    message: 'token=secret-value',
    config: { authorization: 'Bearer secret-value' },
    $metadata: { httpStatusCode: 503, requestId: 'request-123' },
  });
  assert.deepEqual(metadata, {
    errorName: 'ProviderError',
    errorCode: 'REQUEST_FAILED',
    httpStatusCode: 503,
    providerRequestId: 'request-123',
  });
  assert.equal(JSON.stringify(metadata).includes('secret-value'), false);
});

test('email masking retains routing context without logging the full address', () => {
  assert.equal(maskedEmail('person@example.test'), 'p***@example.test');
  assert.equal(maskedEmail('invalid'), '[invalid-email]');
});
