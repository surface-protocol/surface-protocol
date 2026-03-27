---
name: surface:backfill
description: |
  Auto-annotate untracked tests with inferred YAML metadata.
  Use to bootstrap Surface Protocol on an existing codebase, or to catch up
  after building features outside the protocol.
  Triggers on: "/surface:backfill", "annotate untracked tests", "bootstrap surface protocol",
  "add metadata to existing tests", "backfill surface", "catch up surface",
  after /surface:scan shows untracked tests.
version: 1.0.0
tags:
  - surface-protocol
  - backfill
  - bootstrap
  - drift
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
context: fork
---

# /surface:backfill

Auto-annotate untracked tests with inferred YAML metadata.

## When to Use

- After `/surface:scan` shows untracked tests
- When adopting Surface Protocol on an existing codebase
- After building a feature quickly without the protocol
- When a test was added directly without using `/surface:capture`

## Workflow

### Step 1: Run a dry-run preview

```bash
surface backfill --all --dry-run
```

Show the user what would be injected:

```
DRY RUN — no files will be modified

Would annotate 12 tests across 4 files:

  src/auth/session.test.ts:45    unit/auth    "auth: handles token refresh"
  src/auth/session.test.ts:67    unit/auth    "auth: expires after timeout"
  src/billing/invoice.test.ts:23 unit/billing "billing: creates invoice"
  ...
```

### Step 2: Confirm with the user

Ask: "I found **12 untracked tests** across **4 files**. The annotations above are inferred from file paths and test names. Should I inject them?"

Options to offer:
- "Yes, backfill all" → `surface backfill --all --yes`
- "Specific file only" → `surface backfill --file <path> --yes`
- "Cancel"

### Step 3: Run the backfill

```bash
surface backfill --all --yes
```

This injects YAML frontmatter before each untracked `it()` call, then runs `surface gen` automatically.

### Step 4: Report results

```
+----------------------------------------------------------------------+
|                     SURFACE BACKFILL COMPLETE                        |
+----------------------------------------------------------------------+
|  ANNOTATED: 12 tests across 4 files                                  |
|    src/auth/session.test.ts     +3 annotations (REQ-043..REQ-045)   |
|    src/billing/invoice.test.ts  +5 annotations (REQ-046..REQ-050)   |
|    src/checkout/cart.test.ts    +4 annotations (REQ-051..REQ-054)   |
|    src/users/profile.test.ts    +0 annotations (no untracked)       |
|  ERRORS: 0                                                           |
|                                                                      |
|  ⚠ THESE ARE DRAFT ANNOTATIONS                                      |
|  Review and update:                                                  |
|    - summary (inferred from test names — may be vague)               |
|    - area (inferred from file path)                                  |
|    - Add rationale and acceptance criteria                           |
+----------------------------------------------------------------------+
```

### Step 5: Prompt for review

Tell the user: "Backfilled annotations use `source.type: implementation` to signal they were inferred — not specified. Before relying on them, review:
- **summaries** — test labels are often informal; rephrase as user-facing requirements
- **areas** — inferred from file paths; adjust if the grouping is wrong
- **acceptance criteria** — none are added automatically; add them where important

Run `/surface:capture <id>` to enrich specific requirements."

## What Gets Injected

Example of a backfilled annotation:

```typescript
/*---
req: REQ-043
type: unit
status: active
area: auth
summary: auth: handles token refresh
source:
  type: implementation
  ref: implementation-discovery
changed:
  - date: 2026-03-27
    commit: pending
    note: Backfilled by surface backfill — review and update
---*/
it("handles token refresh", () => {
  // existing test code — unchanged
});
```

## Inference Rules

| Field | How it's inferred |
|-------|------------------|
| `area` | First meaningful path segment (`src/auth/` → `auth`) |
| `type` | Path hints: `/e2e/` → `e2e`, `/smoke/` → `smoke`, default → `unit` |
| `summary` | Cleaned test label + describe context prefix |
| `id` | Auto-allocated from `.surface/state/id-counter` |
| `source.type` | Always `implementation` (signals "inferred, needs review") |

## Safety

- Tests are processed in **reverse line order** per file — no line number shifts
- A round-trip check verifies injection succeeded — if it fails, the file is restored
- Use `--dry-run` first to preview; then run without it to write
