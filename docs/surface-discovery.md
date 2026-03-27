# Surface Discovery

Surface Protocol's test-centric model gives you a complete picture of *declared* requirements. But your product surface is defined by where your code actually accepts customer input — and that can grow outside the protocol, especially during early exploration, prototyping, or when working at speed.

`surface discover` addresses this by scanning your **implementation code** (not test files) to find every customer-facing entry point.

## The Three Layers of Surface

```
┌──────────────────────────────────────────────────┐
│ LAYER 1: TRACKED                                 │
│ Test exists + YAML metadata → in surface.json    │  ← protocol knows
├──────────────────────────────────────────────────┤
│ LAYER 2: UNTRACKED                               │
│ Test exists, no YAML metadata                    │  ← surface scan finds
├──────────────────────────────────────────────────┤
│ LAYER 3: UNTESTED                                │
│ Entry point in code, no tests at all             │  ← surface discover finds
└──────────────────────────────────────────────────┘
```

## What Gets Discovered

| Type | Examples |
|------|---------|
| `api` | `app.get('/api/users', ...)` in Hono/Express, `get '/api/users'` in Rails |
| `page` | `src/pages/dashboard.astro`, `pages/settings.tsx` in Next.js |
| `cli` | `.command('deploy')` in Commander.js |
| `script` | `scripts.build` in `package.json` |
| `graphql` | `type Query { users: [User] }` in `.graphql` files |
| `webhook` | Routes matching `/webhook`, `/callback` patterns |

## Coverage Classification

Each discovered entry point is classified:

- **`covered`** — there's a test with YAML surface metadata that covers this entry point
- **`untracked`** — there's a test but no YAML surface metadata (run `surface backfill`)
- **`untested`** — no test coverage at all (run `surface capture` to create stubs)

## How Coverage Is Detected

### Explicit (precise)

Add a `covers` field to your test's YAML metadata:

```yaml
/*---
req: REQ-042
type: unit
area: auth
summary: Login endpoint validates credentials
covers:
  - "POST /api/auth/login"
  - "GET /api/auth/me"
---*/
```

This creates a direct, auditable link between a test and the entry points it covers.

### Heuristic (automatic)

Without explicit `covers` annotations, Surface Protocol uses two heuristics:

1. **String search** — if a test file contains the route path string (e.g. `"/api/auth/login"`), it's inferred to test that route
2. **File proximity** — if `tests/routes/auth.test.ts` mirrors `src/routes/auth.ts`, it's inferred to cover routes in that file

Heuristic matching is best-effort. Use explicit `covers` annotations for precise coverage tracking.

## Discovery Adapters

Discovery adapters auto-activate based on your project's dependencies:

| Adapter | Activates when |
|---------|----------------|
| `package-scripts` | `package.json` exists (always) |
| `hono-routes` | `hono` in `package.json` dependencies |
| `astro-pages` | `astro` in deps OR `src/pages/` exists |
| `commander-cli` | `commander` in dependencies |
| `rails-routes` | `config/routes.rb` exists |
| `graphql-schema` | `graphql` in deps OR `.graphql` files exist |

No configuration required. Run `surface discover` and it figures out which adapters apply.

## Saving Discovery Results

Use `--save` to persist the discovery report into `surface.json`:

```bash
surface discover --save
```

This adds a `discovered` section to `surface.json` that tools and dashboards can query. The section is regenerated each time you run `surface discover --save`.

## The `covers` Field

Extend any test's YAML metadata with explicit entry point coverage:

```yaml
/*---
req: REQ-001
type: e2e
area: checkout
summary: Checkout flow completes purchase
covers:
  - "POST /api/orders"
  - "GET /api/orders/:id"
  - "/checkout"
---*/
```

This enables `surface discover` to show accurate coverage without relying on heuristics, and makes the relationship between tests and product surface explicit and queryable.

## CI Integration

```yaml
# Check for untested entry points (informational)
- run: npx surface discover

# Fail CI if any entry points are untested
- run: npx surface discover --exit-code

# Check for test drift AND untested entry points
- run: |
    npx surface scan --exit-code
    npx surface discover --exit-code
```

## Bootstrapping an Existing Codebase

1. **Discover the actual surface**: `surface discover`
2. **Backfill existing tests**: `surface backfill --all --yes`
3. **Regenerate surface.json**: `surface gen`
4. **Verify clean**: `surface scan --exit-code`
5. **Capture untested entry points**: Use `surface capture` for entry points with no tests

The result is a complete, auditable surface map for a product that existed before the protocol was introduced.
