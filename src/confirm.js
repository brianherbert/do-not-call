import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function renderScreenshot(shotPath) {
  // iTerm2 inline image protocol — renders the actual PNG inline
  if (process.env.TERM_PROGRAM === 'iTerm.app') {
    try {
      const data = await readFile(shotPath);
      const b64 = data.toString('base64');
      process.stdout.write(`\x1b]1337;File=inline=1;width=100%;preserveAspectRatio=1:${b64}\x07\n`);
      return;
    } catch {}
  }

  // chafa — high-quality Unicode/ASCII art, works in most terminals
  try {
    const cols = process.stdout.columns || 120;
    const { stdout } = await execFileAsync('chafa', [`--size=${cols}x40`, shotPath]);
    process.stdout.write(stdout);
    return;
  } catch {}

  console.log('(Install chafa via `brew install chafa` to preview screenshots in terminal)');
}

export function showResult(result) {
  console.log('');
  if (result.success) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅  COMPLAINT FILED SUCCESSFULLY        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('Submitted at: ' + new Date(result.timestamp).toLocaleString());
    console.log('Confirmation: ' + result.confirmationText);
    console.log('Screenshot:   ' + result.screenshotPath);
  } else {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ❌  SUBMISSION FAILED                   ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('Reason:      ' + result.error);
    console.log('Screenshot:  ' + result.screenshotPath);
    console.log('');
    console.log('→ You can file manually at: https://donotcall.gov');
  }
  console.log('');
}
