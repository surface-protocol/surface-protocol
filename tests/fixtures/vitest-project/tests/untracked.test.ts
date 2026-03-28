/**
 * Fixture: test file with NO YAML frontmatter.
 * Used by drift/backfill tests to simulate untracked tests.
 */

import { describe, it } from "vitest";

describe("untracked feature", () => {
	it("does something useful", () => {
		// no assertions — this is a stub-like test
	});

	it.todo("handles edge case");
});

describe("another untracked block", () => {
	it("validates input", () => {
		// some assertions would go here
		const x = 1 + 1;
	});
});
