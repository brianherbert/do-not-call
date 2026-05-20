# Markdown Reports + Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-readable `do-not-call-reports.md` that records every successfully filed complaint, with duplicate detection before each submission and a `--generate-report` rebuild command.

**Architecture:** `src/report.js` is a new module that owns path resolution, duplicate detection (reading existing `history.jsonl`), and all markdown rendering. `bin/dnc.js` is updated to call these functions at the right points in the filing flow. The existing `history.jsonl` is expanded to store the full complaint so it can serve as the source of truth for report generation.

**Tech Stack:** Node.js 18 built-ins (`fs/promises`, `node:os`, `node:path`), `@inquirer/prompts` `confirm`, existing `src/history.js` `readHistory`.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/report.js` | **Create** | Path resolution, duplicate detection, markdown entry formatting, append + regenerate |
| `src/config.js` | Modify | Add `reportDir` field to interactive setup |
| `bin/dnc.js` | Modify | `--help`, `--generate-report`, duplicate check, call `appendReport` after success, expand `appendHistory` payload |
| `tests/report.test.js` | **Create** | Unit tests for all four `src/report.js` functions |

---

### Task 1: Add `--help` flag

**Files:**
- Modify: `bin/dnc.js`

- [ ] **Step 1: Add the `--help` block**

In `bin/dnc.js`, add this block immediately after `const args = process.argv.slice(2);`:

```js
if (args.includes('--help')) {
  console.log(`
Usage: dnc [phone] [options]

  dnc 8005551234        File a complaint for the given number
  dnc                   Prompt for the caller number interactively

Options:
  --config              Edit your saved personal details and preferences
  --history             Show the last 20 complaint attempts (all outcomes)
  --generate-report     Rebuild do-not-call-reports.md from history
  --dry-run             Fill the form but stop before submitting
  --headed              Open a visible browser window (for debugging)
  --help                Show this help message
`);
  process.exit(0);
}
```

- [ ] **Step 2: Verify it runs**

```bash
~/.nvm/versions/node/v18.17.1/bin/node bin/dnc.js --help
```

Expected: help text printed, process exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add bin/dnc.js
git commit -m "feat: add --help flag"
```

---

### Task 2: Expand JSONL record to store full complaint

**Files:**
- Modify: `bin/dnc.js`

- [ ] **Step 1: Replace the `appendHistory` call with the expanded version**

In `bin/dnc.js`, find the existing `appendHistory` call (near the bottom) and replace it:

```js
// Before:
await appendHistory({
  success: result.success,
  callerPhone: complaint.callerPhone,
  timestamp: result.timestamp,
  screenshotPath: result.screenshotPath,
  error: result.error ?? null,
}).catch(() => {});

// After:
await appendHistory({
  success: result.success,
  timestamp: result.timestamp,
  screenshotPath: result.screenshotPath,
  error: result.error ?? null,
  ...complaint,
}).catch(() => {});
```

The spread puts all complaint fields (callerPhone, callDate, callTime, callType, callTopic, callTopicOther, myPhone, firstName, lastName, address, city, state, zip, comment, registeredOnDNC, email) into the record. The explicit fields before the spread take precedence for `success`, `timestamp`, `screenshotPath`, and `error`.

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add bin/dnc.js
git commit -m "feat: store full complaint fields in history.jsonl"
```

---

### Task 3: Add `reportDir` to config

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add `reportDir` prompt to `firstRunSetup`**

In `src/config.js`, inside `firstRunSetup`, add `reportDir` as the last field in the `config` object (after `registeredOnDNC`):

```js
registeredOnDNC: await confirm({
  message: 'Is your number registered on the Do Not Call list?',
  default: true,
}),
reportDir: await input({
  message: 'Directory for do-not-call-reports.md:',
  default: join(homedir(), '.config', 'dnc'),
}),
```

`join` and `homedir` are already imported in `src/config.js`.

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat: add reportDir field to config"
```

---

### Task 4: Create `src/report.js` (TDD)

**Files:**
- Create: `tests/report.test.js`
- Create: `src/report.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/report.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/report.test.js
```

Expected: fails with `Cannot find module '../src/report.js'`.

- [ ] **Step 3: Create `src/report.js`**

```js
// src/report.js
import { appendFile, writeFile, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { readHistory } from './history.js';

export function getReportPath(config) {
  const dir = (config.reportDir ?? join(homedir(), '.config', 'dnc'))
    .replace(/^~/, homedir());
  return join(dir, 'do-not-call-reports.md');
}

export async function checkDuplicate(callerPhone) {
  const history = await readHistory(Number.MAX_SAFE_INTEGER);
  const matches = history.filter(r => r.success && r.callerPhone === callerPhone);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function formatPhone(digits) {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function toISODate(mmddyyyy) {
  if (!mmddyyyy) return null;
  const [m, d, y] = mmddyyyy.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function formatEntry(record) {
  const dateStr = toISODate(record.callDate) ?? record.timestamp.slice(0, 10);
  const timeStr = record.callTime ?? record.timestamp.slice(11, 16);
  const callType = record.callType === 'robocall' ? 'Robocall' : 'Live person';
  const topic =
    record.callTopic === 'Other' && record.callTopicOther
      ? `Other — ${record.callTopicOther}`
      : (record.callTopic ?? '—');
  const address =
    [record.address, record.city, record.state, record.zip].filter(Boolean).join(', ') || '—';

  return [
    `## ${dateStr} ${timeStr} — ${formatPhone(record.callerPhone)}`,
    '',
    `- **Filed:** ${new Date(record.timestamp).toLocaleString()}`,
    `- **Caller number:** ${formatPhone(record.callerPhone)}`,
    `- **Call date:** ${record.callDate ?? '—'} at ${record.callTime ?? '—'}`,
    `- **Call type:** ${callType}`,
    `- **Topic:** ${topic}`,
    `- **My number:** ${record.myPhone ? formatPhone(record.myPhone) : '—'}`,
    `- **Name:** ${[record.firstName, record.lastName].filter(Boolean).join(' ') || '—'}`,
    `- **Address:** ${address}`,
    `- **Comment:** ${record.comment ?? '—'}`,
    `- **Screenshot:** ${record.screenshotPath ?? '—'}`,
    '',
    '---',
  ].join('\n');
}

const HEADER =
  '# Do Not Call Complaints\n\n' +
  '> Auto-generated by `dnc`. To rebuild from history, run `dnc --generate-report`.\n\n' +
  '---\n';

export async function appendReport(record, config) {
  const path = getReportPath(config);
  await mkdir(dirname(path), { recursive: true });
  let exists = false;
  try { await access(path); exists = true; } catch {}
  const entry = '\n' + formatEntry(record) + '\n';
  if (!exists) {
    await writeFile(path, HEADER + entry);
  } else {
    await appendFile(path, entry);
  }
}

export async function generateReport(config) {
  const history = await readHistory(Number.MAX_SAFE_INTEGER);
  const successful = history.filter(r => r.success);
  const path = getReportPath(config);
  await mkdir(dirname(path), { recursive: true });
  const body =
    successful.length > 0
      ? successful.map(r => '\n' + formatEntry(r)).join('\n') + '\n'
      : '\n_No complaints filed yet._\n';
  await writeFile(path, HEADER + body);
  return { path, count: successful.length };
}
```

- [ ] **Step 4: Run the report tests to confirm they all pass**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/report.test.js
```

Expected: all 13 tests pass.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/report.js tests/report.test.js
git commit -m "feat: add src/report.js with duplicate detection and markdown generation"
```

---

### Task 5: Add `--generate-report` flag to `bin/dnc.js`

**Files:**
- Modify: `bin/dnc.js`

- [ ] **Step 1: Add imports at the top of `bin/dnc.js`**

Add two new imports at the top of `bin/dnc.js` (after the existing imports):

```js
import { homedir } from 'node:os';
import { checkDuplicate, appendReport, generateReport, getReportPath } from '../src/report.js';
```

- [ ] **Step 2: Add the `--generate-report` handler**

In `bin/dnc.js`, add this block after the `--history` handler:

```js
if (args.includes('--generate-report')) {
  const config = await loadConfig().catch(cancelled);
  const { path, count } = await generateReport(config);
  console.log(`✅ Report written to ${path.replace(homedir(), '~')} (${count} ${count === 1 ? 'entry' : 'entries'})`);
  process.exit(0);
}
```

- [ ] **Step 3: Verify**

```bash
~/.nvm/versions/node/v18.17.1/bin/node bin/dnc.js --generate-report
```

Expected: prints `✅ Report written to ~/.config/dnc/do-not-call-reports.md (N entries)`. Open the file and confirm entries are formatted correctly with phone numbers, dates, and all fields.

- [ ] **Step 4: Commit**

```bash
git add bin/dnc.js
git commit -m "feat: add --generate-report flag"
```

---

### Task 6: Add duplicate check before submission

**Files:**
- Modify: `bin/dnc.js`

- [ ] **Step 1: Add `confirm` to the `@inquirer/prompts` import**

In `bin/dnc.js`, the `@inquirer/prompts` package is not yet imported. Add it:

```js
import { confirm } from '@inquirer/prompts';
```

- [ ] **Step 2: Add the duplicate check**

In `bin/dnc.js`, insert this block between the `promptComplaint` call and the `submitComplaint` call:

```js
const prior = await checkDuplicate(complaint.callerPhone).catch(() => null);
if (prior) {
  const priorDate = new Date(prior.timestamp).toLocaleDateString();
  const formatted = `(${complaint.callerPhone.slice(0, 3)}) ${complaint.callerPhone.slice(3, 6)}-${complaint.callerPhone.slice(6)}`;
  console.log(`\n⚠️  You've already filed a complaint against ${formatted} on ${priorDate}.`);
  const proceed = await confirm({ message: 'File again anyway?', default: false }).catch(cancelled);
  if (!proceed) {
    console.log('Cancelled. No complaint was filed.');
    process.exit(0);
  }
}
```

- [ ] **Step 3: Test with a previously-filed number**

Run with any number that appears in `~/.config/dnc/history.jsonl` with `"success": true`:

```bash
~/.nvm/versions/node/v18.17.1/bin/node bin/dnc.js --dry-run <previously-filed-number>
```

Expected: warning shown with the prior filing date, "File again anyway?" prompt appears. Answering No exits cleanly with "Cancelled. No complaint was filed."

- [ ] **Step 4: Commit**

```bash
git add bin/dnc.js
git commit -m "feat: warn before re-filing a previously reported number"
```

---

### Task 7: Write to markdown report after each successful filing

**Files:**
- Modify: `bin/dnc.js`

- [ ] **Step 1: Call `appendReport` and print the report path on success**

In `bin/dnc.js`, add this block immediately after the `appendHistory` call (at the bottom of the main flow):

```js
if (result.success) {
  await appendReport(
    { success: result.success, timestamp: result.timestamp, screenshotPath: result.screenshotPath, error: result.error ?? null, ...complaint },
    config,
  ).catch(() => {});
  console.log('Report updated: ' + getReportPath(config).replace(homedir(), '~'));
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
~/.nvm/versions/node/v18.17.1/bin/node --test tests/*.test.js
```

Expected: all tests pass.

- [ ] **Step 3: End-to-end dry-run check**

```bash
~/.nvm/versions/node/v18.17.1/bin/node bin/dnc.js --dry-run 8005551234
```

Expected: `--dry-run` sets `result.success = false`, so `appendReport` is NOT called and "Report updated:" does NOT print. This is correct — dry runs don't produce real filings.

- [ ] **Step 4: Commit**

```bash
git add bin/dnc.js
git commit -m "feat: append to markdown report after each successful filing"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `do-not-call-reports.md` in user-configured directory | Tasks 3, 4 (`getReportPath`, `reportDir` config) |
| All report information included in the file | Task 4 (`formatEntry` includes all fields) |
| Check for duplicate before filing | Task 6 |
| Warn and ask to continue if duplicate | Task 6 |
| Generate report from JSONL (`--generate-report`) | Tasks 4, 5 |
| Report updated message after filing | Task 7 |
| `--help` flag | Task 1 |
| Expand JSONL record for full regeneration | Task 2 |

All spec requirements covered. No placeholders. Type/function names consistent across all tasks.
