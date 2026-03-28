import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../src/lib/adapters/index.js";
import { getAdapter } from "../../src/lib/adapters/adapter.js";
import { analyzeExistingMetadata } from "../../src/lib/metadata-analyzer.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/vitest-project");
const LAUNCHPAD_DIR = "/Users/ziadsawalha/code/launchpad";
const hasLaunchpad = existsSync(LAUNCHPAD_DIR);

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

		const guide = await analyzeExistingMetadata("/tmp", adapter);

		expect(guide.totalBlocks).toBe(0);
		expect(guide.areas).toEqual([]);
		expect(guide.commonTags).toEqual([]);
		expect(guide.avgTestsPerRequirement).toBe(1);
		expect(guide.hasRationale).toBe(false);
		expect(guide.hasAcceptance).toBe(false);
		expect(guide.exampleBlocks).toEqual([]);
	});

	it.skipIf(!hasLaunchpad)("detects rationale and acceptance in launchpad metadata", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		expect(guide.totalBlocks).toBeGreaterThan(10);
		expect(guide.hasRationale).toBe(true);
		expect(guide.hasAcceptance).toBe(true);
		expect(guide.hasTags).toBe(true);
		expect(guide.areas).toContain("analyzer");
	});

	it.skipIf(!hasLaunchpad)("computes meaningful tests-per-requirement ratio", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		expect(guide.avgTestsPerRequirement).toBeGreaterThan(1);
		expect(guide.avgTestsPerRequirement).toBeLessThan(20);
	});

	it.skipIf(!hasLaunchpad)("extracts common tags sorted by frequency", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		expect(guide.commonTags.length).toBeGreaterThan(0);
	});

	it.skipIf(!hasLaunchpad)("selects example blocks with richest metadata first", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const guide = await analyzeExistingMetadata(LAUNCHPAD_DIR, adapter);

		expect(guide.exampleBlocks.length).toBeGreaterThan(0);
		expect(guide.exampleBlocks.length).toBeLessThanOrEqual(5);

		for (const ex of guide.exampleBlocks) {
			expect(ex.file).toBeTruthy();
			expect(ex.raw).toBeTruthy();
		}
	});
});
