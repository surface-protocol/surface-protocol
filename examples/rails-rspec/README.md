# Rails + RSpec Example

This example shows the Surface Protocol footprint for a Ruby on Rails project
using RSpec for tests. Metadata uses the hash-block comment format (`# ---`).

## What's Here

- `surfaceprotocol.settings.json` — adapter config (`ruby-rspec`)
- `spec/requirements/` — RSpec test stubs with YAML frontmatter
- `surface.json` — generated surface map
- `SURFACE.md` — human-readable surface map
- `CLAUDE.md` — routing stub for Claude Code
- `.surface/` — state directory (ID counter, sources)

## Try It

```bash
# From the surface-protocol repo root:
bun run src/cli/index.ts gen --output examples/rails-rspec
bun run src/cli/index.ts check --dir examples/rails-rspec
```
