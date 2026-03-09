# TypeScript Adapter

Adapter id: `typescript-vitest`

## Assumptions

- Unit and integration tests live in `.test.ts`, `.spec.ts`, `.test.tsx`, or `.spec.tsx`.
- Metadata uses the JS block YAML carrier:

```ts
/*---
req: REQ-001
type: unit
summary: Checkout form submits
---*/
```

- Stub tests render with `it.todo(...)`.
- UI selectors use `data-test-id` and `data-test-instance`.

## Notes

- Bun can be the local package manager and runner, but the protocol does not
  require every target repo to use Bun.
- Playwright is an optional browser verification layer, not a mandatory
  dependency for every target repo.
