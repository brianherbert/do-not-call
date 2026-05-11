// tests/history.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HISTORY_PATH = join(tmpdir(), `dnc-history-test-${Date.now()}.jsonl`);
process.env.DNC_HISTORY_PATH = TEST_HISTORY_PATH;

// Import AFTER setting env var
const { appendHistory, readHistory } = await import('../src/history.js');

test('appendHistory writes a newline-delimited JSON record', async () => {
  const record = { success: true, callerPhone: '8005551234', timestamp: '2025-05-11T14:32:07Z' };
  await appendHistory(record);
  const lines = (await readFile(TEST_HISTORY_PATH, 'utf-8')).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), record);
});

test('readHistory returns the last 20 entries when more than 20 exist', async () => {
  const records = Array.from({ length: 25 }, (_, i) => ({
    success: true,
    callerPhone: `800555${String(i).padStart(4, '0')}`,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
  }));
  await writeFile(TEST_HISTORY_PATH, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  const last20 = await readHistory();
  assert.equal(last20.length, 20);
  // Entries 5-24 (last 20 of 25) — first returned entry is records[5]
  assert.equal(last20[0].callerPhone, records[5].callerPhone);
  assert.equal(last20[19].callerPhone, records[24].callerPhone);
});

test('readHistory returns all entries when fewer than 20 exist', async () => {
  await writeFile(TEST_HISTORY_PATH, '{"success":true,"callerPhone":"8005551234","timestamp":"2025-01-01T00:00:00Z"}\n');
  const entries = await readHistory();
  assert.equal(entries.length, 1);
});

test.after(async () => {
  await rm(TEST_HISTORY_PATH, { force: true });
});
