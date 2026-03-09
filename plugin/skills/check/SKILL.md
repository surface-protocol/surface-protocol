---
name: surface:check
description: |
  Validate surface map coverage, find gaps, check for pending stubs.
  Use when user says "/surface:check", "check coverage", "show pending", or wants to audit requirements.
version: 1.0.0
tags:
  - surface-protocol
  - validation
  - coverage
tools:
  - Read
  - Bash
  - Glob
  - Grep
context: fork
---

# /surface:check

Validate surface map coverage, freshness, and find gaps.

## Usage

```
/surface:check                  # Full check
/surface:check --lifecycle      # Show implementation queue by lifecycle stage
/surface:check --coverage       # Coverage percentages
/surface:check --gaps           # Find untested areas
/surface:check --dangerous      # Show DANGEROUS requirements
```

## Options

- `--coverage` - Report coverage percentages
- `--freshness` - Compare git blame vs changed dates
- `--gaps` - Find untested areas
- `--lifecycle` - Show requirements grouped by lifecycle stage (pending, implemented, etc.)
- `--placeholders` - Find placeholder/stub tests
- `--overrides` - Check for expired overrides
- `--dangerous` - Show requirements tagged critical/security/compliance (use `surface query --dangerous`)
- `--json` - JSON output

## Implementation

Run `surface check` with appropriate flags.

## Output Example

```
+---------------------------------------------------------------------------+
|                         SURFACE PROTOCOL STATUS                            |
+---------------------------------------------------------------------------+
|                                                                            |
|  IMPLEMENTATION COVERAGE: 89.4%                                            |
|                                                                            |
|  Implemented:  127                                                         |
|  Pending:       12  <- Work queue for agents                               |
|  Skipped:        2                                                         |
|  Deprecated:     1                                                         |
|                                                                            |
|  DANGEROUS REQUIREMENTS:                                                   |
|  * REQ-042 [critical, security] User identity verification                 |
|  * REQ-088 [compliance] GDPR data export                                   |
|                                                                            |
+---------------------------------------------------------------------------+
```
