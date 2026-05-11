// scripts/inspect.js
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();

console.log('Navigating to donotcall.gov...');
await page.goto('https://donotcall.gov');

console.log('\nPlaywright Inspector open. Navigate the complaint form and record selectors.');
await page.pause();
await browser.close();
