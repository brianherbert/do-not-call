import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function findBin(name) {
  for (const p of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, name]) {
    try {
      await execFileAsync(p, ['--version']);
      return p;
    } catch {}
  }
  return null;
}

async function renderKitty(shotPath) {
  const data = await readFile(shotPath);
  const b64 = data.toString('base64');
  const CHUNK = 4096;
  for (let i = 0; i < b64.length; i += CHUNK) {
    const chunk = b64.slice(i, i + CHUNK);
    const more = i + CHUNK < b64.length ? 1 : 0;
    const header = i === 0 ? `a=T,f=100,m=${more}` : `m=${more}`;
    process.stdout.write(`\x1b_G${header};${chunk}\x1b\\`);
  }
  process.stdout.write('\n');
}

export async function renderScreenshot(shotPath) {
  // iTerm2 inline image protocol
  if (process.env.TERM_PROGRAM === 'iTerm.app') {
    try {
      const data = await readFile(shotPath);
      const b64 = data.toString('base64');
      process.stdout.write(`\x1b]1337;File=inline=1;width=100%;preserveAspectRatio=1:${b64}\x07\n`);
      return;
    } catch {}
  }

  // Kitty graphics protocol — supported by Ghostty and Kitty terminal
  if (process.env.TERM_PROGRAM === 'ghostty' || process.env.TERM === 'xterm-kitty') {
    try {
      await renderKitty(shotPath);
      return;
    } catch {}
  }

  // chafa — Unicode/ASCII art fallback; look up full path since brew isn't always in PATH
  const chafa = await findBin('chafa');
  if (chafa) {
    try {
      const cols = process.stdout.columns || 120;
      const { stdout } = await execFileAsync(chafa, [`--size=${cols}x40`, shotPath]);
      process.stdout.write(stdout);
      return;
    } catch {}
  }

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
    console.log('Reason:      ' + (result.error ?? 'Unknown — check the screenshot'));
    console.log('Screenshot:  ' + result.screenshotPath);
    console.log('');
    console.log('→ You can file manually at: https://donotcall.gov');
  }
  console.log('');
}
