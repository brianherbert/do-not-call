// tests/prompt.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone } from '../src/prompt.js';

test('normalizePhone strips non-digit characters', () => {
  assert.equal(normalizePhone('(800) 555-1234'), '8005551234');
  assert.equal(normalizePhone('800.555.1234'), '8005551234');
  assert.equal(normalizePhone('+1-800-555-1234'), '18005551234');
  assert.equal(normalizePhone('8005551234'), '8005551234');
});

test('isValidPhone accepts exactly 10 digits after stripping', () => {
  assert.equal(isValidPhone('8005551234'), true);
  assert.equal(isValidPhone('(800) 555-1234'), true);
  assert.equal(isValidPhone('800555123'), false);
  assert.equal(isValidPhone('80055512345'), false);
  assert.equal(isValidPhone(''), false);
});
