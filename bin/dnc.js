#!/Users/brianherbert/.nvm/versions/node/v18.17.1/bin/node
// bin/dnc.js
import { emitKeypressEvents } from 'node:readline';
import { homedir } from 'node:os';
import { confirm } from '@inquirer/prompts';
import { loadConfig, firstRunSetup } from '../src/config.js';
import { promptComplaint } from '../src/prompt.js';
import { submitComplaint } from '../src/submitter.js';
import { showResult, renderScreenshot } from '../src/confirm.js';
import { appendHistory, showHistory } from '../src/history.js';
import { checkDuplicate, appendReport, generateReport, getReportPath } from '../src/report.js';

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

if (args.includes('--config')) {
  await firstRunSetup().catch(cancelled);
  process.exit(0);
}

if (args.includes('--history')) {
  await showHistory();
  process.exit(0);
}

if (args.includes('--generate-report')) {
  const config = await loadConfig().catch(cancelled);
  const { path, count } = await generateReport(config);
  console.log(`✅ Report written to ${path.replace(homedir(), '~')} (${count} ${count === 1 ? 'entry' : 'entries'})`);
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const headed = args.includes('--headed');
const phoneArg = args.find(a => !a.startsWith('--'));

const config = await loadConfig().catch(cancelled);
const complaint = await promptComplaint(config, phoneArg).catch(cancelled);

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

const result = await submitComplaint(complaint, { dryRun, headed });
showResult(result);
await renderScreenshot(result.screenshotPath).catch(() => {});

await appendHistory({
  success: result.success,
  timestamp: result.timestamp,
  screenshotPath: result.screenshotPath,
  error: result.error ?? null,
  ...complaint,
}).catch(() => {}); // history failure must never crash the main flow

if (result.success) {
  await appendReport(
    { success: result.success, timestamp: result.timestamp, screenshotPath: result.screenshotPath, error: result.error ?? null, ...complaint },
    config,
  ).catch(() => {});
  console.log('Report updated: ' + getReportPath(config).replace(homedir(), '~'));
}
