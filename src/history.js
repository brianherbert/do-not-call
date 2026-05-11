// src/history.js
import { appendFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HISTORY_PATH = process.env.DNC_HISTORY_PATH
  ?? join(homedir(), '.config', 'dnc', 'history.jsonl');

export async function appendHistory(record) {
  await appendFile(HISTORY_PATH, JSON.stringify(record) + '\n');
}

export async function readHistory(limit = 20) {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function showHistory() {
  const entries = await readHistory();
  if (entries.length === 0) {
    console.log('No complaint history found.');
    return;
  }
  console.log('\n── Complaint History (last 20) ───────────────────────────────────────');
  console.log('  Date/Time              Status    Caller Phone');
  console.log('  ─────────────────────  ────────  ──────────────');
  for (const e of entries) {
    const ts = new Date(e.timestamp).toLocaleString().padEnd(21);
    const status = (e.success ? '✅ Filed ' : '❌ Failed').padEnd(8);
    const phone = e.callerPhone ?? '—';
    console.log(`  ${ts}  ${status}  ${phone}`);
  }
  console.log('');
}
