# Design: Markdown Reports + Duplicate Detection

**Date:** 2026-05-20
**Status:** Approved

---

## Overview

Add a human-readable `do-not-call-reports.md` file that records every successfully filed complaint. Before each submission, check whether the caller's number has been filed before and warn the user if so. The JSONL history remains the authoritative data source; the markdown file is a generated artifact.

---

## Goals

- Produce a portable, human-readable report of all filed complaints
- Detect duplicate filings and prompt the user to confirm before proceeding
- Allow regenerating the markdown from JSONL at any time so the report is always accurate
- Expose all CLI options via `--help`

---

## Non-Goals

- Replacing `history.jsonl` (both files coexist with different audiences)
- A terminal command to display the report (user opens the `.md` file directly)
- Recording failed submission attempts in the report

---

## Section 1 — Data Model Changes

### 1a. Expand JSONL record

`appendHistory` currently stores a thin slice. Extend it to include the full complaint so the JSONL is sufficient to regenerate the report without loss of information.

New record shape (written to `~/.config/dnc/history.jsonl`):

```json
{
  "success": true,
  "timestamp": "2026-05-11T14:32:07.000Z",
  "screenshotPath": "./screenshots/dnc-2026-05-11-143207.png",
  "callerPhone": "8005551234",
  "callDate": "05/11/2026",
  "callTime": "14:32",
  "callType": "robocall",
  "callTopic": "Warranties & protection plans",
  "callTopicOther": "",
  "myPhone": "5025550100",
  "firstName": "Jane",
  "lastName": "Doe",
  "address": "123 Main St",
  "city": "Louisville",
  "state": "KY",
  "zip": "40202",
  "comment": "Repeated robocall...",
  "error": null
}
```

Existing JSONL records with only the old fields remain valid — `generateReport` skips records with `success: false` and renders whatever fields are present.

### 1b. New config field: `reportDir`

Added to `config.json`. Defaults to `~/.config/dnc/` if absent (backward compatible). The file is always named `do-not-call-reports.md`.

```json
{
  "reportDir": "~/.config/dnc/"
}
```

Users change this via `dnc --config`.

---

## Section 2 — New `src/report.js` Module

```
getReportPath(config)      → resolves reportDir + "do-not-call-reports.md"
checkDuplicate(callerPhone) → reads history.jsonl, returns most recent success:true match or null
appendReport(record, config) → appends one formatted entry to the .md file (creates file+header if missing)
generateReport(config)      → reads all history.jsonl, filters success:true, rewrites entire .md from scratch
```

`generateReport` is the single rendering path used by `--generate-report`. `appendReport` checks whether the file exists: if not, it writes the header then the first entry; if it exists, it appends the new entry directly. No full rewrite on every filing.

`checkDuplicate` reads `history.jsonl` directly — not the markdown — so it is always authoritative even if the `.md` is missing or stale.

---

## Section 3 — Duplicate Detection Flow

Duplicate check runs in `bin/dnc.js` after the user confirms the complaint details but before `submitComplaint` is called:

```
1. User enters/confirms caller number
2. checkDuplicate(callerPhone)
3a. No match → proceed to submission
3b. Match found:
      ⚠️  You've already filed a complaint against (800) 555-1234 on 2026-05-11.
      File again anyway? [Yes / Cancel]
      Yes    → proceed to submission
      Cancel → exit cleanly ("Cancelled. No complaint was filed.")
```

If a number has been filed multiple times, the most recent successful filing date is shown.

---

## Section 4 — CLI Changes

### New `--generate-report` flag

Reads all of `history.jsonl`, filters to `success: true` records, and writes the full `do-not-call-reports.md` from scratch. Prints the output path on completion. Safe to run at any time.

```
$ dnc --generate-report
✅ Report written to ~/.config/dnc/do-not-call-reports.md (12 entries)
```

### Updated `--config` flow

The `reportDir` field is added to the interactive config editor so users can specify a custom directory.

### Post-filing output

After every successful filing, `appendReport` is called (fire-and-forget, failure never crashes the main flow). The report path is printed below the existing success output:

```
Report updated: ~/.config/dnc/do-not-call-reports.md
```

### New `--help` flag

```
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
```

---

## Section 5 — Markdown Report Format

The file has a static header written once on creation, followed by chronological entries separated by horizontal rules.

```markdown
# Do Not Call Complaints

> Auto-generated by `dnc`. To rebuild from history, run `dnc --generate-report`.

---

## 2026-05-11 14:32 — (800) 555-1234

- **Filed:** 2026-05-11 14:32:07
- **Caller number:** (800) 555-1234
- **Call date:** 05/11/2026 14:32
- **Call type:** Robocall
- **Topic:** Warranties & protection plans
- **My number:** (502) 555-0100
- **Name:** Jane Doe
- **Address:** 123 Main St, Louisville, KY 40202
- **Comment:** Repeated robocall, multiple times per day.
- **Screenshot:** ./screenshots/dnc-2026-05-11-143207.png

---
```

- Heading format: `## YYYY-MM-DD HH:MM — (NXX) NXX-XXXX`
- Entries are newest-last
- `--generate-report` produces this exact format, so appended and regenerated entries are always identical

---

## Files Changed

| File | Change |
|------|--------|
| `src/history.js` | Expand `appendHistory` to accept and store full complaint fields |
| `src/config.js` | Add `reportDir` field to `firstRunSetup` and config editor |
| `src/report.js` | **New** — `getReportPath`, `checkDuplicate`, `appendReport`, `generateReport` |
| `bin/dnc.js` | Add duplicate check, `--generate-report` flag, `--help` flag, call `appendReport` after success |
| `tests/report.test.js` | **New** — unit tests for all four functions |
