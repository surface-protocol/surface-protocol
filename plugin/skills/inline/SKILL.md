---
name: surface:inline
description: |
  Lightweight inline requirement capture. Creates a test stub directly from a prompt
  without full /surface:capture ceremony. Use when user describes a quick requirement,
  small feature, or tweak in conversation. Produces the same output as /surface:capture
  (test stub with YAML metadata) but with minimal overhead.
  Triggers on: "add a requirement for...", "we need...", "capture this...", or when
  user describes a small feature inline.
version: 1.0.0
tags:
  - surface-protocol
  - requirements
  - lightweight
tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

# /surface:inline -- Lightweight Requirement Capture

Create a test stub directly from an inline prompt. No phases, no gap check, no report.

## When to Use

Use this instead of `/surface:capture` when:
- The requirement is simple and well-understood
- You're in the middle of a conversation and want to quickly capture something
- A single test stub is sufficient
- No GitHub issue or PRD is involved

Use `/surface:capture` when:
- Capturing from a PRD or GitHub issue (needs parsing)
- Multiple related requirements need capturing together
- Gap checking and conflict detection are needed

## Workflow

### 1. Determine Next REQ-ID

Read `surface.json` and find the highest existing REQ-ID number:

```bash
surface query --json 2>/dev/null | jq -r '.[] | .id' | sort -t- -k2 -n | tail -1
```

If that fails, grep surface.json for the highest ID:

```bash
grep -oP 'REQ-\d+' surface.json | sort -t- -k2 -n | tail -1
```

Increment by 1 for the new ID.

### 2. Determine Area and Location

- Infer `area` from the user's description (auth, checkout, landing, etc.)
- Check existing test files in the relevant test directory
- Place the new stub in the appropriate directory

### 3. Create Test Stub

Create a test file with YAML frontmatter:

```typescript
/*---
req: REQ-XXX
type: unit
status: pending
area: <area>
summary: <one-line summary from user prompt>
rationale: |
  <brief rationale inferred from context>
acceptance:
  - <criterion 1>
  - <criterion 2>
tags: [<relevant-tags>]
source:
  type: manual
  ref: "inline-capture"
changed:
  - date: <today YYYY-MM-DD>
    note: Inline capture
---*/
import { describe, it } from "vitest";

describe("REQ-XXX: <Summary>", () => {
  it.todo("<acceptance criterion 1>");
  it.todo("<acceptance criterion 2>");
});
```

### 4. Regenerate Surface Map

```bash
surface gen --quiet
```

### 5. Confirm to User

```
Captured REQ-XXX: <summary>
  Area: <area>
  File: <path>
  Acceptance: <N> criteria
  Status: stub

Run /surface:implement to implement, or continue working.
```

## Rules

- **One requirement per invocation.** For multiple, run multiple times or use `/surface:capture`.
- **Always regenerate** surface map after creating the stub.
- **Use `it.todo()`** for stub tests -- this is detected as `stub` lifecycle stage.
- **Keep acceptance criteria specific** and testable. Avoid vague criteria.
- **Infer tags** from the area and description. Include `user-facing` or `backend` as appropriate.
- **Do NOT add `Surface-Protocol: capture` trailer** -- that's for `/surface:capture`. Inline capture is meant to be lightweight and doesn't need commit ceremony.

## Examples

### User says: "we need email rate limiting"

Creates:
```
tests/auth/email-rate-limiting.test.ts
  REQ-044: Email rate limiting prevents abuse
  Acceptance: max 10 emails/hour, cooldown period, admin override
```

### User says: "add a requirement for CSV export"

Creates:
```
tests/orders/csv-export.test.ts
  REQ-045: Order data exportable as CSV
  Acceptance: includes all order fields, UTF-8 encoding, date range filter
```
