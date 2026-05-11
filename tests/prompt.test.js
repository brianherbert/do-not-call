// tests/prompt.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone, parseDate } from '../src/prompt.js';

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

test('parseDate normalizes many input formats to MM/DD/YYYY', () => {
  assert.equal(parseDate('05/01/2026'), '05/01/2026');   // already correct
  assert.equal(parseDate('5/1/2026'), '05/01/2026');     // no zero padding
  assert.equal(parseDate('May 1, 2026'), '05/01/2026');  // month name
  assert.equal(parseDate('May 1 2026'), '05/01/2026');   // no comma
  assert.equal(parseDate('1 May 2026'), '05/01/2026');   // day-first
  assert.equal(parseDate('May 1st, 2026'), '05/01/2026'); // ordinal suffix
  assert.equal(parseDate('may 1, 2026'), '05/01/2026');  // lowercase
  assert.equal(parseDate('5-1-2026'), '05/01/2026');     // dashes
  assert.equal(parseDate('5.1.2026'), '05/01/2026');     // dots
  assert.equal(parseDate('5/1/26'), '05/01/2026');       // 2-digit year
  assert.equal(parseDate('2026-05-01'), '05/01/2026');   // ISO format
});

test('parseDate returns null for unparseable input', () => {
  assert.equal(parseDate('not a date'), null);
  assert.equal(parseDate(''), null);
  assert.equal(parseDate('99/99/9999'), null);
});
