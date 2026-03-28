---
name: surface:backfill
description: |
  Auto-annotate untracked tests with context-aware YAML metadata.
  Triggers ONLY on explicit "/surface:backfill" invocation.
  Generates enriched metadata with rationale, acceptance criteria, and tags
  by analyzing product context, existing metadata patterns, and implementation code.
version: 2.0.0
tags:
  - surface-protocol
  - backfill
  - bootstrap
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

Annotate untracked tests with enriched YAML metadata — including rationale, acceptance criteria, and tags.

## When to Use

- After `/surface:scan` shows untracked tests
- When adopting Surface Protocol on an existing codebase
- After building features outside the protocol

## Mode Selection

- `/surface:backfill` — **smart mode** (default): analyzes code, groups tests, generates rich metadata
- `/surface:backfill --basic` — **basic mode**: fast structural injection only (no enrichment)

## Smart Backfill Workflow

### Step 1: Learn from existing metadata

Run the scan and analyze what metadata already exists:

```bash
surface backfill --all --dry-run --json
```

Parse the JSON output. It provides:
- Test groups (by file + describe block)
- Imported modules (implementation code each test exercises)
- Inferred type and area

Also examine existing YAML metadata in the project to understand the conventions:
- What areas are in use?
- Do existing blocks include rationale and acceptance criteria?
- What tags are common?
- How many tests are grouped per YAML block?

Read 3-5 existing YAML blocks as style examples. Match this style when generating new metadata.

### Step 2: Assess product context

You already have product context from CLAUDE.md (loaded into this conversation). Reflect on:
- What does this product do?
- What are its main components/areas?
- What's the user-facing purpose of each feature area?

If CLAUDE.md is absent or thin, read `README.md` for product context. If neither exists, ask the user:
> "I need to understand what this product does to write good metadata. Can you describe it in a sentence or two?"

### Step 3: Enrich each test group

For each group from the JSON output, generate enriched metadata:

1. **Read the implementation code** — follow the `imported_modules` paths to understand what the tests exercise
2. **Read adjacent metadata** — if the same file has other YAML blocks, match their style
3. **Generate metadata** with these fields:

| Field | How to generate |
|-------|----------------|
| `req` | Allocate from `surface backfill` (use CLI for ID allocation) |
| `type` | From the `inferred.type` in JSON output |
| `area` | From `inferred.area`, refined by product knowledge |
| `summary` | 1-line description of what the test group verifies, informed by describe label and product context |
| `rationale` | 2-3 sentences: why this feature matters to users, referencing product context from CLAUDE.md |
| `acceptance` | Convert each `it()` label into a clean acceptance criterion |
| `tags` | Area tag + relevant category tags (match existing tag conventions) |

4. **Present to user for approval** — show the enriched block and ask to approve, edit, or skip

Example output to present:

```
Group: getBaseUrl (src/cli/__tests__/cli.test.ts, 7 tests)

  /*---
  req: REQ-474
  type: unit
  status: active
  area: cli
  summary: CLI server endpoint resolution with priority fallback
  rationale: |
    The CLI needs flexible server configuration for local development,
    remote servers, and CI environments. Resolution follows a strict
    priority: --server flag > LAUNCHPAD_SERVER env var > --port > default.
  acceptance:
    - Returns --server flag value when provided
    - Strips trailing slash from server URLs
    - Reads LAUNCHPAD_SERVER env var as fallback
    - Falls back to --port on localhost
    - Defaults to http://localhost:3001
    - --server flag takes priority over --port
    - Strips trailing slash from env var
  tags: [cli, core]
  source:
    type: implementation
    ref: implementation-discovery
  changed:
    - date: 2026-03-28
      commit: pending
      note: Backfilled by surface backfill — review and update
  ---*/
```

### Step 4: Write approved metadata

For each approved group:
1. Use the Edit tool to inject the YAML block **before the describe() line**, matching its indentation
2. Place one block per describe group (not one per `it()` call)
3. After all groups are written, run `surface gen` to update surface.json

### Step 5: Report results

Summarize what was written:
- How many groups annotated
- How many tests covered
- Any groups that were skipped
- Remind user that annotations are drafts marked with `source.type: implementation`

## When to Ask the User

**Ask when:**
- No CLAUDE.md and no README — "What does this product do?"
- Area is ambiguous — "Which area does `tests/helpers.test.ts` belong to?"
- Feature purpose is unclear from code alone — "What's the user-facing purpose of [function]?"

**Don't ask when:**
- CLAUDE.md provides sufficient product context
- Area is clear from file path
- Implementation code makes the purpose obvious
- Tests are clearly grouped by describe block

## Basic Mode (`--basic`)

When invoked with `--basic`, skip enrichment and use the CLI directly:

```bash
surface backfill --all --dry-run    # preview
surface backfill --all --yes        # write
```

This produces bare-bones metadata (ID, type, area, summary only) — one annotation per `it()` call. Useful for fast bootstrapping when you'll refine metadata later.

## Safety

- YAML injection is done via Edit tool with exact line targeting
- Tests are processed in reverse order per file to avoid line shifts
- Round-trip verification: if the parser can't read back what was written, the file is restored
- All backfilled annotations are marked `source.type: implementation` to signal "auto-generated"
