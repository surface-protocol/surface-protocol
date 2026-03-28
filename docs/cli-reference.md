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

## `surface scan`

Detect drift between your test files and `surface.json`.

Use this when code was written or tests were added outside the Surface Protocol workflow — it shows exactly what the protocol doesn't know about yet.

```bash
surface scan [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Machine-readable `DriftReport` JSON |
| `--exit-code` | Exit 1 if any drift detected (opt-in CI gate) |
| `--untracked` | Show only untracked tests (no YAML metadata) |
| `--ghosts` | Show only ghost entries (deleted/renamed test files) |
| `--status-drift` | Show only implementation status changes |
| `--quiet` | Counts only, no per-item details |

**Output categories:**
- **Untracked tests** — `it()` blocks with no YAML frontmatter
- **Ghost entries** — requirements in `surface.json` whose test files were deleted or renamed
- **Status drift** — tests whose stub/complete status changed since last `surface gen`

**Exit codes:** `0` = clean, `1` = drift + `--exit-code`, `2` = fatal error

By default, `surface scan` exits 0 even when drift exists (informational). Use `--exit-code` to make it a CI gate.

```bash
# Informational (always exits 0)
surface scan

# CI gate — fails if any drift
surface scan --exit-code

# Only show untested tests
surface scan --untracked
```

---

## `surface backfill`

Auto-annotate untracked tests with inferred YAML frontmatter. Use this to bootstrap Surface Protocol on an existing codebase, or to catch up after building features without the protocol.

For **enriched metadata** (rationale, acceptance criteria, tags), use the `/surface:backfill` skill in Claude Code instead of the CLI. The CLI produces structural metadata only.

```bash
surface backfill [options]
```

| Option | Description |
|--------|-------------|
| `--all` | Backfill all untracked tests |
| `--file <path>` | Backfill only one specific file |
| `--dry-run` | Preview injections without writing |
| `--dry-run --json` | Structured JSON output with test groups and imports (for skill consumption) |
| `--yes` | Skip confirmation prompt (auto-implied in CI) |
| `--no-gen` | Skip running `surface gen` after backfill |
| `--type <type>` | Override inferred test type for all backfills |
| `--area <area>` | Override inferred area for all backfills |
| `--json` | JSON output |

**Inference rules:**
- `area` — inferred from path segments (`src/auth/` → `auth`)
- `type` — inferred from path hints (`/e2e/` → `e2e`, default → `unit`)
- `summary` — cleaned from test label + describe context
- `id` — auto-allocated from `.surface/state/id-counter`
- `source.type` — set to `implementation` (signals "inferred, needs human review")

**Backfilled annotations are drafts.** Review summaries, areas, and add acceptance criteria after backfilling.

```bash
# Bootstrap: preview all, then write
surface backfill --all --dry-run
surface backfill --all --yes

# Backfill one file
surface backfill --file tests/auth/login.test.ts

# Structured JSON for the /surface:backfill skill
surface backfill --all --dry-run --json
```

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
