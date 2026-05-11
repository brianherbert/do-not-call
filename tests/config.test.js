// tests/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_CONFIG_PATH = join(tmpdir(), `dnc-test-config-${Date.now()}.json`);
process.env.DNC_CONFIG_PATH = TEST_CONFIG_PATH;

// Must import AFTER setting env var so config.js picks it up
const { loadConfig, saveConfig } = await import('../src/config.js');

test('saveConfig writes JSON to file', async () => {
  const config = { myPhone: '5025550100', firstName: 'Test', lastName: 'User' };
  await saveConfig(config);
  const raw = await readFile(TEST_CONFIG_PATH, 'utf-8');
  assert.deepEqual(JSON.parse(raw), config);
});

test('loadConfig reads saved config', async () => {
  const config = { myPhone: '5025550100', firstName: 'Test', lastName: 'User' };
  await writeFile(TEST_CONFIG_PATH, JSON.stringify(config));
  const loaded = await loadConfig();
  assert.deepEqual(loaded, config);
});

test.after(async () => {
  await rm(TEST_CONFIG_PATH, { force: true });
});
