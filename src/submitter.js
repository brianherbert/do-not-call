// src/submitter.js
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/*
DISCOVERED SELECTORS (verified 2026-05-11):
  Form URL:             https://donotcall.gov/report.html
  Intro continue:       #MainContinueButton

  Step 1 (#step1):
    Your phone:         #PhoneTextBox
    Date of call:       #DateOfCallTextBox  (MM/DD/YYYY text input)
    Hour dropdown:      #TimeOfCallDropDownList  (values "00"–"23")
    Minute dropdown:    #ddlMinutes  (values "00"–"59")
    Robocall yes:       #PrerecordMessageYESRadioButton
    Robocall no:        #PrerecordMessageNORadioButton
    Phone call radio:   #PhoneCallRadioButton  (always select)
    Subject:            #ddlSubjectMatter  (select by exact option text)
    Subject other:      #txtSubjectMatter  (visible only when "Other" selected)
    Continue:           #StepOneContinueButton

  Step 2 (#step2):
    Caller phone:       #CallerPhoneNumberTextBox
    First name:         #FirstNameTextBox
    Last name:          #LastNameTextBox
    Address:            #StreetAddressTextBox
    City:               #CityTextBox
    State:              #StateDropDownList  (2-letter code values)
    ZIP:                #ZipCodeTextBox
    Comment:            #CommentTextBox  (textarea)
    No business rel:    #HaveBusinessNoRadioButton
    No stop-call req:   #StopCallingNoRadioButton
    Submit:             #StepTwoSubmitButton
*/

const SCREENSHOT_DIR = './screenshots';

function screenshotFilename() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return join(SCREENSHOT_DIR, `dnc-${ts}.png`);
}

export async function submitComplaint(complaint, { dryRun = false, headed = false } = {}) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const shotPath = screenshotFilename();
  const timestamp = new Date().toISOString();

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  try {
    // Step 0: Land on intro page and click Continue
    console.log('⏳ Opening donotcall.gov...');
    await page.goto('https://donotcall.gov/report.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#MainContinueButton').click();
    await page.waitForSelector('#PhoneTextBox', { timeout: 10000 });

    // Step 1: Fill call details + your phone
    console.log('⏳ Completing step 1 of 2...');

    await page.locator('#PhoneTextBox').fill(complaint.myPhone);
    await page.locator('#DateOfCallTextBox').fill(complaint.callDate);

    // Time is split into hour + minute selects
    const [callHour, callMinute] = complaint.callTime.split(':');
    await page.locator('#TimeOfCallDropDownList').selectOption(callHour);
    await page.locator('#ddlMinutes').selectOption(callMinute);

    // Robocall radio
    if (complaint.callType === 'robocall') {
      await page.locator('#PrerecordMessageYESRadioButton').check();
    } else {
      await page.locator('#PrerecordMessageNORadioButton').check();
    }

    // Always mark as Phone Call (not Mobile Text Message)
    await page.locator('#PhoneCallRadioButton').check();

    // Subject/topic — select by exact option label text
    await page.locator('#ddlSubjectMatter').selectOption({ label: complaint.callTopic });

    // "Other" reveals a free-text description field
    if (complaint.callTopic === 'Other' && complaint.callTopicOther) {
      await page.locator('#txtSubjectMatter').waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#txtSubjectMatter').fill(complaint.callTopicOther);
    }

    // Click Continue to Step 2
    await page.locator('#StepOneContinueButton').click();
    await page.waitForSelector('#CallerPhoneNumberTextBox', { timeout: 10000 });

    // Step 2: Caller info + personal info
    console.log('⏳ Completing step 2 of 2...');

    await page.locator('#CallerPhoneNumberTextBox').fill(complaint.callerPhone);
    await page.locator('#FirstNameTextBox').fill(complaint.firstName);
    await page.locator('#LastNameTextBox').fill(complaint.lastName);
    await page.locator('#StreetAddressTextBox').fill(complaint.address);
    await page.locator('#CityTextBox').fill(complaint.city);
    await page.locator('#StateDropDownList').selectOption(complaint.state);
    await page.locator('#ZipCodeTextBox').fill(complaint.zip);
    await page.locator('#CommentTextBox').fill(complaint.comment);

    // Answer the optional radios — no business relationship, didn't ask them to stop
    await page.locator('#HaveBusinessNoRadioButton').check();
    await page.locator('#StopCallingNoRadioButton').check();

    if (dryRun) {
      console.log('🔍 Dry run — saving screenshot of filled form, not submitting.');
      await page.screenshot({ path: shotPath, fullPage: true });
      await browser.close();
      return {
        success: false,
        error: 'Dry run — form was filled but not submitted.',
        screenshotPath: shotPath,
        timestamp,
      };
    }

    // Submit
    await page.locator('#StepTwoSubmitButton').click();

    // Wait for the loading screen to clear and the confirmation content to appear.
    // 'networkidle' waits until there are no in-flight requests for 500ms, which
    // means the server has finished responding and the final page is rendered.
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Parse confirmation
    const confirmationText = await page.locator('h1, h2, .confirmation-message, [class*="success"]')
      .first()
      .textContent({ timeout: 10000 })
      .catch(() => 'Complaint submitted.');

    await page.screenshot({ path: shotPath, fullPage: true });
    await browser.close();

    const success = /thank you|received|confirmation|complaint.*filed|submitted/i.test(confirmationText ?? '');

    return {
      success,
      confirmationText: confirmationText?.trim() ?? '',
      screenshotPath: shotPath,
      timestamp,
    };

  } catch (err) {
    const captchaPresent = await page
      .locator('[class*="captcha"], iframe[src*="captcha"], iframe[src*="recaptcha"]')
      .count()
      .then(n => n > 0)
      .catch(() => false);

    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    await browser.close().catch(() => {});

    if (captchaPresent || /captcha|recaptcha/i.test(err.message ?? '')) {
      return {
        success: false,
        error: 'CAPTCHA detected — complete manually at donotcall.gov',
        screenshotPath: shotPath,
        timestamp,
      };
    }

    return {
      success: false,
      error: err.message,
      screenshotPath: shotPath,
      timestamp,
    };
  }
}
