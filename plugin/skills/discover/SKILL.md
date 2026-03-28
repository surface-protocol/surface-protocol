---
name: surface:discover
description: |
  Scan implementation code to find all customer-facing entry points and assess test coverage.
  Finds APIs, web pages, CLI commands, package scripts, and GraphQL operations.
  Answers: "What does this product actually expose to customers?"
  Use as the FIRST step when adopting Surface Protocol on an existing product, or when
  code was built outside the protocol and you need a complete picture of the surface.
  Triggers on: "/surface:discover", "what does this product expose", "find untested endpoints",
  "what APIs do we have", "what pages exist", "map the product surface", "scan the codebase",
  "what's untested", "find coverage gaps in implementation".
version: 1.0.0
tags:
  - surface-protocol
  - discovery
  - drift
  - audit
  - bootstrap
tools:
  - Read
  - Bash
  - Glob
  - Grep
context: fork
---

# /surface:discover

Scan implementation code to find all customer-facing entry points and classify their test coverage.

## When to Use

This is the **starting point** for any of these situations:

1. **Adopting Surface Protocol on an existing product** — before you know what you have
2. **After building features outside the protocol** — to see what the protocol doesn't know about
3. **Auditing coverage before a release** — to ensure critical paths are tested
4. **Answering "what does this product actually do?"**

Unlike `/surface:scan` (which looks at test files), `/surface:discover` looks at **implementation code** — routes, pages, CLI commands, scripts — regardless of whether tests exist.

## Workflow

### Step 1: Run discovery

```bash
surface discover --json
```

### Step 2: Parse and present the report

Group results by type. Show a structured overview:

```
+----------------------------------------------------------------------+
|                   SURFACE DISCOVERY REPORT                           |
+----------------------------------------------------------------------+
|  ADAPTERS: hono-routes, astro-pages, commander-cli, package-scripts  |
|                                                                      |
|  APIs (8):                                                           |
|    ✓ POST /api/auth/login      src/routes/auth.ts:12  REQ-001        |
|    ✓ GET  /api/users/:id       src/routes/users.ts:24 REQ-012        |
|    ~ GET  /api/billing/history src/routes/billing.ts:8  [untracked]  |
|    ✗ POST /api/subscriptions   src/routes/billing.ts:31 [untested]   |
|    ✗ DELETE /api/subscriptions src/routes/billing.ts:44 [untested]   |
|                                                                      |
|  PAGES (5):                                                          |
|    ✓ /dashboard    src/pages/dashboard.astro  REQ-042                |
|    ✗ /settings/billing  src/pages/settings/billing.astro [untested]  |
|                                                                      |
|  CLI COMMANDS (3):                                                   |
|    ✓ surface gen    src/cli/surface-gen.ts                           |
|    ✗ surface admin:reset  src/cli/admin.ts [untested]                |
|                                                                      |
|  PACKAGE SCRIPTS (6):                                                |
|    ✓ bun test         package.json                                   |
|    ~ bun run migrate  package.json  [untracked]                     |
|    ✗ bun run seed     package.json  [untested]                      |
|                                                                      |
|  SUMMARY:  22 entry points  |  14 covered  |  3 untracked  |  5 untested  |
+----------------------------------------------------------------------+
```

### Step 3: Prioritize and guide the user

**For untracked entry points (test exists, no metadata):**
> "3 entry points have tests but no surface metadata. Run `/surface:backfill` to annotate them."

**For untested entry points (no tests at all):**
> "5 entry points have no test coverage. The most critical ones to address:
> - `POST /api/subscriptions` — financial operation, high risk
> - `DELETE /api/subscriptions/:id` — destructive operation
> - `/settings/billing` — user-facing page
>
> Use `/surface:capture` to create test stubs for each."

**If everything is covered:**
> "All discovered entry points have test coverage and surface metadata. Surface is complete."

### Step 4: Offer next steps

| Finding | Recommended action |
|---------|-------------------|
| Untracked tests | `/surface:backfill` |
| Untested entry points | `/surface:capture <description>` for each |
| Clean | "Surface is complete for all discovered entry points" |

## Coverage Legend

| Icon | Meaning |
|------|---------|
| ✓ | **Covered** — has a test with YAML surface metadata |
| ~ | **Untracked** — has a test but no surface metadata |
| ✗ | **Untested** — no test coverage at all |

## Discovery Adapters

Auto-detects which adapters apply based on project dependencies:

| Adapter | Activates when |
|---------|---------------|
| `package-scripts` | `package.json` exists |
| `hono-routes` | `hono` in dependencies |
| `astro-pages` | `astro` in deps OR `src/pages/` exists |
| `commander-cli` | `commander` in dependencies |
| `rails-routes` | `config/routes.rb` exists |
| `graphql-schema` | `graphql` in deps OR `.graphql` files exist |

## Explicit Coverage Annotation

To precisely link a test to discovered entry points, add `covers` to the test metadata:

```typescript
/*---
req: REQ-042
type: e2e
area: checkout
summary: Checkout flow processes payment
covers:
  - "POST /api/orders"
  - "GET /api/orders/:id"
  - "/checkout"
---*/
```

This removes reliance on heuristics and creates an auditable link.

## Adopting Surface Protocol on an Existing Codebase

Full bootstrap sequence:

```bash
# 1. See the complete product surface
/surface:discover

# 2. Find tests that need metadata
/surface:scan

# 3. Auto-annotate existing tests (review after)
/surface:backfill

# 4. Regenerate surface.json
surface gen

# 5. Verify everything is captured
/surface:scan  # should show clean
```
