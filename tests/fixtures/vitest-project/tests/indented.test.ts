import { describe, it, expect } from "vitest";

describe("indented YAML blocks", () => {
	/*---
	req: REQ-IND-001
	type: unit
	status: active
	area: core
	summary: First indented block covers multiple tests
	tags: [core]
	changed:
	  - date: 2026-03-27
	    note: Test for indented YAML support
	---*/
	it("first test under indented block", () => {
		expect(1 + 1).toBe(2);
	});

	it("second test under same indented block", () => {
		expect(2 + 2).toBe(4);
	});

	it("third test under same indented block", () => {
		expect(3 + 3).toBe(6);
	});

	/*---
	req: REQ-IND-002
	type: unit
	status: active
	area: core
	summary: Second indented block
	tags: [core]
	changed:
	  - date: 2026-03-27
	    note: Test for indented YAML support
	---*/
	it("test under second indented block", () => {
		expect(4 + 4).toBe(8);
	});
});
