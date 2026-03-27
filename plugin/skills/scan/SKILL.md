---
name: surface:scan
description: |
  Detect drift between test files and surface.json.
  Finds untracked tests (no YAML metadata), ghost entries (deleted test files),
  and implementation status changes since last `surface gen`.
  Use when: code was added outside the protocol, after pulling from upstream,
  before locking a release, or when surface.json feels out of date.
  Triggers on: "/surface:scan", "check for drift", "what's untracked",
  "surface is stale", "surface out of sync", "find gaps in surface".
version: 1.0.0
tags:
  - surface-protocol
  - drift
  - audit
  - discovery
tools:
  - Read
  - Bash
  - Glob
  - Grep
context: fork
---

# /surface:scan

Detect drift between your test files and surface.json.

## When to Use

Run `/surface:scan` whenever:
- You've been building features without the protocol
- You've pulled changes from upstream
- You want to know what the protocol doesn't know about
- You're preparing to lock a product surface for a release

## Workflow

### Step 1: Run the scan

```bash
surface scan --json
```

Parse the JSON output. It contains three categories:

**`untracked`** — tests that exist but have no YAML frontmatter
```json
{
  "file": "src/auth/login.test.ts",
  "line": 45,
  "describe": "auth",
  "it": "handles expired tokens",
  "implementation": { "state": "stub", "detected_from": "no-assertions" }
}
```

**`ghosts`** — requirements in surface.json whose test files were deleted or renamed
```json
{
  "id": "REQ-031",
  "last_file": "src/payments/old-flow.test.ts",
  "reason": "file-deleted"
}
```

**`status_drift`** — tests where implementation state changed since last gen
```json
{
  "id": "REQ-012",
  "file": "src/checkout/cart.test.ts",
  "recorded": "stub",
  "actual": "complete"
}
```

### Step 2: Report to the user

Display a structured drift report using ASCII box formatting:

```
+----------------------------------------------------------------------+
|                      SURFACE DRIFT SCAN                              |
+----------------------------------------------------------------------+
|  UNTRACKED TESTS: 12                                                 |
|    src/auth/session.test.ts:45   "auth > handles token refresh"     |
|    src/billing/invoice.test.ts:23  "billing > creates invoice"      |
|    ... and 10 more                                                   |
|                                                                      |
|  GHOST ENTRIES: 2                                                    |
|    REQ-031  src/payments/old-flow.test.ts  [file-deleted]           |
|    REQ-044  src/billing/charge.test.ts     [file-renamed]           |
|                                                                      |
|  STATUS DRIFT: 3                                                     |
|    REQ-012  stub → complete (test now has assertions)               |
|                                                                      |
|  SUMMARY: 12 untracked | 2 ghosts | 3 drifted                       |
+----------------------------------------------------------------------+
```

### Step 3: Offer next actions

Based on what was found:

**If untracked tests exist:**
> "I found 12 tests without surface metadata. Would you like me to backfill them with `/surface:backfill`? This will inject inferred YAML annotations — you'll review them afterward."

**If ghost entries exist:**
> "2 requirements in surface.json point to deleted test files. Run `surface gen` to prune them, or check if the files were renamed."

**If status drift exists:**
> "3 requirements changed from stub to complete since the last `surface gen`. Run `surface gen` to refresh surface.json."

**If surface is clean:**
> "Surface is clean — surface.json is fully in sync with your test files."

## Options

| Flag | When to use |
|------|-------------|
| `--exit-code` | In CI — exits 1 if drift found |
| `--untracked` | Only show untracked tests |
| `--json` | For programmatic processing |

## Example Output

```
SURFACE DRIFT SCAN
==================

Untracked Tests (12):
  src/auth/session.test.ts:45   "auth > handles token refresh"
  src/auth/session.test.ts:67   "auth > expires after timeout"
  ...

Ghost Entries (2):
  REQ-031  src/payments/old-flow.test.ts  [file-deleted]
  REQ-044  src/billing/charge.test.ts     [file-renamed]

Status Drift (3):
  REQ-012  stub → complete
  ...

Summary: 12 untracked, 2 ghosts, 3 drifted
→ Run `surface backfill` to annotate untracked tests.
→ Run `surface gen` to prune ghost entries and refresh status.
```
