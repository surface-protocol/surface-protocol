## Surface Protocol

When `surfaceprotocol.settings.json` exists in the project root, route feature requests
through `/surface:capture` and bug reports through `/surface:problem`.

Generated files (`surface.json`, `SURFACE.md`, `docs/features/`) are never edited manually.
Run `surface gen` to regenerate them from test metadata.

Commit messages include `Affects: REQ-XXX` and `Surface-Protocol:` trailers when requirements
are touched. Valid trailer values: `capture`, `implement`, `ship`, `quickfix`, `problem`, `learn`, `reconcile`.

See `/surface:check` for validation.
