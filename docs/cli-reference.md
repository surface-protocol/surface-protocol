# CLI Reference

## Installation

```bash
npm install -D @surface-protocol/cli
# or
bun add -D @surface-protocol/cli
```

Run commands with `npx surface <command>` or `bunx surface <command>`.

---

## `surface init`

Initialize Surface Protocol in a project. Creates config, empty surface map, and state directory.

```bash
surface init [options]
```

| Option | Description |
|--------|-------------|
| `--dir <path>` | Project directory (default: `.`) |
| `--adapter <adapter>` | Stack adapter: `typescript-vitest`, `ruby-rspec` (default: `typescript-vitest`) |

Creates:
- `surfaceprotocol.settings.json` — configuration
- `surface.json` — empty surface map
- `SURFACE.md` — human-readable view
- `.surface/` — state directory (sources, learnings, ID counter)
- `CLAUDE.md` — routing stub (only if it doesn't already exist)

---

## `surface gen`

Generate `surface.json`, `SURFACE.md`, and `docs/features/` from test metadata.

```bash
surface gen [options]
```

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (default: `.`) |
| `-s, --status` | Just check if current — exits 0 if fresh, 1 if stale |
| `-q, --quiet` | Minimal output |

Uses write-if-changed optimization — only writes files when content differs.

---

## `surface check`

Validate coverage, freshness, gaps, overrides, and lifecycle stages.

```bash
surface check [options]
```

| Option | Description |
|--------|-------------|
| `--coverage` | Report coverage percentages by type and area |
| `--freshness` | Compare git blame dates vs `@changed` metadata dates |
| `--gaps` | Find test files with no YAML metadata |
| `--placeholders` | List pending/skip tests awaiting implementation |
| `--overrides` | Check for expired override approvals |
| `--lifecycle` | Show lifecycle stage breakdown (stub/coded/tested/deployed) |
| `--reconcile` | Check for missing or stale source documents in `.surface/sources/` |
| `--json` | Machine-readable JSON output |

With no flags, runs all checks.

---

## `surface query`

Query requirements from `surface.json`.

```bash
surface query [options]
```

| Option | Description |
|--------|-------------|
| `--file <path>` | Requirements for a specific file |
| `--tag <tag>` | Filter by tag |
| `--type <type>` | Filter by test type (unit, e2e, regression, etc.) |
| `--dangerous` | Show only DANGEROUS requirements (critical, security, compliance, blocking) |
| `--staged` | Only requirements in git-staged files |
| `--id <id>` | Get a specific requirement by ID |
| `--json` | Machine-readable JSON output |

---

## `surface metrics`

Track Surface Protocol adoption — what % of commits flow through the protocol vs bypass it.

```bash
surface metrics [options]
```

| Option | Description |
|--------|-------------|
| `--since <range>` | Date or git range (default: `"30 days ago"`) |
| `--json` | Machine-readable JSON output |
| `--verbose` | Show each commit's classification |

Classifies commits by detecting:
- `Surface-Protocol:` trailers (capture, implement, ship, quickfix, problem, learn)
- `Affects: REQ-XXX` references
- Requirement IDs in commit subjects
- Bypass categories (ci-infra, docs, config, test, unknown)
