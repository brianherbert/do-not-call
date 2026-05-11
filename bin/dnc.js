#!/usr/bin/env node
// bin/dnc.js
import { loadConfig, firstRunSetup } from '../src/config.js';
import { promptComplaint } from '../src/prompt.js';
import { submitComplaint } from '../src/submitter.js';
import { showResult, renderScreenshot } from '../src/confirm.js';
import { appendHistory, showHistory } from '../src/history.js';

const args = process.argv.slice(2);

if (args.includes('--config')) {
  await firstRunSetup();
  process.exit(0);
}

if (args.includes('--history')) {
  await showHistory();
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const headed = args.includes('--headed');
const phoneArg = args.find(a => !a.startsWith('--'));

const config = await loadConfig();
const complaint = await promptComplaint(config, phoneArg);
const result = await submitComplaint(complaint, { dryRun, headed });
showResult(result);
await renderScreenshot(result.screenshotPath).catch(() => {});

await appendHistory({
  success: result.success,
  callerPhone: complaint.callerPhone,
  timestamp: result.timestamp,
  screenshotPath: result.screenshotPath,
  error: result.error ?? null,
}).catch(() => {}); // history failure must never crash the main flow
