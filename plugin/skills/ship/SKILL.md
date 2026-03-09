---
name: surface:ship
description: |
  Shorthand for /surface:capture --implement. Captures requirements AND implements them in one flow.
  Use when user says "/surface:ship", "ship this", or wants the full capture-to-implementation flow.
version: 1.0.0
tags:
  - surface-protocol
  - requirements
  - testing
  - implementation
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

# /surface:ship

**Shorthand for `/surface:capture --implement`** - The "just do it" command.

Captures requirements from user input AND implements them in one flow.

## Usage

```
/surface:ship <input>
/surface:ship #123
/surface:ship "Add user authentication"
```

## What It Does

This is equivalent to:
```
/surface:capture <input> --implement
```

Full workflow:
1. Parse input -> extract requirements
2. Check existing surface map for conflicts
3. Create test stubs with YAML metadata
4. Run gap check
5. **Implement the code to make tests pass**
6. Run tests to verify
7. Commit spec with `Surface-Protocol: capture` trailer AND implementation with `Surface-Protocol: ship` trailer

## When to Use

- Solo development when you want the full flow
- Quick prototyping with proper documentation
- When you're confident about the requirement

## Examples

```
/surface:ship "Create a button that submits the form"
/surface:ship #456
/surface:ship "Fix the login redirect bug"
```

## See Also

- `/surface:capture` - Capture only (no implementation)
- `/surface:implement` - Implement existing pending stubs
