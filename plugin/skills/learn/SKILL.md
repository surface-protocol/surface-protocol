---
name: surface:learn
description: |
  Extract durable learnings from the current conversation thread. Scans for problem-solving
  patterns, decisions made, discoveries, and mistakes caught. Proposes updates to regression
  tests, acceptance criteria, rules, and documentation. User reviews and approves before
  anything is persisted.
  Use when user says "/surface:learn", "what did we learn?", "capture learnings",
  or at the end of a productive debugging/building session.
version: 1.0.0
tags:
  - surface-protocol
  - learning
  - retrospective
  - knowledge-capture
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /surface:learn

Extract durable learnings from the current conversation and propose concrete updates to the
codebase. Think of it as a mini-retro that actually produces artifacts -- not just vibes.

## Usage

```
/surface:learn
/surface:learn --scope "auth refactor"
/surface:learn --dry-run
```

## Arguments

- `--scope <topic>` - Focus extraction on a specific topic or area (skip scanning, go straight to that topic)
- `--dry-run` - Show proposed changes without persisting anything
- `--skip-tests` - Skip regression test proposals (just capture learnings)

## Natural Language Triggers

These phrases activate this command:
- "what did we learn?"
- "capture learnings"
- "let's retro this"
- "document what we figured out"
- "save this for next time"

## Workflow

### Phase 1: SCAN

**Goal:** Mine the conversation for learning-worthy moments.

Scan the current thread for:

1. **Problem-solving patterns** -- What broke? How was it debugged? What was the root cause?
2. **Decisions made** -- Architecture choices, library picks, tradeoff evaluations
3. **Discoveries** -- "Oh, THAT's how X works" moments. Non-obvious behaviors.
4. **Mistakes caught** -- Wrong assumptions, incorrect fixes that were rolled back, false starts
5. **Patterns that worked** -- Debugging strategies, code patterns, workflow improvements

For each candidate, classify its depth:

| Level | What it is | Worth persisting? |
|-------|-----------|-------------------|
| **Incident** | "X broke, we fixed it" | No -- too shallow |
| **Pattern** | "Always check Y when doing Z" | Yes |
| **Decision framework** | "When choosing between A and B, consider..." | Yes -- high value |
| **Best practice** | "Never do X because it causes Y" | Yes -- highest value |

**Filter aggressively.** Only surface learnings at the Pattern level or deeper.
Incidents are noise. If the session was uneventful, say so -- don't manufacture learnings.

### Phase 2: EXTRACT

**Goal:** For each learning worth persisting, produce a structured proposal.

For each learning:

1. **What was learned** -- Crisp statement of the insight (1-2 sentences)
2. **Why it matters** -- What goes wrong if you don't know this? What bug does it prevent?
3. **What to do differently** -- Actionable rule or decision framework
4. **Evidence** -- Link to the conversation moment, file, or commit that demonstrates it
5. **Where it belongs** -- Which file or skill should hold this learning?

**Output per learning:**
```
+-----------------------------------------------------------------------------+
|  LEARNING: <crisp title>                                                     |
+-----------------------------------------------------------------------------+
|                                                                              |
|  INSIGHT: <what was learned>                                                |
|  WHY IT MATTERS: <consequence of not knowing this>                          |
|  RULE: <actionable rule or decision framework>                              |
|  EVIDENCE: <file, commit, or conversation context>                          |
|  DEPTH: <pattern / decision framework / best practice>                      |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Phase 3: PROPOSE UPDATES

**Goal:** Turn learnings into concrete codebase changes for user review.

For each learning, propose one or more of:

1. **Regression test** -- If the learning reveals a testable invariant
   - Create a test stub with YAML metadata linking back to the learning
   - Tag with `regression` in the test metadata
   - Only propose if the invariant is code-testable (skip config/environment learnings)

2. **Updated acceptance criteria** -- If an existing requirement should be tightened
   - Show the current criteria and the proposed addition
   - Reference the REQ-ID being modified

3. **Rule change** -- If project rules or constraints should be updated
   - Propose update to `constraints.json`, project configuration, or linting rules
   - Show the diff

4. **Documentation update** -- If skill docs, project docs, or memory should be updated
   - Show the proposed addition to the relevant file
   - Keep it concise -- tables and rules over paragraphs

5. **Code fix** -- If the learning reveals stale code or config
   - Show the specific file and change needed
   - Explain why the current code contradicts the learning

**Present ALL proposals to the user in a numbered list:**
```
Proposed updates from this session:

1. [REGRESSION TEST] Add test for rate limiter edge case
   File: tests/auth/rate-limiter.test.ts
   Reason: We discovered the limiter doesn't reset on successful auth

2. [ACCEPTANCE CRITERIA] Tighten REQ-012 to require error message specificity
   File: tests/auth/login.test.ts
   Change: Add criterion "error message distinguishes wrong password from unknown user"

3. [DOCUMENTATION] Add decision framework for caching strategy
   File: surfaceprotocol.settings.json (or project docs)
   Content: <proposed table>

4. [CONSTRAINT] Ban direct DOM manipulation in React components
   File: constraints.json
   Change: Add "direct-dom-manipulation" to forbidden patterns

Approve all? Or specify numbers to approve (e.g., "1,3,4"):
```

### Phase 4: PERSIST

**Goal:** Apply approved changes and commit.

1. Apply only the user-approved proposals
2. If test files were created or modified, regenerate the surface map:
   ```bash
   surface gen
   ```
3. Run validation:
   ```bash
   surface check
   ```
4. Commit with SP trailer:
   ```
   chore(<area>): capture learnings from <session topic>

   <bullet list of what was captured>

   Surface-Protocol: learn
   ```

## Output Format

Final summary after persistence:

```
+-----------------------------------------------------------------------------+
|  Learnings Captured                                                          |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SESSION TOPIC: <what the session was about>                                |
|  LEARNINGS FOUND: <N total, M persisted>                                    |
|  FILTERED OUT: <K incidents too shallow to persist>                         |
|                                                                              |
|  PERSISTED:                                                                 |
|  - [REGRESSION TEST] <title> -> <file>                                      |
|  - [DOCUMENTATION] <title> -> <file>                                        |
|  - [RULE] <title> -> <file>                                                 |
|                                                                              |
|  SKIPPED (user declined):                                                   |
|  - <title> -- <reason>                                                      |
|                                                                              |
|  COMMIT: <commit SHA>                                                       |
|                                                                              |
+-----------------------------------------------------------------------------+
```

## Rules

- **Never persist without user approval.** Always present proposals and wait for confirmation.
- **Filter aggressively.** Incidents are noise. Only persist patterns, decision frameworks, and best practices.
- **One commit for all approved learnings.** Don't create separate commits per learning.
- **Don't manufacture learnings.** If the session was routine, say "nothing worth capturing" and move on.
- **Keep it crisp.** Learnings should be rules and frameworks, not narrative. Tables over paragraphs.
- **Link to evidence.** Every learning should reference the conversation moment or code that spawned it.
- **Respect the depth hierarchy.** Push every learning to its deepest applicable level before persisting.

## Agent Protocol

When running `/surface:learn`, the agent MUST:

1. **ALWAYS scan the full conversation thread** -- don't just look at the last few messages
2. **ALWAYS classify depth level** before proposing persistence
3. **ALWAYS present proposals to user** before writing anything
4. **ALWAYS include evidence** -- no learning without proof
5. **NEVER persist incidents** -- they're too shallow. Push to pattern level or skip.
6. **NEVER create learnings that duplicate existing documentation** -- check first
7. **NEVER commit without user approval** of what's being persisted
8. **SAY "nothing worth capturing"** if the session was routine -- honesty over volume

## Examples

### After a debugging session

```
/surface:learn
```

Agent scans thread, finds: race condition in auth flow was caused by missing await, tried 3 approaches
before finding root cause via git blame. Proposes: regression test for async auth, decision framework
for "when to use git blame vs git log for root cause analysis", documentation update on async patterns.

### Scoped to a topic

```
/surface:learn --scope "deployment pipeline"
```

Agent focuses on deployment-related conversation, finds: staging deploy succeeded but production
failed due to missing env var. Proposes: constraint requiring env var parity check, documentation
update on deployment checklist.

### Dry run

```
/surface:learn --dry-run
```

Agent scans, extracts, proposes -- but doesn't persist anything. Useful for reviewing what
would be captured before committing to it.

## See Also

- `/surface:problem` - Systematic problem resolution (includes its own DISTILL phase)
- `/surface:capture` - Capture requirements as test stubs
- `/surface:check` - Validate surface protocol compliance
