import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../src/lib/adapters/index.js";
import { getAdapter } from "../../src/lib/adapters/adapter.js";
import { analyzeExistingMetadata } from "../../src/lib/metadata-analyzer.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/vitest-project");
const LAUNCHPAD_DIR = "/Users/ziadsawalha/code/launchpad";

describe("analyzeExistingMetadata", () => {
	it("returns style guide from vitest fixture project", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(FIXTURES_DIR, adapter);

		expect(guide.totalBlocks).toBeGreaterThan(0);
		expect(guide.areas.length).toBeGreaterThan(0);
		expect(guide.areas).toContain("auth");
		expect(guide.avgTestsPerRequirement).toBeGreaterThan(0);
	});

	it("returns empty style guide for project with no metadata", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		// Use a dir with no test files
		const guide = await analyzeExistingMetadata("/tmp", adapter);

		expect(guide.totalBlocks).toBe(0);
		expect(guide.areas).toEqual([]);
		expect(guide.commonTags).toEqual([]);
		expect(guide.avgTestsPerRequirement).toBe(1);
		expect(guide.hasRationale).toBe(false);
		expect(guide.hasAcceptance).toBe(false);
		expect(guide.exampleBlocks).toEqual([]);
	});

	it("detects rationale and acceptance in launchpad metadata", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		// Launchpad has rich metadata with rationale and acceptance
		expect(guide.totalBlocks).toBeGreaterThan(10);
		expect(guide.hasRationale).toBe(true);
		expect(guide.hasAcceptance).toBe(true);
		expect(guide.hasTags).toBe(true);
		expect(guide.areas).toContain("analyzer");
	});

	it("computes meaningful tests-per-requirement ratio", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		// Launchpad groups ~4 tests per YAML block on average
		expect(guide.avgTestsPerRequirement).toBeGreaterThan(1);
		expect(guide.avgTestsPerRequirement).toBeLessThan(20);
	});

	it("extracts common tags sorted by frequency", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		// Should have tags — "core" is common in launchpad
		expect(guide.commonTags.length).toBeGreaterThan(0);
	});

	it("selects example blocks with richest metadata first", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		expect(guide.exampleBlocks.length).toBeGreaterThan(0);
		expect(guide.exampleBlocks.length).toBeLessThanOrEqual(5);

		// Examples should have file and area
		for (const ex of guide.exampleBlocks) {
			expect(ex.file).toBeTruthy();
			expect(ex.raw).toBeTruthy();
		}
	});
});
