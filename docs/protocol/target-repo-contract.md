# Target Repo Contract

Use **target repo** as the generic term for the repository Claude is managing.

## Required Files

- `surfaceprotocol.settings.json`
- `.surface/`
- `surface.json`
- `SURFACE.md`
- `CLAUDE.md`

## Config Shape

`surfaceprotocol.settings.json` holds:

- adapter selection
- output file locations (configurable — see [Configuration](../configuration.md))
- test file patterns
- requirement ID prefixes
- dangerous tags
- commit conventions
- implicit detection settings

See [Configuration](../configuration.md) for the full reference and monorepo setup.

## Selector Contract

- `data-test-id` identifies stable components and actions.
- Component ids are nouns in kebab-case.
- Action ids are `<component>.<verb>`.
- Repeated items use `data-test-instance`.

## Commit Contract

- Subject uses conventional commits.
- `Affects:` is required when requirements change.
- `Surface-Protocol:` trailers track flow type.

## Routing Contract

The target repo `CLAUDE.md` should stay tiny.

- Route real feature work, bug work, problem definitions, and thread learnings
  into Surface.
- Do not route trivial edits into Surface by default.
- Keep workflows in the plugin skills, not in target-repo memory.
