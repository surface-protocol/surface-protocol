# Architecture

## Adapter System

Surface Protocol supports multiple test frameworks through a pluggable adapter system.

### How It Works

Each adapter implements the `StackAdapter` interface, which defines:

| Property | Purpose |
|----------|---------|
| `name` | Unique identifier (e.g., `typescript-vitest`) |
| `filePatterns` | Glob patterns for test file discovery |
| `commentFormat` | How YAML frontmatter is embedded (JS blocks, hash comments, etc.) |
| `stubTemplate` | Generates test stub files from metadata |
| `assertionPatterns` | Regex patterns that indicate real assertions exist |
| `stubPatterns` | Regex patterns that indicate a test is pending |
| `skipPatterns` | Regex patterns that indicate a test is skipped |
| `testCommand` | Command to run the test suite |
| `describePattern` | Regex to find describe/context blocks |
| `itPattern` | Regex to find it/test/example blocks |

### Built-in Adapters

- **`typescript-vitest`** — TypeScript/JavaScript with Vitest and Playwright
- **`ruby-rspec`** — Ruby with RSpec

### Adding a New Adapter

1. Create a new file in `src/lib/adapters/` (e.g., `python-pytest.ts`)
2. Implement the `StackAdapter` interface
3. Call `registerAdapter()` in the file's module scope
4. Import the file from `src/lib/adapters/index.ts`

Example skeleton:

```typescript
import type { TestMetadata } from "../types.js";
import { registerAdapter } from "./adapter.js";

registerAdapter({
  name: "python-pytest",
  description: "Python + pytest",
  filePatterns: ["**/test_*.py", "**/*_test.py"],
  commentFormat: {
    name: "python-triple",
    openPattern: '"""---',
    closePattern: '---"""',
    openLiteral: '"""---\n',
    closeLiteral: '---"""\n',
    languages: ["python"],
  },
  stubTemplate: (metadata: TestMetadata) => {
    const id = metadata.req ?? metadata.flow ?? "REQ-XXX";
    return `"""---\nreq: ${id}\ntype: ${metadata.type ?? "unit"}\nsummary: ${metadata.summary ?? ""}\n---"""\n\ndef test_${id.toLowerCase().replace("-", "_")}():\n    pytest.skip("TODO")\n`;
  },
  assertionPatterns: [/assert\s/, /assertEqual/, /assertTrue/, /assertIn/],
  stubPatterns: [/pytest\.skip/, /pass\s*$/m],
  skipPatterns: [/@pytest\.mark\.skip/, /pytest\.skip/],
  testCommand: "pytest",
  describePattern: /class\s+Test\w+/,
  itPattern: /def\s+test_\w+/,
});
```

## Comment Formats

YAML frontmatter can be embedded in different comment styles:

| Format | Languages | Opening | Closing |
|--------|-----------|---------|---------|
| JS Block | TypeScript, JavaScript | `/*---` | `---*/` |
| Hash Block | Ruby, Python, YAML | `# ---` | `# ---` |

Each format is registered in the `FORMAT_REGISTRY` and matched by the parser.

## Data Flow

```
Test Files (*.test.ts, *_spec.rb)
    |
    v
Parser + Comment Formats
    |
    v
YAML Metadata Extraction
    |
    v
Implementation Status Detection (stub/complete/skipped)
    |
    v
Lifecycle Stage Detection (stub/coded/tested/deployed)
    |
    v
Requirement Objects
    |
    v
Categorized (requirements/regressions/flows/contracts)
    |
    v
SurfaceMap
    |
    +-- surface.json (queryable truth)
    +-- SURFACE.md (human overview)
    +-- docs/features/*.md (per-area docs)
```
