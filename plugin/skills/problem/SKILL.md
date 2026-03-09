---
name: surface:problem
description: |
  Systematic problem resolution with learning capture. Guides through understanding, reproduction,
  root cause analysis, solution research, fix implementation, and learning documentation.
  Use when user says "/surface:problem", "debug this", "fix this issue", "something is broken",
  or reports a problem that needs systematic investigation.
  Triggers on: "X fails", "X is broken", "X doesn't work", "getting an error", "bug in..."
version: 2.0.0
tags:
  - surface-protocol
  - debugging
  - troubleshooting
  - problem-resolution
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /surface:problem

Systematic problem resolution with Surface Protocol ceremony. Adds constraint checks,
DANGEROUS requirement awareness, SP commit trailers, regression test evaluation, and protocol
integration around a core problem-solving workflow.

## Usage

```
/surface:problem <description>
/surface:problem "dev server fails"
/surface:problem "tests timeout on CI"
/surface:problem #456
```

## Arguments

- `<description>` - Problem description, error message, or GitHub issue reference
- `--skip-learning` - Skip Phase 8 (DISTILL) and Phase 9 (SP LEARNING ANALYSIS)
- `--dry-run` - Investigate only, don't apply fixes
- `--area <area>` - Force specific area (skip auto-detection)

## Natural Language Triggers

These phrases activate this command:
- "X fails" / "X is broken" / "X doesn't work"
- "getting an error when..."
- "debug this" / "fix this issue"
- "something is wrong with..."
- "help me troubleshoot..."

## Workflow

### Phase 1: SP PRE-FLIGHT

**Goal:** Check Surface Protocol constraints before investigation begins.

1. **Read `constraints.json`** (if exists) -- understand guardrails
2. **Query `surface.json`** for requirements on likely affected files:
   ```bash
   surface query --file <path> --dangerous
   ```
3. **If DANGEROUS requirements found:** Display them and confirm with user before proceeding
4. Note any relevant requirements for context during investigation

**Output:**
```
+-----------------------------------------------------------------------------+
|                    SP PRE-FLIGHT                                             |
+-----------------------------------------------------------------------------+
|  CONSTRAINTS: <loaded/not found>                                            |
|  DANGEROUS REQS: <list or none>                                             |
|  STATUS: <clear to proceed / awaiting confirmation>                         |
+-----------------------------------------------------------------------------+
```

### Phases 2-7: Core Investigation

The following phases follow a systematic problem-solving workflow:

- **Phase 2: UNDERSTAND** -- Gather context, clarify environment/scope/timing/artifacts
- **Phase 3: REPRODUCE** -- Confirm the problem exists AT RUNTIME (start server, hit endpoint, see error)
- **Phase 4: ROOT CAUSE ANALYSIS** -- Analyze errors, trace code, check git history
- **Phase 5: SOLUTION RESEARCH** -- Research and rank fixes by likelihood/risk/complexity
- **Phase 6: FIX** -- Apply fixes iteratively (max 5 attempts, rollback on failure)
- **Phase 7: VERIFY** -- Runtime verification (start server, hit endpoint) + test suite + lint/typecheck

**CRITICAL: "Reproduce" means at runtime, not by reading source code.**

Reading code and reasoning about what _should_ happen is analysis, not reproduction.
Reproduction requires running the actual system and observing the failure.

**What counts as reproduction:**
- Starting a server and hitting the endpoint with curl
- Running the exact CLI command that fails
- Executing the failing test in the same environment
- Opening the page and submitting the form

**What does NOT count as reproduction:**
- Reading source code and saying "I can see the bug"
- Running source-level tests that check file contents
- Reasoning about what the code would do
- Saying "the error is clear from the report"

**Verification must happen at the same level as the original failure.** If the bug was
"I clicked a button and got a network error", verification means starting the server,
clicking the button (or curling the endpoint), and seeing it work. Passing unit tests
is necessary but NOT sufficient.

### Phase 8: DISTILL

**Goal:** Extract durable learnings and persist to memory and relevant skills.

**Skip if `--skip-learning` flag is set.**

The key principle: **go deep, not wide.**

An incident report ("X broke, we fixed it") is the shallowest form of learning. Push for:

| Level | Example | Persist? |
|-------|---------|----------|
| **Incident** | "KV binding was named wrong" | No -- too shallow |
| **Pattern** | "Binding names are a cross-file contract with no type-checking" | Yes -- skill learning |
| **Decision framework** | "Workers vs Pages: when to use each, with decision matrix" | Yes -- skill learning, titled section |
| **Best practice** | "Local dev tooling must match production deployment model" | Yes -- skill learning + agent protocol |

Steps:
1. **Ask "what category of problem is this?"** -- not "what broke" but "what decision led here?"
2. **Identify the deepest applicable level** -- default to decision framework or best practice
3. **Identify the most relevant skill** for this learning
4. **Write the learning at the right depth** -- tables, rules, decision trees over bullet lists
5. **Apply the learning to the codebase:**
   - Fix stale documentation that now contains wrong information
   - Update code/config that contradicts the new understanding
   - Add regression tests for testable invariants
   - Update `## Agent Protocol` sections if agent behavior should change
6. **Propose the learning to the user** -- show what you'd write and where
7. **On approval:** Write to the skill's `## Learnings` section
8. **For cross-cutting learnings:** Also update `MEMORY.md` (keep under 200 lines)

### Phase 9: SP LEARNING ANALYSIS

**Goal:** Evaluate the resolution through a Surface Protocol lens.

**Skip if `--skip-learning` flag is set.**

Take the learnings from Phase 8 and additionally evaluate:

1. **Missing requirement?** Does this bug reveal a requirement that should exist but doesn't?
   - If yes -> suggest running `/surface:capture` to create a test stub
   - Include the rationale: "This bug could have been caught by a test for X"

2. **Regression of existing requirement?** Does this match an existing requirement in surface.json?
   - If yes -> update the test metadata with a `changed` entry
   - Add regression context to the existing test

3. **Regression test needed?** Should a regression test be added?
   - YES if: code bug, logic error, race condition, state management issue
   - NO if: config typo, missing import, environment setup, external service issue

4. **Prevention mechanisms?** Should any of these be updated?
   - Pre-commit hooks (build/lint issues)
   - CI/CD pipeline (deployment issues)
   - `constraints.json` (dependency/pattern issues)
   - Documentation (knowledge gaps)

5. **Protocol integration?** Does this learning need to be integrated into Surface Protocol itself?
   - New constraint rules
   - New hook checks
   - Updated project guidance

### Phase 10: SP COMMIT

**Goal:** Create a properly-formatted Surface Protocol commit.

1. **Commit** with SP trailer and affected requirements:
   ```
   fix(<area>): <description of problem>

   Root cause: <what caused it>
   Solution: <what fixed it>

   Affects: REQ-XXX, REQ-YYY
   Surface-Protocol: problem
   ```

2. **Surface refresh** (if test files were modified):
   ```bash
   surface gen
   surface check
   ```

3. **Final confirmation:** Re-run the original failing command one more time.

## Output Format

Provide a summary at the end:

```
+-----------------------------------------------------------------------------+
|  Problem Resolved                                                            |
+-----------------------------------------------------------------------------+
|                                                                              |
|  PROBLEM: <description>                                                     |
|  ROOT CAUSE: <what caused it>                                               |
|  SOLUTION: <what fixed it>                                                  |
|  PREVENTION: <what was added to prevent recurrence>                         |
|                                                                              |
|  FILES CHANGED:                                                             |
|  - <file1>                                                                  |
|  - <file2>                                                                  |
|                                                                              |
|  TESTS ADDED: <yes/no, which tests>                                        |
|  DOCS UPDATED: <yes/no, which docs>                                        |
|  SP ACTIONS: <capture suggested / regression test added / constraints updated>|
|                                                                              |
|  COMMIT: <commit SHA>                                                       |
|                                                                              |
+-----------------------------------------------------------------------------+
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Cannot reproduce after Phase 3 | Request more information from user |
| 5 solution attempts fail | Escalate to human review with full context |
| Fix introduces regressions | Roll back and try alternative approach |
| Root cause unclear | Document uncertainty, request human input before proceeding |
| External service issue | Document workaround, skip regression test |
| Security-critical problem | Escalate immediately, do not attempt autonomous fix |
| DANGEROUS requirement affected | Confirm with user in Phase 1 before proceeding |

## Agent Protocol

When running `/surface:problem`, the agent MUST:

1. **ALWAYS check constraints first** - Read `constraints.json` before investigation
2. **ALWAYS check for DANGEROUS requirements** - Query surface.json for affected files
3. **ALWAYS gather context first** - Don't jump to solutions
4. **ALWAYS reproduce AT RUNTIME before fixing** - Start the server, hit the endpoint, see the error. Reading code and reasoning about it is NOT reproduction.
5. **ALWAYS identify root cause** - Fix causes, not symptoms
6. **ALWAYS test after each change** - Verify fixes work
7. **ALWAYS verify the INTENDED OUTCOME** - Validate the running environment, not intermediate steps. API return values, log messages, and CLI output are not proof of success -- test what the user would actually experience. Passing source-level tests alone is NOT sufficient.
8. **ALWAYS roll back failed attempts** - Leave codebase clean
9. **ALWAYS capture learnings** - Prevent recurrence (unless --skip-learning)
10. **ALWAYS use SP commit format** - Include `Surface-Protocol: problem` trailer
11. **NEVER claim "resolved" without runtime verification** - If you didn't run it, you didn't fix it
12. **NEVER apply more than one fix at a time** - Isolate changes
13. **NEVER skip verification** - Run full test suite before committing
14. **ASK when unsure** - Better to clarify than to break things
15. **RESPECT constraints** - Check `constraints.json` before adding dependencies

## Integration

- **Surface Protocol:** Creates test stubs via `/surface:capture` when bugs reveal missing requirements
- **Project docs:** References project configuration and documentation for context and patterns
- **Constraints:** Respects `constraints.json` for allowed dependencies and patterns
- **Git history:** Uses commit history and blame to trace root causes and find prior resolutions

## Examples

### Simple build failure

```
/surface:problem "dev server fails with module not found"
```

Agent: SP pre-flight -> understand -> reproduce -> root cause -> fix -> verify -> distill -> SP learning analysis -> SP commit.

### Intermittent test failure

```
/surface:problem "auth tests fail randomly on CI"
```

Agent: Checks DANGEROUS reqs on auth -> investigates -> identifies race condition -> SP learning suggests regression test + capture -> commits with SP trailer.

### GitHub issue

```
/surface:problem #456
```

Agent: Fetches issue -> SP pre-flight on affected files -> investigates -> implements fix -> SP learning analysis -> updates issue with resolution.

## See Also

- `/surface:quickfix` - Lightweight SP fix for simple problems
- `/surface:capture` - Create requirement stubs (used when bugs reveal missing requirements)
- `/surface:check` - Validate surface protocol compliance
- `/surface:implement` - Implement requirements from test stubs
- `/surface:ship` - Capture + implement in one flow
