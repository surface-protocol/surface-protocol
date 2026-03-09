---
name: surface:quickfix
description: |
  Lightweight Surface Protocol fix for simple problems. Two modes: fast-path when user provides
  the fix, and investigation path that delegates to /surface:problem. Tracks fixes with SP ceremony.
  Use when user says "/surface:quickfix", "quick fix", or has a simple, scoped fix.
version: 1.0.0
tags:
  - surface-protocol
  - debugging
  - quickfix
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /surface:quickfix

Lightweight Surface Protocol fix for simple, scoped problems. Minimal ceremony, full tracking.

## Usage

```
/surface:quickfix <description>
/surface:quickfix <description> --fix "<suggested fix>"
```

### Fast Path (user provides problem + fix)

```
/surface:quickfix "the import path in auth.ts is wrong" --fix "change ./utils to ../utils"
/surface:quickfix "typo in error message" --fix "change 'recieved' to 'received'"
```

### Investigation Path (user provides only the problem)

```
/surface:quickfix "wrong import path somewhere in auth"
/surface:quickfix "lint is failing on the new file"
```

## Arguments

- `<description>` - Problem description or error message
- `--fix "<fix>"` - Suggested fix to apply (enables fast path)
- `--dry-run` - Show what would change without applying
- `--area <area>` - Force specific area

## Workflow

### Mode 1: Fast Path (--fix provided)

#### Step 1: ASSESS

1. **Read `constraints.json`** (if exists) -- verify fix doesn't violate constraints
2. **Query `surface.json`** for DANGEROUS requirements on affected files:
   ```bash
   surface query --file <path> --dangerous
   ```
3. **If DANGEROUS:** Confirm with user before proceeding

#### Step 2: APPLY

1. Execute the suggested fix
2. Run tests related to modified files
3. Run lint/typecheck

#### Step 3: COMMIT

1. Decide on regression test: **skip for typos/config/imports**, add for code bugs
2. Run `surface gen` only if test files were added or modified
3. Commit with `Surface-Protocol: quickfix` trailer:
   ```
   fix(<area>): <description>

   Surface-Protocol: quickfix
   ```

### Mode 2: Investigation Path (no --fix)

#### Step 1: ASSESS

1. **Read `constraints.json`** (if exists)
2. **Query `surface.json`** for DANGEROUS requirements on likely affected files
3. **If DANGEROUS:** Confirm with user before proceeding

#### Step 2: DELEGATE TO /surface:problem

Delegate to the `/surface:problem` workflow for investigation and fix.

The problem workflow handles: understanding, reproduction, root cause analysis,
solution research, fix implementation, and verification.

#### Step 3: LEARN (optional)

If the root cause reveals a durable insight (not a one-off typo/config fix):
1. Identify the most relevant skill or documentation area
2. Propose a learning entry to the user
3. On approval, persist the learning

Skip this step for trivial fixes (typos, imports, config).

#### Step 4: COMMIT

1. Wrap the result with `Surface-Protocol: quickfix` trailer
2. Run `surface gen` only if test files were added or modified
3. Commit:
   ```
   fix(<area>): <description>

   Root cause: <what caused it>
   Solution: <what fixed it>

   Affects: <REQ-IDs if applicable>
   Surface-Protocol: quickfix
   ```

## Scope Limits

Quickfix is designed for small, contained fixes:

- **Max 3 fix attempts** (vs 5 in `/surface:problem`)
- **Scope limit: 1-3 files** -- if more files are affected, suggest `/surface:problem`
- **Regression test: optional** -- decide explicitly, skip for typos/config/imports
- **Learning capture optional** -- for investigation path, suggest a learning if the root cause reveals a durable insight. Skip for fast-path typo/config fixes.
- **`surface gen` conditional** -- only if test files were added/modified

## Escalation

If the problem turns out to be complex, suggest switching to `/surface:problem`:

```
This problem appears more complex than expected:
- Root cause is unclear after initial investigation
- Multiple areas are affected (>3 files)
- Issue is intermittent
- Already used 3 fix attempts without resolution

Recommend switching to /surface:problem for the full ceremony.
Switch to /surface:problem? (yes/no)
```

## Output Format

### Fast Path Success

```
+-----------------------------------------------------------------------------+
|  Quickfix Applied                                                            |
+-----------------------------------------------------------------------------+
|                                                                              |
|  PROBLEM: <description>                                                     |
|  FIX: <what was changed>                                                    |
|  FILES: <file1>, <file2>                                                    |
|  TESTS: Passed                                                              |
|  COMMIT: <commit SHA>                                                       |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Investigation Path Success

```
+-----------------------------------------------------------------------------+
|  Quickfix Resolved                                                           |
+-----------------------------------------------------------------------------+
|                                                                              |
|  PROBLEM: <description>                                                     |
|  ROOT CAUSE: <what caused it>                                               |
|  FIX: <what was changed>                                                    |
|  FILES: <file1>, <file2>                                                    |
|  TESTS: Passed                                                              |
|  COMMIT: <commit SHA>                                                       |
|                                                                              |
+-----------------------------------------------------------------------------+
```

## Agent Protocol

When running `/surface:quickfix`, the agent MUST:

1. **ALWAYS check constraints** before applying fixes
2. **ALWAYS check for DANGEROUS requirements** on affected files
3. **ALWAYS run tests** after applying the fix
4. **ALWAYS include `Surface-Protocol: quickfix` trailer** in commit
5. **ESCALATE** if the problem is too complex for quickfix scope
6. **NEVER skip lint/typecheck** -- even for "simple" fixes

## Examples

### Typo fix (fast path)

```
/surface:quickfix "typo in error message" --fix "change 'recieved' to 'received'"
```

Agent: Checks constraints -> finds file -> applies fix -> runs tests -> commits.

### Import fix (fast path)

```
/surface:quickfix "wrong import in auth.ts" --fix "change ./utils to ../utils"
```

Agent: Checks constraints -> checks DANGEROUS reqs on auth.ts -> applies fix -> tests -> commits.

### Unknown fix (investigation path)

```
/surface:quickfix "lint is failing on the new file"
```

Agent: Checks constraints -> delegates to /surface:problem -> investigates -> fixes -> commits with quickfix trailer.

## See Also

- `/surface:problem` - Full SP problem resolution with learning capture
- `/surface:capture` - Capture requirements as test stubs
