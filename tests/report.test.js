// tests/report.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const TEST_HISTORY_PATH = join(tmpdir(), `dnc-report-history-${Date.now()}.jsonl`);
const TEST_REPORT_DIR = join(tmpdir(), `dnc-report-dir-${Date.now()}`);
const TEST_REPORT_PATH = join(TEST_REPORT_DIR, 'do-not-call-reports.md');

process.env.DNC_HISTORY_PATH = TEST_HISTORY_PATH;

await mkdir(TEST_REPORT_DIR, { recursive: true });

const { getReportPath, checkDuplicate, appendReport, generateReport } =
  await import('../src/report.js');

const testConfig = { reportDir: TEST_REPORT_DIR };

const record = {
  success: true,
  timestamp: '2026-05-11T14:32:07.000Z',
  screenshotPath: './screenshots/dnc-test.png',
  callerPhone: '8005551234',
  callDate: '05/11/2026',
  callTime: '14:32',
  callType: 'robocall',
  callTopic: 'Warranties & protection plans',
  callTopicOther: '',
  myPhone: '5025550100',
  firstName: 'Jane',
  lastName: 'Doe',
  address: '123 Main St',
  city: 'Louisville',
  state: 'KY',
  zip: '40202',
  comment: 'Repeated robocall.',
  error: null,
};

// ── getReportPath ─────────────────────────────────────────────────────────────

test('getReportPath returns path inside configured reportDir', () => {
  assert.equal(getReportPath(testConfig), TEST_REPORT_PATH);
});

test('getReportPath defaults to ~/.config/dnc when reportDir is absent', () => {
  assert.equal(
    getReportPath({}),
    join(homedir(), '.config', 'dnc', 'do-not-call-reports.md'),
  );
});

test('getReportPath expands leading ~ in reportDir', () => {
  const path = getReportPath({ reportDir: '~/.config/dnc' });
  assert.ok(!path.includes('~'));
  assert.ok(path.startsWith(homedir()));
});

// ── checkDuplicate ────────────────────────────────────────────────────────────

test('checkDuplicate returns null when history file is empty', async () => {
  await writeFile(TEST_HISTORY_PATH, '');
  assert.equal(await checkDuplicate('8005551234'), null);
});

test('checkDuplicate returns null when number has only failed submissions', async () => {
  const failed = { ...record, success: false };
  await writeFile(TEST_HISTORY_PATH, JSON.stringify(failed) + '\n');
  assert.equal(await checkDuplicate('8005551234'), null);
});

test('checkDuplicate returns null when a different number was filed', async () => {
  const other = { ...record, callerPhone: '9005559876' };
  await writeFile(TEST_HISTORY_PATH, JSON.stringify(other) + '\n');
  assert.equal(await checkDuplicate('8005551234'), null);
});

test('checkDuplicate returns the most recent successful match', async () => {
  const first = { ...record, timestamp: '2026-05-01T10:00:00.000Z' };
  const second = { ...record, timestamp: '2026-05-11T14:32:07.000Z' };
  await writeFile(
    TEST_HISTORY_PATH,
    [first, second].map(r => JSON.stringify(r)).join('\n') + '\n',
  );
  const result = await checkDuplicate('8005551234');
  assert.equal(result.timestamp, second.timestamp);
});

// ── appendReport ──────────────────────────────────────────────────────────────

test('appendReport creates the file with header and first entry', async () => {
  await rm(TEST_REPORT_PATH, { force: true });
  await appendReport(record, testConfig);
  const content = await readFile(TEST_REPORT_PATH, 'utf-8');
  assert.ok(content.includes('# Do Not Call Complaints'));
  assert.ok(content.includes('(800) 555-1234'));
  assert.ok(content.includes('Warranties & protection plans'));
});

test('appendReport appends a second entry without rewriting the header', async () => {
  await rm(TEST_REPORT_PATH, { force: true });
  const second = { ...record, callerPhone: '9005559876', timestamp: '2026-05-12T09:00:00.000Z' };
  await appendReport(record, testConfig);
  await appendReport(second, testConfig);
  const content = await readFile(TEST_REPORT_PATH, 'utf-8');
  const headerCount = (content.match(/# Do Not Call Complaints/g) ?? []).length;
  assert.equal(headerCount, 1);
  assert.ok(content.includes('(800) 555-1234'));
  assert.ok(content.includes('(900) 555-9876'));
});

// ── generateReport ────────────────────────────────────────────────────────────

test('generateReport writes only successful records', async () => {
  const successful = { ...record, callerPhone: '8005551234' };
  const failed = { ...record, success: false, callerPhone: '9005559999' };
  await writeFile(
    TEST_HISTORY_PATH,
    [successful, failed].map(r => JSON.stringify(r)).join('\n') + '\n',
  );
  await rm(TEST_REPORT_PATH, { force: true });
  const { path, count } = await generateReport(testConfig);
  assert.equal(count, 1);
  const content = await readFile(path, 'utf-8');
  assert.ok(content.includes('(800) 555-1234'));
  assert.ok(!content.includes('9005559999'));
});

test('generateReport overwrites an existing report file', async () => {
  await writeFile(TEST_REPORT_PATH, 'stale content');
  await writeFile(TEST_HISTORY_PATH, JSON.stringify(record) + '\n');
  await generateReport(testConfig);
  const content = await readFile(TEST_REPORT_PATH, 'utf-8');
  assert.ok(!content.includes('stale content'));
  assert.ok(content.includes('# Do Not Call Complaints'));
});

test('generateReport returns count 0 and writes empty-state message when no successes', async () => {
  await writeFile(TEST_HISTORY_PATH, '');
  const { count } = await generateReport(testConfig);
  assert.equal(count, 0);
  const content = await readFile(TEST_REPORT_PATH, 'utf-8');
  assert.ok(content.includes('No complaints filed yet'));
});

test.after(async () => {
  await rm(TEST_HISTORY_PATH, { force: true });
  await rm(TEST_REPORT_DIR, { recursive: true, force: true });
});
