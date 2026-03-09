# Interaction Points

The Surface has three interaction layers.

## 1. Claude Skills

These are the human-facing entry points:

- `surface/capture`
- `surface/implement`
- `surface/ship`
- `surface/problem`
- `surface/quickfix`
- `surface/learn`
- `surface/check`
- `surface/inline`

Use skills for intent. Use the CLI for repeatable mechanics.

## 2. Core CLI

The core CLI owns target-repo setup, queries, and generation:

- `init` — initialize Surface Protocol in a project
- `gen` — generate surface.json, SURFACE.md, docs/features/
- `check` — validate coverage, freshness, gaps, overrides, lifecycle
- `query` — filter requirements by file/tag/type/id/staged/dangerous
- `metrics` — adoption tracking via commit trailers

## 3. Target Repo Files

These are the durable interaction points inside a managed target repo:

- `surfaceprotocol.settings.json`
- `.surface/`
- `surface.json`
- `SURFACE.md`
- `CLAUDE.md`

If a future change needs more than those by default, it should be treated as
host-repo scope creep and justified explicitly.
