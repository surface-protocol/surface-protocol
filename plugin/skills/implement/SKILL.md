---
name: surface:implement
description: |
  Pick up pending test stubs from the surface map and implement them.
  Use when user says "/surface:implement", "implement pending stubs", or wants to work through the implementation queue.
version: 1.0.0
tags:
  - surface-protocol
  - implementation
  - testing
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
context: fork
---

# /surface:implement

Pick up pending test stubs and implement them.

## Usage

```
/surface:implement              # Show pending stubs as work queue
/surface:implement REQ-042      # Implement specific requirement
/surface:implement --all        # Implement all pending in sequence
```

## Workflow

1. Query `surface.json` for requirements with `status: pending`
2. If no ID specified, show work queue:

```
+---------------------------------------------------------------------------+
|                    IMPLEMENTATION QUEUE                                    |
+---------------------------------------------------------------------------+
|                                                                            |
|  PENDING STUBS:                                                            |
|  1. REQ-042  User authentication          src/tests/auth.test.ts           |
|  2. REQ-043  Consent capture              src/tests/consent.test.ts        |
|  3. REQ-044  Data retention policy        src/tests/privacy.test.ts        |
|                                                                            |
|  Which one should I implement? (Enter number or REQ-ID)                    |
|                                                                            |
+---------------------------------------------------------------------------+
```

3. Read the stub's full metadata:
   - Summary and rationale
   - Acceptance criteria
   - Tags and area

4. **Check for API integrations** in the requirement:
   - Look for acceptance criteria mentioning external services (Stripe, Shopify, Twilio)
   - Check for `integration:` field in YAML metadata
   - Check for tags: `integration`, `external`, `api`
   - If found: follow the three-phase API integration testing approach
     - Phase 1 discovery tests go in `tests/discovery/` (gitignored)
     - Phase 2 CI tests use MSW handlers with recorded fixtures
     - Phase 3 smoke checks go in `scripts/smoke-test.sh`
   - If not: proceed with standard implementation below

5. Implement the code to make tests pass:
   - Change `it.todo()` → `it()` with real assertions
   - Create source files as needed
   - Follow existing patterns in codebase
   - For API integrations: create client module in `src/lib/<service>.ts`, wire into route handler

6. Update test metadata:
   - `status: pending` → `status: implemented`
   - Add entry to `changed` array
   - For API integrations: add `integration:` field with `service`, `phase`, `fixtures` path

7. **Runtime verification (MANDATORY):**
   - Validate the **intended outcome** in the running environment, not intermediate steps.
     API return values, log messages, and CLI output are not proof of success.
   - Start the relevant dev server or target environment
   - Exercise the feature at runtime (curl endpoints, verify page renders, test form submissions)
   - Confirm expected behavior occurs (HTTP 200, correct response, no errors)
   - Test at least one error/edge case at runtime
   - Stop the server when done
   - You may NOT mark a requirement as implemented without verifying the intended outcome

8. Run test suite to verify

9. Commit with `feat(<area>): <summary>`, include `Surface-Protocol: implement` trailer

## Query Pending Stubs

```bash
# Using jq directly
jq '.requirements[] | select(.status == "pending") | {id, summary, file: .location.file}' surface.json
```

## See Also

- `/surface:capture` - Create new stubs
- `/surface:ship` - Capture + implement in one flow
