# Configuration

Surface Protocol is configured via `surfaceprotocol.settings.json` in your project root.

## Minimal Config

```json
{
  "adapter": "typescript-vitest"
}
```

Everything else has sensible defaults.

## Full Reference

```json
{
  "adapter": "typescript-vitest",
  "testFilePatterns": ["**/*.test.ts"],
  "idPrefixes": {
    "requirement": "REQ",
    "flow": "FLOW",
    "contract": "CONTRACT",
    "smoke": "SMOKE",
    "regression": "REGR"
  },
  "output": {
    "surfaceJson": "surface.json",
    "surfaceMd": "SURFACE.md",
    "featureDocs": "docs/features"
  },
  "areas": {},
  "tagCategories": {
    "dangerous": ["critical", "compliance", "security", "blocking"],
    "audience": ["user-facing", "admin-facing", "backend"]
  },
  "commitConventions": {
    "specPrefix": "spec",
    "implPrefix": "feat",
    "requireAffects": true,
    "trailerValues": ["capture", "implement", "ship", "quickfix", "problem", "learn", "reconcile"]
  },
  "implicitDetection": {
    "enabled": true,
    "requireConfirmation": true
  }
}
```

### Fields

| Field | Default | Description |
|-------|---------|-------------|
| `adapter` | `"typescript-vitest"` | Stack adapter. Options: `typescript-vitest`, `ruby-rspec` |
| `testFilePatterns` | *(from adapter)* | Glob patterns for test file discovery. Overrides adapter defaults |
| `idPrefixes` | `REQ`, `FLOW`, etc. | Prefixes for auto-generated requirement IDs |
| `output` | see below | Where generated files are written |
| `areas` | `{}` | Area definitions for grouping requirements |
| `tagCategories.dangerous` | `["critical", ...]` | Tags that trigger DANGEROUS classification |
| `tagCategories.audience` | `["user-facing", ...]` | Audience classification tags |
| `commitConventions` | see below | Git commit message conventions |
| `implicitDetection` | `{ enabled: true }` | Claude Code plugin auto-detection settings |

### Output Paths

| Field | Default | Description |
|-------|---------|-------------|
| `output.surfaceJson` | `"surface.json"` | Path for the machine-readable surface map |
| `output.surfaceMd` | `"SURFACE.md"` | Path for the human-readable markdown view |
| `output.featureDocs` | `"docs/features"` | Directory for per-area feature documentation |

All paths are relative to the project root (where `surfaceprotocol.settings.json` lives).

## Monorepo Setup

In a monorepo, each package that uses Surface Protocol gets its own `surfaceprotocol.settings.json`. Configure output paths to keep generated files contained:

```
my-monorepo/
├── packages/
│   ├── api/
│   │   ├── surfaceprotocol.settings.json
│   │   ├── tests/
│   │   └── .surface/
│   │       ├── state/
│   │       ├── sources/
│   │       └── output/
│   │           ├── surface.json
│   │           ├── SURFACE.md
│   │           └── docs/features/
│   └── web/
│       ├── surfaceprotocol.settings.json
│       ├── tests/
│       └── .surface/
│           └── output/
│               └── ...
```

Each package's config routes outputs into `.surface/output/`:

```json
{
  "adapter": "typescript-vitest",
  "output": {
    "surfaceJson": ".surface/output/surface.json",
    "surfaceMd": ".surface/output/SURFACE.md",
    "featureDocs": ".surface/output/docs/features"
  }
}
```

Run commands from each package directory:

```bash
cd packages/api
npx surface gen
npx surface check
```

Add `.surface/output/` to your `.gitignore` if you don't want generated files in version control, or commit `surface.json` if other tooling reads it.

## Recommended .gitignore

```gitignore
# Surface Protocol
.surface/output/SURFACE.md
.surface/output/docs/
```

Keep `surface.json` committed if CI or other tools consume it. The `writeIfContentChanged` optimization ensures it's only rewritten when actual content changes — timestamp-only differences are ignored.
