# Getting Started

## Prerequisites

- Node.js >= 18 (or Bun)
- Git
- Claude Code >= 1.0.33 (for the plugin — CLI works without it)

## 1. Install the CLI

```bash
npm install -D @surface-protocol/cli
```

## 2. Initialize Your Project

```bash
npx surface init
```

This creates `surfaceprotocol.settings.json`, an empty `surface.json`, and the `.surface/` state directory.

For Ruby projects, specify the adapter:

```bash
npx surface init --adapter ruby-rspec
```

## 3. Add Metadata to a Test

**TypeScript:**
```typescript
/*---
req: REQ-001
type: unit
summary: User login requires valid credentials
tags: [auth, security]
---*/
describe("auth", () => {
  it("requires valid credentials", () => {
    // your test code
  });
});
```

**Ruby:**
```ruby
#---
# req: REQ-001
# type: unit
# summary: User login requires valid credentials
# tags: [auth, security]
#---
RSpec.describe "auth" do
  it "requires valid credentials" do
    # your test code
  end
end
```

## 4. Generate the Surface Map

```bash
npx surface gen
```

## 5. (Optional) Install the Claude Code Plugin

```
/plugin marketplace add surface-protocol/surface-protocol
/plugin install surface-protocol@surface
```

## 6. Validate

```bash
npx surface check
```

## Adopting Surface Protocol on an Existing Codebase

If your product was built before Surface Protocol (or had features added outside the protocol), use `surface scan` and `/surface:backfill` to catch up without losing history.

### Step 1 — Find tests without surface metadata

```bash
npx surface scan
```

Shows tests that exist but haven't been annotated with YAML frontmatter.

### Step 2 — Smart backfill with `/surface:backfill`

In Claude Code, run:

```
/surface:backfill
```

This is the recommended path. The skill:
1. Groups tests by `describe` block (one requirement per group, not per test)
2. Reads your implementation code to understand what each test exercises
3. Uses product context from CLAUDE.md to write meaningful rationale
4. Generates acceptance criteria from `it()` labels
5. Presents each group for your approval before writing

**For fast bootstrapping without enrichment** (CI or batch mode):

```bash
npx surface backfill --all --dry-run   # preview
npx surface backfill --all --yes       # write (bare-bones metadata only)
```

### Step 3 — Lock the surface

Run `surface gen` to regenerate `surface.json` with all the new metadata. This establishes the known-good baseline that the protocol will protect going forward.

```bash
npx surface gen
npx surface scan --exit-code   # should exit 0
```

---

## Ongoing Workflow

Add `surface scan --exit-code` to your CI pipeline to catch drift as it happens:

```yaml
# .github/workflows/surface.yml
- name: Surface drift check
  run: npx surface scan --exit-code
```

---

## Next Steps

- [Configuration](configuration.md) — all settings, output paths, monorepo setup
- [YAML Reference](yaml-reference.md) — all metadata fields
- [CLI Reference](cli-reference.md) — all commands
- [Philosophy](philosophy.md) — why things work this way
