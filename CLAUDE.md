# DNC Complaint Filer — Claude Code Project

## Environment

- **Node binary:** `~/.nvm/versions/node/v18.17.1/bin/node` — `node` is not in PATH; use the full path for all `node`/`npm` commands
- **Run tests:** `~/.nvm/versions/node/v18.17.1/bin/node --test tests/*.test.js`
- **npm link** must be re-run any time the user switches nvm version, or `dnc` won't resolve in their shell

---

## Project Goal

Build a command-line tool (`dnc`) that automates filing Do Not Call complaints to the FTC at `https://donotcall.gov`. Because the FTC provides **no submission API**, the tool uses headless browser automation (Playwright) to drive the web form.

The user runs a single command, types the offending phone number, confirms the pre-filled data, and the tool submits the complaint and confirms success.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js** (≥18) | Built-in fetch, no Python env needed |
| Browser automation | **Playwright** (`playwright`) | Reliable, headless Chromium, stable selectors |
| CLI prompts | **`@inquirer/prompts`** | Minimal, actively maintained successor to Inquirer.js |
| Config storage | **JSON file** in `~/.config/dnc/config.json` | No database needed |
| Confirmation | Screenshot + console output | Visual proof of success page |

**Total runtime dependencies: 2** (`playwright`, `@inquirer/prompts`)

---

## Project Structure

```
dnc-filer/
├── CLAUDE.md
├── package.json
├── bin/
│   └── dnc.js             ← CLI entry point (chmod +x)
├── src/
│   ├── constants.js       ← CALL_TOPICS array (must match exact option text in #ddlSubjectMatter)
│   ├── config.js          ← load/save/edit config from ~/.config/dnc/config.json
│   ├── prompt.js          ← interactive prompts (caller number + confirm pre-fills)
│   ├── submitter.js       ← Playwright automation that fills & submits the form
│   ├── confirm.js         ← result display + inline screenshot rendering
│   └── history.js         ← append/read JSONL history at ~/.config/dnc/history.jsonl
├── scripts/
│   └── inspect.js         ← headed Playwright session for selector debugging
├── tests/
│   ├── config.test.js
│   ├── confirm.test.js
│   ├── prompt.test.js
│   └── history.test.js
└── screenshots/           ← auto-created; timestamped PNGs saved here
```

---

## package.json

```json
{
  "name": "dnc-filer",
  "version": "1.0.0",
  "description": "CLI to file FTC Do Not Call complaints",
  "type": "module",
  "bin": {
    "dnc": "./bin/dnc.js"
  },
  "scripts": {
    "setup": "playwright install chromium",
    "start": "node bin/dnc.js"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "playwright": "^1.45.0"
  }
}
```

---

## Config Schema (`~/.config/dnc/config.json`)

```json
{
  "myPhone": "5025550100",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "address": "123 Main St",
  "city": "Louisville",
  "state": "KY",
  "zip": "40202",
  "callType": "robocall",
  "callTopic": "Warranties & protection plans",
  "comment": "Repeated robocall, multiple times per day. Number spoofed each time.",
  "registeredOnDNC": true
}
```

All fields are editable interactively via `dnc --config`.

---

## CLI Entry Point (`bin/dnc.js`)

```js
#!/usr/bin/env node
import { loadConfig, firstRunSetup } from '../src/config.js';
import { promptComplaint } from '../src/prompt.js';
import { submitComplaint } from '../src/submitter.js';
import { showResult } from '../src/confirm.js';

const args = process.argv.slice(2);

if (args.includes('--config')) {
  await firstRunSetup();
  process.exit(0);
}

const config = await loadConfig();
const complaint = await promptComplaint(config, args[0]);  // args[0] = optional phone number
const result = await submitComplaint(complaint);
showResult(result);
```

---

## `src/config.js`

- On first run (config file missing), call `firstRunSetup()` to walk through all fields interactively and save.
- `loadConfig()` reads the JSON; if missing, automatically triggers `firstRunSetup()`.
- `firstRunSetup()` uses `@inquirer/prompts` `input` and `select` to collect every field.
- After saving, print: `✅ Config saved to ~/.config/dnc/config.json`

---

## `src/prompt.js` — `promptComplaint(config, phoneArg)`

Show the user what will be submitted and let them override anything before submitting.

Flow:
1. If `phoneArg` is provided and is a valid 10-digit number (after stripping non-digits), skip asking for it. Otherwise prompt for it with validation.
2. Set `callDate` to **right now** (`new Date()` formatted as `MM/DD/YYYY HH:mm`).
3. Show a summary of all pre-configured fields.
4. Ask: `"Submit with these details? [Yes / Edit fields / Cancel]"`
   - **Yes** → return the complaint object.
   - **Edit fields** → loop through all editable fields using `@inquirer/prompts` with current values as defaults, then re-show summary.
   - **Cancel** → exit with message `Cancelled. No complaint was filed.`

Return object shape:
```js
{
  callerPhone: "8005551234",
  callDate: "05/11/2025",      // MM/DD/YYYY
  callTime: "14:32",           // HH:MM 24h
  myPhone: "5025550100",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",   // stored in config but not used by form (no email field)
  address: "123 Main St",
  city: "Louisville",
  state: "KY",
  zip: "40202",
  callType: "robocall",        // "robocall" | "live"
  callTopic: "Warranties & protection plans",
  callTopicOther: "",          // filled only when callTopic === "Other"
  comment: "...",
  registeredOnDNC: true        // stored in config but not used by form (no checkbox)
}
```

---

## `src/submitter.js` — `submitComplaint(complaint)`

Use Playwright with **headless Chromium** to automate `https://donotcall.gov`.

### Navigation flow (verified 2026-05-11)

Form URL: `https://donotcall.gov/report.html`

**Step 0 — Intro page:**
- Click `#MainContinueButton`, wait for `#PhoneTextBox`

**Step 1 (`#step1`) — Call details + your phone:**

| Field | Selector | Notes |
|---|---|---|
| Your phone | `#PhoneTextBox` | YOUR number (the one that was called) |
| Date of call | `#DateOfCallTextBox` | text input, MM/DD/YYYY |
| Hour of call | `#TimeOfCallDropDownList` | select, values `"00"`–`"23"` |
| Minute of call | `#ddlMinutes` | select, values `"00"`–`"59"` |
| Robocall yes | `#PrerecordMessageYESRadioButton` | |
| Robocall no | `#PrerecordMessageNORadioButton` | |
| Phone call type | `#PhoneCallRadioButton` | always check this |
| Subject | `#ddlSubjectMatter` | `selectOption({ label: complaint.callTopic })` |
| Subject (other) | `#txtSubjectMatter` | only visible after selecting "Other"; maxlength 50 |
| Continue | `#StepOneContinueButton` | type=submit |

**Step 2 (`#step2`) — Caller info + personal info:**

| Field | Selector | Notes |
|---|---|---|
| Caller's phone | `#CallerPhoneNumberTextBox` | the number that called YOU |
| First name | `#FirstNameTextBox` | |
| Last name | `#LastNameTextBox` | |
| Address | `#StreetAddressTextBox` | |
| City | `#CityTextBox` | |
| State | `#StateDropDownList` | select, 2-letter code values |
| ZIP | `#ZipCodeTextBox` | |
| Comment | `#CommentTextBox` | textarea |
| No business rel | `#HaveBusinessNoRadioButton` | always No |
| No stop-call req | `#StopCallingNoRadioButton` | always No |
| Submit | `#StepTwoSubmitButton` | type=submit |

**No email field and no DNC registry checkbox exist on the form.**

**Step 5 — Return result:**
```js
return {
  success: boolean,
  confirmationText: string,   // text from success/error page
  screenshotPath: string,     // path to saved screenshot
  timestamp: string           // ISO timestamp
}
```

### Error handling
- Wrap everything in try/catch.
- On any error: take a screenshot, save it, and return `{ success: false, error: message, screenshotPath }`.
- If a CAPTCHA is encountered: return `{ success: false, error: "CAPTCHA detected — complete manually at donotcall.gov", screenshotPath }`.
- Timeouts: use `page.waitForSelector` with 15s timeout; catch `TimeoutError` and report cleanly.

### Screenshot
- Always save a screenshot to `./screenshots/dnc-YYYY-MM-DD-HHmmss.png` whether success or failure.
- Use `page.screenshot({ fullPage: true })`.

---

## `src/confirm.js` — `showResult(result)`

Print a formatted result to the terminal:

**On success:**
```
╔══════════════════════════════════════════╗
║  ✅  COMPLAINT FILED SUCCESSFULLY        ║
╚══════════════════════════════════════════╝

Submitted at: 2025-05-11 14:32:07
Confirmation: [text from FTC page]
Screenshot:   ./screenshots/dnc-2025-05-11-143207.png
```

**On failure:**
```
╔══════════════════════════════════════════╗
║  ❌  SUBMISSION FAILED                   ║
╚══════════════════════════════════════════╝

Reason:      [error message]
Screenshot:  ./screenshots/dnc-2025-05-11-143207.png

→ You can file manually at: https://donotcall.gov
```

---

## `src/history.js`

Appends each submission (success or failure) to `~/.config/dnc/history.jsonl` as a newline-delimited JSON record. `dnc --history` displays the last 20 entries in a table. Uses `DNC_HISTORY_PATH` env var to override path in tests.

---

## Setup & Install Instructions (for README)

```bash
git clone <repo>
cd dnc-filer
npm install
npm run setup       # installs Chromium via Playwright
npm link            # makes `dnc` available system-wide

# First run — configure your details:
dnc --config

# File a complaint:
dnc 8005551234

# Or just run and be prompted:
dnc
```

---

## Development Notes for Claude Code

1. **Selectors are verified** — see the table above and the comment block at the top of `src/submitter.js`. If the FTC changes their form, run `npm run inspect` to open a headed session and re-discover them.

2. **Date is a plain text input** (not a date picker). Fill it with `MM/DD/YYYY` string directly. Time is two separate `<select>` elements (hour + minute), not a time input.

3. **CALL_TOPICS in `src/constants.js` must exactly match the option text in `#ddlSubjectMatter`** — the submitter uses `selectOption({ label })`. If topics drift, the select will throw.

4. **`--dry-run`** fills the entire form and saves a screenshot but stops before clicking `#StepTwoSubmitButton`. Always use this when testing. Never submit to a live government form with test data.

5. **`--headed`** opens a visible browser window — use for debugging selector failures.

6. **Screenshot rendering** (`src/confirm.js` → `renderScreenshot`): tries iTerm2 inline protocol first (`TERM_PROGRAM === 'iTerm.app'`), then `chafa` (`brew install chafa`), then prints a hint. Called automatically after every run.

7. **Do NOT use `page.evaluate()` to bypass form interactions.** Fill fields as a real user would.

---

## Caveats / Known Challenges

- The FTC website form structure may change. If selectors break, run `dnc --headed` to debug visually.
- CAPTCHA: If the FTC adds CAPTCHA enforcement, the tool will detect and report it rather than fail silently.
- The tool submits one complaint per invocation. Running it back-to-back rapidly may trigger rate limiting on the FTC's end — this is expected behavior for a legitimate complaint tool.
