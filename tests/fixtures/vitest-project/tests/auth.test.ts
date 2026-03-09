import { describe, it } from "vitest";

/*---
req: REQ-001
type: functional
status: pending
area: auth
summary: User login requires valid credentials
rationale: |
  Core authentication flow. Users must provide valid email and password
  to receive a session token.
acceptance:
  - Valid email/password returns session token
  - Invalid credentials return 401
  - Account lockout after 5 failed attempts
tags: [auth, user-facing, security]
changed:
  - date: 2026-01-15
    commit: abc1234
    note: Initial stub created
---*/
describe("auth", () => {
	it.todo("requires valid credentials (REQ-001)");
});
