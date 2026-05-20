// src/config.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { input, select, confirm } from '@inquirer/prompts';
import { CALL_TOPICS } from './constants.js';

const CONFIG_PATH = process.env.DNC_CONFIG_PATH
  ?? join(homedir(), '.config', 'dnc', 'config.json');

export async function loadConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return firstRunSetup();
  }
}

export async function saveConfig(config) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('✅ Config saved to ' + CONFIG_PATH.replace(homedir(), '~'));
}

export async function firstRunSetup() {
  console.log('\nFirst run — enter your details (used for all future complaints).\n');

  const rawPhone = await input({
    message: 'Your phone number (10 digits):',
    validate: v => /^\d{10}$/.test(v.replace(/\D/g, '')) || 'Enter a valid 10-digit number',
  });

  const config = {
    myPhone: rawPhone.replace(/\D/g, ''),
    firstName: await input({ message: 'First name:' }),
    lastName: await input({ message: 'Last name:' }),
    email: await input({ message: 'Email address:' }),
    address: await input({ message: 'Street address:' }),
    city: await input({ message: 'City:' }),
    state: await input({ message: 'State (2-letter code):' }),
    zip: await input({ message: 'ZIP code:' }),
    callType: await select({
      message: 'Typical call type:',
      choices: [
        { name: 'Robocall (recorded message)', value: 'robocall' },
        { name: 'Live person', value: 'live' },
      ],
    }),
    callTopic: await select({
      message: 'Typical call topic:',
      choices: CALL_TOPICS.map(t => ({ name: t, value: t })),
    }),
    comment: await input({ message: 'Default complaint comment:' }),
    registeredOnDNC: await confirm({
      message: 'Is your number registered on the Do Not Call list?',
      default: true,
    }),
    reportDir: await input({
      message: 'Directory for do-not-call-reports.md:',
      default: join(homedir(), '.config', 'dnc'),
    }),
  };

  await saveConfig(config);
  return config;
}
