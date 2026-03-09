# YAML Frontmatter Reference

## Comment Formats

**TypeScript (`js-block`):**
```typescript
/*---
req: REQ-001
type: unit
summary: Description
---*/
```

**Ruby (`hash-block`):**
```ruby
#---
# req: REQ-001
# type: unit
# summary: Description
#---
```

## Required Fields

| Field | Description | Example |
|---|---|---|
| Identity (one required) | `req`, `flow`, `contract`, `smoke`, `func`, `perf`, `sec`, or `regr` | `req: REQ-042` |
| `type` | Test type | `unit`, `functional`, `e2e`, `contract`, `performance`, `security`, `smoke`, `regression` |
| `summary` | One-line description | `User login requires valid credentials` |

### Identity Fields & Prefixes

| Field | Prefix | Test Type |
|-------|--------|-----------|
| `req` | `REQ-` | unit |
| `func` | `FUNC-` | functional |
| `flow` | `FLOW-` | e2e |
| `contract` | `CONTRACT-` | contract |
| `smoke` | `SMOKE-` | smoke |
| `regr` | `REGR-` | regression |
| `perf` | `NFR-` | performance |
| `sec` | `SEC-` | security |

## Core Fields

| Field | Type | Description |
|---|---|---|
| `area` | string | Product surface area (e.g., `auth`, `catalog`) |
| `tags` | string[] | Searchable categories |
| `rationale` | string | Why this requirement exists |
| `status` | enum | `pending`, `implemented`, `active`, `deprecated`, `consolidated`, `archived` |
| `acceptance` | string[] | Acceptance criteria |
| `audience` | enum | `user-facing`, `admin-facing`, `backend` |

## Source Reference

```yaml
source:
  type: prd|github|jira|confluence|slack|manual|internal|plan|implementation|implementation-discovery|user-request
  ref: "#234"
  url: https://github.com/org/repo/issues/234
```

### Source Types

| Type | Use Case |
|------|----------|
| `prd` | Product requirements document |
| `github` | GitHub issue or PR |
| `jira` | Jira ticket |
| `confluence` | Confluence page |
| `slack` | Slack thread or message |
| `manual` | Manually entered |
| `internal` | Internally-discovered requirement |
| `plan` | Planning document |
| `implementation` | Discovered during implementation |
| `implementation-discovery` | Bug or gap found while coding |
| `user-request` | Direct user request |

## Change Tracking

```yaml
changed:
  - date: 2026-01-15
    commit: abc1234
    author: jane
    note: Initial stub created
```

## Override

Override fields are flat in YAML but appear as a structured `override` object in `surface.json`.

```yaml
override_approved: 2026-02-01
override_reason: Emergency release
override_expires: 2026-03-01
override_ticket: JIRA-123
```

In `surface.json`:
```json
{
  "override": {
    "approved": "2026-02-01",
    "reason": "Emergency release",
    "expires": "2026-03-01",
    "ticket": "JIRA-123"
  }
}
```

## Dangerous Tags

`critical`, `security`, `compliance`, `blocking` — trigger DANGEROUS classification.

## Related Requirements

```yaml
related: [REQ-041, REQ-043]
conflicts_with: REQ-099
conflict_resolution: REQ-099 superseded by compliance update
```

## Flaky Test Handling

```yaml
flaky: true
flaky_reason: Intermittent timeout on CI runners
flaky_since: 2026-02-15
```

## Type-Specific Fields

### Regression (`regr: REGR-XXX`)

```yaml
regr: REGR-001
type: regression
summary: Cart total rounds correctly for 3+ decimal prices
discovered: 2026-02-10
incident: INC-456
rootcause: Float arithmetic without rounding in cart total
learning: Always use integer cents for financial calculations
consolidated_into: REQ-042
```

### E2E / Flow (`flow: FLOW-XXX`)

```yaml
flow: FLOW-001
type: e2e
summary: User can complete checkout from cart to confirmation
verifies: [REQ-001, REQ-002, REQ-003]
externals: [stripe-api, email-service]
journey:
  - step: 1
    action: Add item to cart
    requirement: REQ-001
  - step: 2
    action: Enter shipping address
  - step: 3
    action: Complete payment
    requirement: REQ-003
```

### Contract (`contract: CONTRACT-XXX`)

```yaml
contract: CONTRACT-001
type: contract
summary: Payment API returns 200 with transaction ID
provider: payment-service
consumer: checkout-frontend
schema:
  request: PaymentRequest
  response: PaymentResponse
breaking_change_policy: Major version bump required
```

### Performance (`perf: NFR-XXX`)

```yaml
perf: NFR-001
type: performance
summary: Product listing loads in under 200ms
baseline: "150ms"
target: "200ms"
ceiling: "500ms"
load_profile: "100 concurrent users"
```

### Security (`sec: SEC-XXX`)

```yaml
sec: SEC-001
type: security
summary: SQL injection prevented in search input
owasp: A03:2021
attack_vector: Malicious search query with SQL payload
mitigation: Parameterized queries via ORM
```

### Smoke (`smoke: SMOKE-XXX`)

```yaml
smoke: SMOKE-001
type: smoke
summary: Homepage returns 200 and renders header
criticality: P0
checks: [status-code-200, header-visible, footer-visible]
timeout: "5s"
```

### Functional (`func: FUNC-XXX`)

```yaml
func: FUNC-001
type: functional
summary: Search filters by category and price range
component: ProductSearch
accepts: [valid-category, price-range]
rejects: [negative-price, unknown-category]
```

### Placeholder

Placeholders track planned UI touchpoints that aren't yet designed or built.

```yaml
req: REQ-050
type: unit
summary: User avatar component
placeholder: user-avatar
description: Circular avatar with initials fallback
interaction: Click opens profile dropdown
blocked_by: design-system-v2
figma_id: "node-id:123"
status: in-design
```

Placeholder statuses: `not-designed`, `in-design`, `ready-for-implementation`, `in-progress`.
