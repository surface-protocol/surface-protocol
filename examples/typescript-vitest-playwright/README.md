# TypeScript + Vitest/Playwright Example

This example shows the Surface Protocol footprint for a TypeScript project
using Vitest for unit tests and Playwright for E2E tests.

## What's Here

- `surfaceprotocol.settings.json` — adapter config (`typescript-vitest`)
- `tests/requirements/` — test stubs with YAML frontmatter
- `surface.json` — generated surface map
- `SURFACE.md` — human-readable surface map
- `CLAUDE.md` — routing stub for Claude Code
- `.surface/` — state directory (ID counter, sources)

## Try It

```bash
# From the surface-protocol repo root:
bun run src/cli/index.ts gen --output examples/typescript-vitest-playwright
bun run src/cli/index.ts check --dir examples/typescript-vitest-playwright
```
