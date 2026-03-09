# Status Model

Surface Protocol tracks each surface touchpoint with three independent status dimensions.

## The Three Dimensions

### 1. Requirement Status (author-declared)

What the *author* says about this requirement's intent. Set manually in YAML metadata via the `status` field.

| Value | Meaning |
|-------|---------|
| `pending` | Captured but not yet implemented |
| `implemented` | Has real assertions, passes |
| `active` | Implemented and actively maintained |
| `deprecated` | Being phased out |
| `consolidated` | Merged into another requirement |
| `archived` | No longer relevant, preserved for history |

### 2. Implementation State (auto-detected)

What the *code* says about this test. Auto-detected from test syntax — you never set this manually.

| Value | Detected From |
|-------|--------------|
| `stub` | `it.todo()`, `pending`, or no assertions in test body |
| `complete` | Test body has `expect()`, `assert()`, or similar assertions |
| `skipped` | `it.skip()`, `describe.skip()`, or Playwright conditional skip |
| `not-implemented` | `throw new Error("NOT IMPLEMENTED")` or similar |

Detection priority (highest wins):
1. YAML `status: pending` → stub
2. `it.todo()` → stub
3. `it.skip()` → skipped
4. NOT IMPLEMENTED throw patterns → not-implemented
5. No assertions → stub
6. Has assertions → complete

### 3. Lifecycle Stage (computed)

The *maturity* of this part of the surface. Computed automatically from implementation state + acceptance criteria coverage.

| Stage | Meaning | How it's determined |
|-------|---------|-------------------|
| `stub` | Identified but not built | Implementation state is not `complete`, or no acceptance criteria |
| `coded` | Built but not fully verified | Implementation is `complete` but fewer assertions than acceptance criteria |
| `tested` | Fully verified | Implementation is `complete` and assertion count ≥ acceptance criteria count |
| `deployed` | Live, users walking on it | `tested` + has a corresponding SMOKE test that verifies it |

## How They Relate

```
Author sets:     status: pending
                      ↓
System detects:  implementation.state: stub     (from it.todo())
                      ↓
System computes: lifecycle.stage: stub          (not complete → stub)

─── Author implements the test ───

Author updates:  status: active
                      ↓
System detects:  implementation.state: complete (has expect() calls)
                      ↓
System computes: lifecycle.stage: coded         (complete, 1/3 acceptance covered)

─── Author covers all acceptance criteria ───

System computes: lifecycle.stage: tested        (complete, 3/3 acceptance covered)

─── SMOKE test added that verifies this requirement ───

System computes: lifecycle.stage: deployed      (tested + smoke verifies it)
```

## Which to Use When

- **Querying surface.json**: Use `lifecycle.stage` for maturity dashboards. Use `implementation.state` for work queue (find stubs). Use `status` for archival/deprecation tracking.
- **In YAML metadata**: Only set `status`. The other two are computed.
- **In surface check**: `--lifecycle` shows the computed stages. `--gaps` shows tests without metadata.
