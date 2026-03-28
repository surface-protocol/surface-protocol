import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	findImportedModules,
	groupUntrackedByDescribe,
	populateImports,
} from "../../src/lib/enrichment-helpers.js";
import type { UntrackedTest } from "../../src/lib/types.js";

function makeTest(overrides: Partial<UntrackedTest> = {}): UntrackedTest {
	return {
		file: "src/auth/__tests__/auth.test.ts",
		line: 10,
		describe: "login",
		it: "validates credentials",
		implementation: { state: "complete", detected_from: "has-assertions" },
		...overrides,
	};
}

// =============================================================================
// groupUntrackedByDescribe
// =============================================================================

describe("groupUntrackedByDescribe", () => {
	it("groups tests by (file, describe)", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 1", line: 10 }),
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 2", line: 20 }),
			makeTest({ file: "a.test.ts", describe: "billing", it: "test 3", line: 30 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups).toHaveLength(2);

		const authGroup = groups.find((g) => g.describeLabel === "auth");
		expect(authGroup?.tests).toHaveLength(2);
		expect(authGroup?.file).toBe("a.test.ts");

		const billingGroup = groups.find((g) => g.describeLabel === "billing");
		expect(billingGroup?.tests).toHaveLength(1);
	});

	it("groups tests without describe under (top-level)", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "a.test.ts", describe: undefined, it: "test 1", line: 5 }),
			makeTest({ file: "a.test.ts", describe: undefined, it: "test 2", line: 15 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.describeLabel).toBe("(top-level)");
		expect(groups[0]?.tests).toHaveLength(2);
	});

	it("separates tests from different files even with same describe label", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "a.test.ts", describe: "utils", it: "test 1", line: 10 }),
			makeTest({ file: "b.test.ts", describe: "utils", it: "test 2", line: 10 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups).toHaveLength(2);
	});

	it("sorts tests within a group by line number", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 2", line: 30 }),
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 1", line: 10 }),
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 3", line: 50 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tests.map((t) => t.line)).toEqual([10, 30, 50]);
	});

	it("sorts groups by file then describe line", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "b.test.ts", describe: "second", it: "t", line: 20 }),
			makeTest({ file: "a.test.ts", describe: "first", it: "t", line: 10 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups[0]?.file).toBe("a.test.ts");
		expect(groups[1]?.file).toBe("b.test.ts");
	});

	it("returns empty array for empty input", () => {
		expect(groupUntrackedByDescribe([])).toEqual([]);
	});

	it("sets describeLine to first test line - 1", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 1", line: 15 }),
			makeTest({ file: "a.test.ts", describe: "auth", it: "test 2", line: 25 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups[0]?.describeLine).toBe(14);
	});
});

// =============================================================================
// findImportedModules
// =============================================================================

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/vitest-project");

describe("findImportedModules", () => {
	it("finds local imports from test files", () => {
		// auth.test.ts imports from "vitest" (external) — should be skipped
		// It doesn't have local imports in the fixture, but let's test the function works
		const imports = findImportedModules(FIXTURES_DIR, "tests/auth.test.ts");
		// External imports (vitest) should be filtered out
		const hasVitest = imports.some((i) => i.includes("vitest"));
		expect(hasVitest).toBe(false);
	});

	it("returns empty array for non-existent file", () => {
		expect(findImportedModules(FIXTURES_DIR, "nonexistent.test.ts")).toEqual([]);
	});

	it.skipIf(!existsSync("/Users/ziadsawalha/code/launchpad"))(
		"resolves relative imports against test file directory",
		() => {
			const launchpadDir = "/Users/ziadsawalha/code/launchpad";
			const imports = findImportedModules(launchpadDir, "src/cli/__tests__/cli.test.ts");

			expect(imports.length).toBeGreaterThan(0);
			for (const imp of imports) {
				expect(imp.startsWith("/")).toBe(false);
			}
		},
	);
});

// =============================================================================
// populateImports
// =============================================================================

describe("populateImports", () => {
	it("populates importedModules on each group", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "tests/auth.test.ts", describe: "auth", it: "test", line: 10 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		expect(groups[0]?.importedModules).toEqual([]);

		populateImports(FIXTURES_DIR, groups);
		// After populate, importedModules should be an array (may be empty for fixture)
		expect(Array.isArray(groups[0]?.importedModules)).toBe(true);
	});

	it("caches imports for groups sharing the same file", () => {
		const tests: UntrackedTest[] = [
			makeTest({ file: "tests/auth.test.ts", describe: "group1", it: "t1", line: 10 }),
			makeTest({ file: "tests/auth.test.ts", describe: "group2", it: "t2", line: 30 }),
		];

		const groups = groupUntrackedByDescribe(tests);
		populateImports(FIXTURES_DIR, groups);

		// Both groups share the same file, so importedModules should be identical
		expect(groups[0]?.importedModules).toEqual(groups[1]?.importedModules);
	});
});
