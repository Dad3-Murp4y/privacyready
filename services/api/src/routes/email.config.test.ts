import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SES_FROM_EMAIL } from '../email.js';

test('transactional sender is isolated from human mailbox identities', () => {
  assert.equal(DEFAULT_SES_FROM_EMAIL, 'no-reply@notify.privacyready.co.uk');
  assert.equal(DEFAULT_SES_FROM_EMAIL.endsWith('@privacyready.co.uk'), false);
  assert.notEqual(DEFAULT_SES_FROM_EMAIL, 'support@privacyready.co.uk');
  assert.notEqual(DEFAULT_SES_FROM_EMAIL, 'demo@privacyready.co.uk');
});
