# Badges

Display Surface Protocol badges in your README to signal that your project uses test-driven requirement tracking.

## Quick Start

Run `surface badge --snippet` to get copy-pasteable markdown for all badge types.

## Badge Types

### Static "Built with" Badge (shields.io)

The simplest option. Uses shields.io CDN with the Surface Protocol brand color and logo.

```markdown
[![Built with Surface Protocol](https://img.shields.io/badge/built%20with-Surface%20Protocol-6C3CE1?style=flat&logo=data:image/svg%2bxml;base64,...&logoColor=white)](https://github.com/surface-protocol/surface-protocol)
```

Generate the full URL with:

```bash
surface badge --format shields
```

### Custom Gradient Badge

A custom SVG badge with the signature violet-to-cyan gradient. Stands out visually alongside standard shields.io badges.

```markdown
[![Built with Surface Protocol](https://raw.githubusercontent.com/surface-protocol/surface-protocol/main/assets/badges/built-with-surface-protocol.svg)](https://github.com/surface-protocol/surface-protocol)
```

Generate with:

```bash
surface badge --format custom
```

### Dynamic Coverage Badge

Shows your project's surface coverage percentage in real time. Automatically updated whenever you run `surface gen`.

```markdown
[![Surface Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/OWNER/REPO/main/surface-badge.json)](https://github.com/surface-protocol/surface-protocol)
```

**Setup:**

1. Run `surface gen` — this writes `surface-badge.json` alongside `surface.json`
2. Commit `surface-badge.json` to your repo
3. Add the badge markdown to your README (use `surface badge --format endpoint`)

The badge color scales with coverage:
- **Bright green** — 90%+
- **Green** — 75-89%
- **Yellow** — 50-74%
- **Orange** — 25-49%
- **Red** — below 25%

## Badge Styles

All shields.io badges support style variants via query parameter:

| Style | URL param |
|-------|-----------|
| Flat (default) | `?style=flat` |
| Flat square | `?style=flat-square` |
| Plastic | `?style=plastic` |
| For the badge | `?style=for-the-badge` |
| Social | `?style=social` |

Example: append `&style=for-the-badge` to any shields.io badge URL for a larger badge.

## CLI Reference

```bash
surface badge                    # Write surface-badge.json
surface badge --snippet          # Print all badge markdown snippets
surface badge --format shields   # Print shields.io static badge markdown
surface badge --format custom    # Print custom SVG badge markdown
surface badge --format endpoint  # Print dynamic coverage badge markdown
```

## Automatic Badge Injection

When you run `surface init` on a project that has a `README.md`, the shields.io badge is automatically added after the first heading.
