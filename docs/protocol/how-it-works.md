# How Surface Works

Surface Protocol keeps requirements, tests, and implementation in the same
conversation.

1. A source enters the surface.
   A PRD, GitHub issue, inline requirement, problem definition, or thread gets
   normalized into `.surface/sources/`.
2. The source becomes test metadata.
   A stack adapter writes a requirement stub into the target repo's native test
   shape.
3. `surface.json` and `SURFACE.md` are generated.
   Those two files are the queryable truth and the human-readable truth.
4. Claude works against the surface.
   `capture`, `quickfix`, `problem`, `implement`, `ship`, and `learn` all use
   the same underlying map.
5. Git keeps the receipts.
   `Affects:` and `Surface-Protocol:` trailers preserve intent in history.

The protocol stays deliberately low-touch:

- Target repos get `surfaceprotocol.settings.json`, `.surface/`, `surface.json`,
  `SURFACE.md`, and a tiny `CLAUDE.md` routing stub.
- Hooks are optional.
- Adapter logic handles stack differences.

The protocol does not care whether the target repo is a product called
anything in particular.
