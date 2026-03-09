# Contributing to Surface Protocol

Thanks for considering contributing. This project is a proof of concept and we genuinely want feedback — both positive and critical.

## Ways to Contribute

### Challenge the Concept

The most valuable contribution right now is honest feedback. Open an issue if:

- You've tried similar approaches and found pitfalls we haven't considered
- You see fundamental problems with the metadata-in-tests approach
- You have ideas for alternative designs that achieve the same goals

### Add a Stack Adapter

Want to use Surface Protocol with a stack we don't support yet? See [docs/architecture.md](docs/architecture.md) for how adapters work, then submit a PR.

### Fix Bugs or Improve Docs

Standard GitHub flow: fork, branch, PR.

## Development Setup

```bash
# Clone and install
git clone https://github.com/surface-protocol/surface-protocol.git
cd surface-protocol
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run check
```

## Plugin Development

The Claude Code plugin lives in `plugin/` with skills, hooks, and scripts. There are two workflows for iterating on the plugin, depending on what you're changing.

### Skill hot-reload (fastest)

Symlink the plugin's skills into a target repo's `.claude/skills/` directory. Claude Code monitors `.claude/skills/` and hot-reloads changes mid-session — no restart needed.

```bash
# From within your target repo
mkdir -p .claude/skills
ln -s /path/to/surface-protocol/plugin/skills/capture .claude/skills/surface-capture
ln -s /path/to/surface-protocol/plugin/skills/check .claude/skills/surface-check
# ... repeat for other skills you're iterating on
```

Edit the skill's `SKILL.md`, and the changes are live in your current session. Best for iterating on skill prompts and workflows.

### Full plugin testing (hooks + MCP + skills)

Use `--plugin-dir` to load the entire plugin from source, bypassing the plugin cache:

```bash
# From within your target repo
claude --plugin-dir /path/to/surface-protocol/plugin
```

This loads skills, hooks, and MCP servers directly from the filesystem — no version bumping or cache clearing needed. However, changes require starting a new Claude Code session to take effect.

### Testing against fixture repos

The repo includes fixture projects you can test against:

- `tests/fixtures/vitest-project/` — TypeScript + Vitest
- `tests/fixtures/playwright-project/` — Playwright E2E
- `tests/fixtures/rspec-project/` — Ruby + RSpec

```bash
cd tests/fixtures/vitest-project
claude --plugin-dir ../../../plugin
```

### Debugging

Use `claude --debug` to see plugin loading details, component discovery, and hook registration.

## Commit Messages

We use [conventional commits](https://www.conventionalcommits.org/):

```
feat(core): add Python adapter support
```

Types: `feat`, `fix`, `refactor`, `test`, `spec`, `docs`, `chore`

## Code Style

- TypeScript strict mode, always
- Biome for formatting and linting
- No `any` — use `unknown` and narrow
- Tests go in `tests/` mirroring the `src/` structure
