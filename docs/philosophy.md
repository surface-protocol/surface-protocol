# Philosophy

> Tests are the spec. surface.json is the queryable truth. Git is the backbone.

## The Problem

Requirements live in one place. Code lives in another. Tests live in a third. Over time, they drift apart. The Jira ticket says one thing, the code does another, and the tests — if they exist — verify something else entirely.

This isn't a tooling problem. It's a physics problem. Information that lives in separate systems always drifts. The only way to prevent drift is to collapse the distance to zero.

### The One-Shot Problem

AI agents work one shot at a time. Each shot is competent. But one shot after one shot doesn't build a product that users get used to, love, and rely on.

This isn't a memory problem — agents don't need to remember your internal implementation. It's a **surface** problem. The surface is what users see, touch, and interact with: the touchpoints, the interfaces, the interactions that become muscle memory. Without knowing the product's surface, agents reshape things that should stay stable.

A released product isn't a greenfield. Users have expectations. They find things in certain places. Product continuity matters. Surface Protocol makes the product surface explicit — a structured, queryable map of every touchpoint — so agents know what the product looks like before they change it.

## The Bet

Surface Protocol makes a bet: **embed requirements directly in tests as structured metadata.** If it's not in a test, it's not a requirement. If the test passes, the requirement is met. If the test doesn't exist, the requirement doesn't exist.

This is an opinionated bet. It won't work for everyone. But for teams that value:
- Knowing exactly what their system does (and doesn't do)
- Having one source of truth they can query programmatically
- Making requirements impossible to ignore during development
- Tracking how much work flows through a defined process vs around it

...it might be worth trying.

## Core Principles

### 1. Tests Are the Spec

Every requirement is a test. Every test has metadata. The metadata describes what the test proves, why it matters, and where it came from.

### 2. surface.json Is the Queryable Truth

`surface.json` is auto-generated from test metadata. It's the queryable truth — one file that knows every requirement, its status, who changed it, whether it's tested, and whether it's dangerous.

You never edit it by hand. You edit tests. Then you run `surface gen`.

### 3. Git Is the Backbone

Commits are documentation. The `Surface-Protocol:` trailer tracks how work flows. The `Affects: REQ-XXX` trailer connects changes to requirements.

### 4. Stubs Before Code

Capture requirements as test stubs before writing implementation. This forces you to think about what you're building before you build it.

### 5. Drift Is the Enemy

The moment requirements leave the codebase, they start drifting. Surface Protocol keeps them embedded in the only place that matters: the tests.

## Known Gaps

The protocol currently captures behavioral surface — what the product does — but not visual surface — what users see and touch. Design specs, style guides, and component patterns live outside the surface map. This is a significant gap for product continuity. See [The Visual Surface Gap](research/visual-surface-gap.md) for analysis and open research questions.

## What This Is Not

- **Not a replacement for Jira/Linear.** Those tools handle project management. Surface Protocol handles requirement truth.
- **Not a test framework.** It's metadata alongside your tests. Use whatever framework you want.
- **Not production-ready.** This is a proof of concept. We're open-sourcing it to find blind spots.

## The Stance

Surface Protocol is opinionated. We believe:
- If you can't query it, you don't know it
- If it's not tested, it's not a requirement
- "The tests pass" is necessary but not sufficient — did you verify what the *user* sees?
- Adoption metrics are not surveillance. They're self-awareness.

We could be wrong about all of this. That's why we're putting it out there.
