# The Visual Surface Gap

> Status: Open research question. No implementation planned.

## The Gap

Surface Protocol captures **behavioral surface** — what the product does — through test metadata. Tests assert that login works, that checkout completes, that data saves correctly. This is the product's behavior, and the protocol tracks it well.

But the product's surface is more than behavior. It's also **what users see and touch**: the layout, the colors, the component structure, the way a form is arranged on screen, the animation when a modal opens. This is the visual surface, and the protocol has no structured way to capture it.

A test can assert that a button exists and that clicking it submits a form. It cannot assert that the button is blue, 44px tall, positioned below the email field, and uses the Inter font. These are properties users have built muscle memory around. When an AI agent changes them without knowing they matter, users experience churn.

This is a significant gap for a protocol about product continuity.

## What the Protocol Can Do Today

The protocol isn't completely blind to visual surface. Several existing features touch on it:

### Placeholders

[Placeholders](../placeholders.md) track planned UI touchpoints before they're designed or built. They support:

- **Lifecycle tracking**: `not-designed` → `in-design` → `ready-for-implementation` → `in-progress`
- **Figma references**: `figma_id` field links to Figma frames/components
- **Interaction descriptions**: `interaction` field describes user flows (e.g., "Click avatar → file picker → crop modal → save")
- **Dependency tracking**: `blocked_by` field tracks design blockers

This gives agents visibility into what's coming, but not into what already exists visually.

### UI Selector Contract

[Selectors](../selectors.md) define a stable interface between tests and UI: `data-test-id` for components, `component.verb` for actions. This stabilizes the testable surface of the UI — agents know which elements exist and how to interact with them — but it doesn't capture their visual properties.

### Audience Tags

The `user-facing`, `admin-facing`, and `backend` tags classify which requirements touch real users. This lets agents know which changes have the highest visual impact, even if the visual details aren't captured.

### E2E Flow Tests

`FLOW-XXX` tests verify complete user journeys. Combined with Playwright, these can include visual assertions (screenshot comparisons), though the protocol doesn't formalize this.

### Constraints

`constraints.json` can restrict component libraries (`"allowed_sources": [{"source": "shadcn"}]`), forbidden patterns (`"inline-styles"`, `"css-in-js-runtime"`), and forbidden dependencies. This constrains implementation choices but doesn't describe what the visual result should look like.

### Source References

The `source` field on test metadata tracks where a requirement came from (GitHub issue, Jira ticket, etc.). Adding `"figma"` as a source type would let requirements trace their visual origin.

## A Practical UI Dev Cycle with Current Tools

Today, a team building a feature that includes UI can use Surface Protocol like this:

1. **Capture**: Create a placeholder with `figma_id`, `interaction`, and `blocked_by` fields. The placeholder tracks the UI touchpoint as it moves through design.

2. **Design**: Update placeholder status from `not-designed` → `in-design` → `ready-for-implementation` as the Figma progresses.

3. **Spec**: Once design is approved, create test stubs with acceptance criteria that describe testable visual behavior:
   ```yaml
   acceptance:
     - Login form has email and password fields
     - Submit button is below the form fields
     - Error messages appear below each field
     - Form validates on blur
   ```

4. **Implement**: Agent reads placeholders + acceptance criteria + constraints before building. It knows which components are allowed, what the interaction flow should be, and what the acceptance criteria require.

5. **Verify**: E2e tests confirm user-facing flows work. Playwright visual comparison tests can catch visual regressions (though this isn't formalized in the protocol).

This works, but it has clear limitations. The acceptance criteria are prose descriptions of visual behavior, not structured design data. An agent reading "Submit button is below the form fields" has less to work with than an agent reading structured layout specifications.

## Open Questions

### Can Figma data be structurally useful?

What can we actually extract from Figma that an agent could use? Possibilities range from simple (component names, hierarchy, screen list) to complex (design tokens, layout constraints, responsive breakpoints). The Figma API exposes deeply nested vector data — translating that into structured requirements is a large unsolved problem. Is it more practical to treat Figma as a reference (screenshots, links) rather than as structured input?

### Are style guides constraints or surface?

A style guide says "primary buttons are blue, 44px tall, with 16px rounded corners." Is this:
- A **constraint** (rule agents must follow when building)? Then it extends `constraints.json`.
- A **surface property** (description of what users see)? Then it belongs in `surface.json`.
- A **reference document** (thing agents should read)? Then it's documentation, not protocol data.

Surface Protocol tracks requirements and their status. It doesn't enforce rules — that's the job of linters, design token systems, and CI checks. If a style guide is enforcement, it may not belong in the protocol. If it's documentation of the visual surface, it might.

### Should the protocol track implementation architecture?

Component composition patterns ("always use Stack for vertical layout"), iteration rules ("new components start as placeholders"), and animation conventions ("modals slide up in 200ms") describe *how* to build, not *what* users see. This is implementation architecture — arguably below the surface.

The protocol was designed to stay at the surface level: what the product does and what users interact with. Expanding into implementation architecture changes the protocol's scope. This might be necessary, or it might dilute its focus.

### Could visual regression testing be the answer?

Screenshot-based testing (Playwright `toHaveScreenshot()`, Percy, Chromatic) asserts what the product looks like by comparing rendered output against baselines. This is, in effect, a "test" for visual surface — the same way unit tests are the "test" for behavioral surface.

If visual regression tests had Surface Protocol metadata (YAML frontmatter with `type: visual`, `area: auth`, `summary: Login form layout matches approved design`), the protocol could track visual surface the same way it tracks behavioral surface. The question is whether this is practical and whether teams would adopt it.

### Where does "design system" end and "product surface" begin?

A design system (Tailwind config, shadcn/ui theme, design tokens) constrains the visual vocabulary. The product surface is the result of applying that vocabulary to specific screens. The protocol might need to distinguish between:
- **Design system**: the palette of available building blocks (constraint-level)
- **Screen specifications**: how those blocks are assembled for each view (surface-level)
- **Visual regression baselines**: what the assembled result actually looks like (test-level)

## Possible Future Directions

These are sketches, not plans. Each requires further research.

- **`source.type: "figma"`** — Add Figma as a source type for traceability. Minimal change, immediate value. *(Included in this PR.)*
- **Visual regression as surface tests** — Formalize Playwright visual comparisons as a test type with metadata. Would close the gap through existing protocol mechanics (tests are the spec).
- **Design tokens in constraints** — Extend `constraints.json` with a `design_tokens` section for colors, typography, spacing. Agents read tokens before making visual changes.
- **Placeholder graduation workflow** — Formalize how placeholders transition to requirements as designs are approved. Currently documented but not enforced.
