import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showResult } from '../src/confirm.js';

test('showResult prints success banner', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (msg) => lines.push(msg ?? ''));

  showResult({
    success: true,
    confirmationText: 'Your complaint has been received.',
    screenshotPath: './screenshots/dnc-2025-05-11-143207.png',
    timestamp: '2025-05-11T14:32:07.000Z',
  });

  assert.ok(lines.some(l => l.includes('COMPLAINT FILED SUCCESSFULLY')));
  assert.ok(lines.some(l => l.includes('Your complaint has been received.')));
  assert.ok(lines.some(l => l.includes('screenshots/dnc-2025-05-11-143207.png')));
});

test('showResult prints failure banner with manual URL', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (msg) => lines.push(msg ?? ''));

  showResult({
    success: false,
    error: 'CAPTCHA detected — complete manually at donotcall.gov',
    screenshotPath: './screenshots/dnc-2025-05-11-143207.png',
    timestamp: '2025-05-11T14:32:07.000Z',
  });

  assert.ok(lines.some(l => l.includes('SUBMISSION FAILED')));
  assert.ok(lines.some(l => l.includes('CAPTCHA detected')));
  assert.ok(lines.some(l => l.includes('donotcall.gov')));
});
