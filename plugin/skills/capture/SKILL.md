---
name: surface:capture
description: |
  Capture requirements from user input (GitHub issues, descriptions, bug reports) into test stubs with YAML metadata.
  Use when user says "/surface:capture", "capture this requirement", or when detecting feature requests.
  Triggers on: "Create a...", "Add a feature...", "Build...", "Implement...", "We need...", "Fix the bug..."
version: 1.0.0
tags:
  - surface-protocol
  - requirements
  - testing
  - tdd
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

# /surface:capture

Capture requirements from user input into test stubs with full YAML metadata.

## Usage

```
/surface:capture <input>
/surface:capture <input> --implement
/surface:capture <input> and implement it
```

## Arguments

- `<input>` - GitHub issue URL, issue reference (#123), feature description, or bug report
- `--implement` or `-i` - Also implement after capturing (full flow)
- `--dry-run` - Show what would be created without committing
- `--area <area>` - Force specific area (skip auto-detection)

## Natural Language Triggers

These phrases trigger `--implement` automatically:
- "and implement it"
- "and build it"
- "then implement"
- "make it happen"
- "ship it"
- "full flow"

## Workflow

### Phase 1: UNDERSTAND

1. Parse input (issue URL, description, bug report)
2. If GitHub issue: fetch full context with `gh issue view`
3. Extract: summary, rationale, acceptance criteria
4. Identify affected areas from `surfaceprotocol.settings.json`

### Phase 2: MAP

1. Load `surface.json` for each affected area (if exists)
2. Query existing requirements for context
3. Identify:
   - EXISTING: Requirements that already cover this (partial/full)
   - NEW: Requirements that need to be created
   - CONFLICTING: Requirements that contradict this input
4. Get next REQ ID from `.surface/.id-counter`

### Phase 3: STUB

1. Create test file with YAML frontmatter:

```typescript
/*---
req: REQ-XXX
type: unit
status: pending
area: <detected-area>
summary: <one-line summary>
rationale: |
  <why this requirement exists>
acceptance:
  - <criterion 1>
  - <criterion 2>
tags: [<relevant-tags>]
integration:                     # Include when requirement involves external APIs
  service: <service-name>        # e.g. stripe, shopify, twilio
  phase: 1                       # 1=discovery, 2=ci-mocks, 3=smoke
  fixtures: tests/fixtures/<service>/
source:
  type: <github|user-request|prd>
  ref: "<reference>"
changed:
  - date: <today>
    commit: pending
    note: Initial stub created via /surface:capture
---*/
import { describe, it } from 'vitest'

describe('<FeatureName>', () => {
  it.todo('<test description 1>')
  it.todo('<test description 2>')
})
```

2. Increment `.surface/.id-counter`

### Phase 4: GAP CHECK

1. Re-read all created stubs
2. Compare against original input
3. Verify tests FULLY capture user's intent
4. Check for:
   - Missing acceptance criteria
   - Vague or ambiguous requirements
   - Security concerns not addressed
   - Edge cases not covered
5. If gaps found: FIX THEM or ASK USER

### Phase 5: REPORT & COMMIT

1. Show summary of what was created:

```
+---------------------------------------------------------------------------+
|                    SURFACE CAPTURE REPORT                                  |
+---------------------------------------------------------------------------+
|  INPUT: <original input>                                                   |
|  AFFECTED AREAS: <areas>                                                   |
|  NEW REQUIREMENTS: <REQ-IDs>                                               |
|  CONFLICTS: <any conflicts>                                                |
|  CONCERNS: <security, ambiguity, etc>                                      |
|  CREATED STUBS: <file paths>                                               |
|  GAP CHECK: PASSED / ISSUES                                                |
+---------------------------------------------------------------------------+
```

2. Call out any concerns (security, conflicts, ambiguity)
3. Commit with `spec(<area>): <summary>` format, include `Surface-Protocol: capture` trailer
4. If GitHub issue: comment on issue with status

### Phase 6: IMPLEMENT (if --implement flag)

1. For each created stub:
   - Read full metadata (rationale, acceptance criteria)
   - Implement the code to make test pass
   - Change `it.todo()` → `it()` with real assertions
   - Update `status: pending` → `status: implemented`
2. Run tests to verify all pass
3. Commit with `feat(<area>): <summary>` format, include `Surface-Protocol: implement` trailer
4. Update GitHub issue with implementation status

## Configuration

Read from `surfaceprotocol.settings.json`:

```json
{
  "defaultGithubRepo": "your-org/your-repo",
  "testFramework": "vitest",
  "idPrefix": "REQ",
  "idCounter": ".surface/.id-counter",
  "areas": {
    "src/app": { "testDir": "src/app/tests", "surfaceJson": "src/app/surface.json" }
  }
}
```

## Examples

### Capture from GitHub Issue

```
/surface:capture #234
```

### Capture from Description

```
/surface:capture "Users should be able to export their data as CSV"
```

### Capture and Implement

```
/surface:capture "Add dark mode toggle" --implement
/surface:capture #123 and ship it
```

## Security Concerns

If the input involves:
- Admin privileges
- User data deletion
- Authentication/authorization
- Financial operations
- PII handling

STOP and ask user for clarification before creating stubs.
