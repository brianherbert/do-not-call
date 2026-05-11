#!/usr/bin/env node
// bin/dnc.js
import { emitKeypressEvents } from 'node:readline';
import { loadConfig, firstRunSetup } from '../src/config.js';
import { promptComplaint } from '../src/prompt.js';
import { submitComplaint } from '../src/submitter.js';
import { showResult, renderScreenshot } from '../src/confirm.js';
import { appendHistory, showHistory } from '../src/history.js';

// Escape key exits cleanly from any prompt
emitKeypressEvents(process.stdin);
process.stdin.on('keypress', (_ch, key) => {
  if (key?.name === 'escape') {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    console.log('\nCancelled.');
    process.exit(0);
  }
});

function cancelled(err) {
  // ExitPromptError is thrown by @inquirer/prompts on Ctrl+C
  if (err?.name === 'ExitPromptError') {
    console.log('\nCancelled.');
    process.exit(0);
  }
  throw err;
}

const args = process.argv.slice(2);

if (args.includes('--config')) {
  await firstRunSetup().catch(cancelled);
  process.exit(0);
}

if (args.includes('--history')) {
  await showHistory();
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const headed = args.includes('--headed');
const phoneArg = args.find(a => !a.startsWith('--'));

const config = await loadConfig().catch(cancelled);
const complaint = await promptComplaint(config, phoneArg).catch(cancelled);
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
