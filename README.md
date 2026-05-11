# Do Not Call Complaint Filer

A command-line tool that files FTC Do Not Call complaints for you. You give it the phone number that called you, confirm your details, and it fills out the form at donotcall.gov automatically.

## Requirements

- Node.js 18 or newer
- Mac or Linux

## Setup

```bash
git clone https://github.com/brianherbert/do-not-call.git
cd do-not-call
npm install
npm run setup       # downloads the browser used for automation
npm link            # makes the `dnc` command available anywhere

dnc --config        # enter your details (only needed once)
```

## Usage

```bash
# File a complaint — pass the number that called you:
dnc 8005551234

# Or run without a number and it will ask:
dnc

# Preview what would be submitted without actually submitting:
dnc --dry-run 8005551234

# View your complaint history:
dnc --history

# Update your saved details:
dnc --config
```

## How it works

1. You run `dnc` with the phone number that called you
2. It shows you all the details it's about to submit (your name, address, call type, etc.)
3. You confirm — or edit anything that needs changing
4. It opens an invisible browser, fills out the FTC's form at donotcall.gov, and submits it
5. It saves a screenshot of the confirmation page to the `screenshots/` folder

## Your details are stored at

```
~/.config/dnc/config.json
```

Edit this file directly or run `dnc --config` to update it interactively.

## Troubleshooting

**Something went wrong with the form?**
Run with `--headed` to watch the browser fill it out in real time:
```bash
dnc --headed 8005551234
```

**The FTC changed their form and nothing works?**
```bash
npm run inspect     # opens the browser with a debugger so you can poke around
```
