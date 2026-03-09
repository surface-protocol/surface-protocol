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

## Next Steps

- [Configuration](configuration.md) — all settings, output paths, monorepo setup
- [YAML Reference](yaml-reference.md) — all metadata fields
- [CLI Reference](cli-reference.md) — all commands
- [Philosophy](philosophy.md) — why things work this way
