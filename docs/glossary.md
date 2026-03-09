# Glossary

## Core Concepts

**Surface**
The product as users experience it — every touchpoint, interaction, and interface that people see, touch, and build muscle memory around. Not the code, not the architecture — what people walk on.

**Surface Map**
The complete, queryable shape of the product surface. Generated from tests, so it can't drift from reality. Agents read it to understand what the product *is* before deciding what to change. Think topographic map: it shows what's exposed, what's stable, what's dangerous to reshape. Materialized as `surface.json`.

**Surface Protocol**
The protocol for maintaining the surface map. Embeds product-surface knowledge in tests as structured metadata, generates the map, and tracks how changes flow through it.

**Living Spec**
Synonym for surface map. Emphasizes that it's auto-generated and always reflects reality — unlike PRDs, which drift the moment they're written.

## Test Metadata

**Test Metadata**
YAML frontmatter embedded in test file comments. Describes what part of the product surface a test guards, why it matters, and where the requirement came from.

**Stub**
A test skeleton with full metadata but no implementation (`it.todo()` or `pending`). Marks a part of the surface that has been identified but not yet built or verified.

**Acceptance Criteria**
Conditions that must be true for a surface touchpoint to be considered properly built. Embedded in YAML as `acceptance:`.

**Source Reference**
Where a surface requirement originated — GitHub issue, PRD, Jira ticket, etc. The PRD becomes obsolete once the test exists.

**Area**
A region of the product surface (e.g., `auth`, `checkout`, `catalog`). Groups related touchpoints for navigation and reporting.

## Status Model

Three dimensions track the state of each surface touchpoint. See [Status Model](status-model.md) for details.

**Requirement Status**
Author-declared intent: `pending`, `implemented`, `active`, `deprecated`, `consolidated`, `archived`. Tracks the *intent* for a piece of the surface.

**Implementation State**
Whether a test has real assertions: `stub`, `complete`, `skipped`, or `not-implemented`. The mechanical detection that feeds lifecycle stage. Auto-detected from test syntax.

**Lifecycle Stage**
How mature a part of the surface is: `stub` (identified) → `coded` (built) → `tested` (verified) → `deployed` (live, users walking on it). Auto-detected from implementation state and acceptance criteria coverage.

## Impact & Safety

**Dangerous**
A part of the surface tagged `critical`, `compliance`, `security`, or `blocking`. Reshaping it affects users in high-impact ways. Requires confirmation before modification.

**Override**
A time-limited approval to reshape a dangerous part of the surface despite a blocking requirement. Has expiry date and audit trail.

**Constraint**
An architectural guardrail defined in `constraints.json`. Prevents agents from reshaping the surface in forbidden ways (banned dependencies, patterns, etc.).

## Adoption & Tracking

**Routed**
A commit that flowed through Surface Protocol (has trailers or REQ references). The change was surface-aware. Opposite of "bypass."

**Bypass**
A commit that didn't flow through Surface Protocol — the change may have reshaped the surface without awareness. Categorized as: ci-infra, docs, config, test, or unknown.

## Infrastructure

**Adapter**
A stack-specific module defining how tests are discovered, how metadata is embedded, and how stubs are generated (e.g., `typescript-vitest`, `ruby-rspec`).

**Placeholder**
A planned surface touchpoint (usually UI) not yet designed or built. Tracks progress from `not-designed` → `in-design` → `ready-for-implementation` → `in-progress`.

## Test Types & ID Prefixes

| Type | Prefix | Surface Map Bucket | Purpose |
|------|--------|--------------------|---------|
| `unit` | `REQ-` | `requirements[]` | Atomic requirements |
| `functional` | `FUNC-` | `requirements[]` | Component behavior |
| `performance` | `NFR-` | `requirements[]` | Non-functional requirements |
| `security` | `SEC-` | `requirements[]` | OWASP coverage |
| `regression` | `REGR-` | `regressions[]` | Discovered truths from bugs |
| `e2e` | `FLOW-` | `flows[]` | Flow verification |
| `contract` | `CONTRACT-` | `contracts[]` | API boundaries |
| `smoke` | `SMOKE-` | `smoke[]` | Deployment health |
