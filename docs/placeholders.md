# Placeholders

Placeholders track planned surface touchpoints — usually UI components — that have been identified but not yet designed or built. They give agents visibility into what's coming, so they can avoid building something that conflicts with a planned feature.

## Lifecycle

```
not-designed → in-design → ready-for-implementation → in-progress
```

| Status | Meaning |
|--------|---------|
| `not-designed` | The touchpoint is identified but has no design yet |
| `in-design` | A Figma or design artifact is being created |
| `ready-for-implementation` | Design is approved and ready to build |
| `in-progress` | Implementation has started |

Once a placeholder reaches implementation, it transitions to a regular requirement with test metadata and follows the standard [lifecycle stages](status-model.md) (stub → coded → tested → deployed).

## YAML Metadata

Placeholders use the `placeholder` field in test metadata:

```typescript
/*---
req: REQ-087
type: unit
summary: Patient avatar upload component
area: profile
placeholder: not-designed
description: Allow patients to upload and crop a profile photo
interaction: Click avatar → file picker → crop modal → save
blocked_by: Design system avatar component
figma_id: fig-abc123
tags: [user-facing]
---*/
it.todo('renders avatar upload component')
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `placeholder` | Yes | Current status: `not-designed`, `in-design`, `ready-for-implementation`, `in-progress` |
| `description` | No | What this touchpoint does |
| `interaction` | No | How users interact with it (click flow, gestures, etc.) |
| `blocked_by` | No | What's blocking progress (e.g., design dependency) |
| `figma_id` | No | Link to Figma frame or component |

## In surface.json

Placeholders appear in the `placeholders[]` array of the surface map:

```json
{
  "placeholders": [
    {
      "component": "REQ-087",
      "status": "not-designed",
      "created": "2026-01-15",
      "description": "Allow patients to upload and crop a profile photo",
      "interaction": "Click avatar → file picker → crop modal → save",
      "blocked_by": "Design system avatar component",
      "figma_id": "fig-abc123"
    }
  ]
}
```

## Querying Placeholders

```bash
# Show all placeholders in surface check output
surface check --placeholders

# JSON output for tooling
surface check --placeholders --json
```

## When to Use Placeholders

- **UI components** that need design before implementation
- **Features blocked** by external dependencies (design system, API, etc.)
- **Planned touchpoints** that agents should know about to avoid conflicts

Placeholders are not meant for backend work or internal services. Use regular `status: pending` test stubs for those.
