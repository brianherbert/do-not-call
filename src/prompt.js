// src/prompt.js
import { input, select } from '@inquirer/prompts';
import { CALL_TOPICS } from './constants.js';

export function normalizePhone(raw) {
  return raw.replace(/\D/g, '');
}

export function isValidPhone(raw) {
  return normalizePhone(raw).length === 10;
}

function formatDate(d) {
  return [
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
}

function formatTime(d) {
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':');
}

function displaySummary(complaint) {
  console.log('\n── Complaint Summary ───────────────────────────');
  console.log(`  Caller phone:  ${complaint.callerPhone}`);
  console.log(`  Call date:     ${complaint.callDate} at ${complaint.callTime}`);
  console.log(`  Call type:     ${complaint.callType}`);
  console.log(`  Call topic:    ${complaint.callTopic}`);
  console.log(`  Your phone:    ${complaint.myPhone}`);
  console.log(`  Your name:     ${complaint.firstName} ${complaint.lastName}`);
  console.log(`  Email:         ${complaint.email}`);
  console.log(`  Address:       ${complaint.address}, ${complaint.city}, ${complaint.state} ${complaint.zip}`);
  console.log(`  On DNC list:   ${complaint.registeredOnDNC ? 'Yes' : 'No'}`);
  console.log(`  Comment:       ${complaint.comment}`);
  console.log('────────────────────────────────────────────────\n');
}

async function editFields(complaint) {
  return {
    ...complaint,
    myPhone: normalizePhone(await input({ message: 'Your phone:', default: complaint.myPhone })),
    firstName: await input({ message: 'First name:', default: complaint.firstName }),
    lastName: await input({ message: 'Last name:', default: complaint.lastName }),
    email: await input({ message: 'Email:', default: complaint.email }),
    address: await input({ message: 'Address:', default: complaint.address }),
    city: await input({ message: 'City:', default: complaint.city }),
    state: await input({ message: 'State:', default: complaint.state }),
    zip: await input({ message: 'ZIP:', default: complaint.zip }),
    callType: await select({
      message: 'Call type:',
      choices: [
        { name: 'Robocall (recorded message)', value: 'robocall' },
        { name: 'Live person', value: 'live' },
      ],
      default: complaint.callType,
    }),
    callTopic: await select({
      message: 'Call topic:',
      choices: CALL_TOPICS.map(t => ({ name: t, value: t })),
      default: complaint.callTopic,
    }),
    comment: await input({ message: 'Comment:', default: complaint.comment }),
  };
}

export async function promptComplaint(config, phoneArg) {
  let callerPhone = phoneArg ? normalizePhone(phoneArg) : '';

  if (!isValidPhone(callerPhone)) {
    const raw = await input({
      message: 'Phone number that called you:',
      validate: v => isValidPhone(v) || 'Enter a valid 10-digit phone number',
    });
    callerPhone = normalizePhone(raw);
  }

  const now = new Date();
  let complaint = {
    callerPhone,
    callDate: formatDate(now),
    callTime: formatTime(now),
    myPhone: config.myPhone,
    firstName: config.firstName,
    lastName: config.lastName,
    email: config.email,
    address: config.address,
    city: config.city,
    state: config.state,
    zip: config.zip,
    callType: config.callType,
    callTopic: config.callTopic,
    comment: config.comment,
    registeredOnDNC: config.registeredOnDNC,
  };

  while (true) {
    displaySummary(complaint);
    const action = await select({
      message: 'Submit with these details?',
      choices: [
        { name: 'Yes', value: 'yes' },
        { name: 'Edit fields', value: 'edit' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'yes') return complaint;
    if (action === 'cancel') {
      console.log('Cancelled. No complaint was filed.');
      process.exit(0);
    }
    complaint = await editFields(complaint);
  }
}
