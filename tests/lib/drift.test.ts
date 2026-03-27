import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDriftReport, detectGhosts, scanUntrackedTests } from "../../src/lib/drift.js";
import "../../src/lib/adapters/index.js";
import { getAdapter } from "../../src/lib/adapters/adapter.js";
import type { SurfaceMap } from "../../src/lib/types.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/vitest-project");

function makeSurfaceMap(overrides: Partial<SurfaceMap> = {}): SurfaceMap {
	return {
		generated: new Date().toISOString(),
		version: "2.0",
		stats: {
			total: 0,
			by_type: {
				unit: 0,
				regression: 0,
				functional: 0,
				e2e: 0,
				contract: 0,
				performance: 0,
				security: 0,
				smoke: 0,
			},
			by_area: {},
			by_tag: {},
			coverage: { with_metadata: 0, without_metadata: 0 },
		},
		requirements: [],
		regressions: [],
		flows: [],
		contracts: [],
		smoke: [],
		placeholders: [],
		gaps: [],
		...overrides,
	};
}

describe("scanUntrackedTests", () => {
	it("finds tests with no YAML frontmatter", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const untracked = await scanUntrackedTests(FIXTURES_DIR, adapter);
		const untrackedFiles = untracked.map((t) => t.file);

		// untracked.test.ts has no YAML metadata
		expect(untrackedFiles.some((f) => f.includes("untracked"))).toBe(true);
	});

	it("does NOT flag tests that have YAML frontmatter", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const untracked = await scanUntrackedTests(FIXTURES_DIR, adapter);

		// auth.test.ts, cart.test.ts, catalog.test.ts all have YAML metadata
		const trackedFiles = untracked.filter((t) => t.file.includes("auth.test.ts"));
		expect(trackedFiles.length).toBe(0);
	});

	it("returns UntrackedTest with file, line, and implementation fields", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		const untracked = await scanUntrackedTests(FIXTURES_DIR, adapter);
		const inUntracked = untracked.find((t) => t.file.includes("untracked"));

		expect(inUntracked).toBeDefined();
		expect(inUntracked?.file).toContain("untracked");
		expect(inUntracked?.line).toBeGreaterThan(0);
		expect(inUntracked?.implementation).toBeDefined();
		expect(inUntracked?.implementation.state).toMatch(/stub|complete|skipped|not-implemented/);
	});
});

describe("detectGhosts", () => {
	it("returns empty array when all requirement files exist", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");

		// Use existing fixture files as locations
		const surfaceMap = makeSurfaceMap({
			requirements: [
				{
					id: "REQ-001",
					type: "unit",
					area: "auth",
					summary: "Test",
					tags: [],
					changed: [],
					authors: [],
					created: "2026-01-01",
					last_modified: "2026-01-01",
					status: "active",
					override: null,
					flaky: false,
					location: { file: "tests/auth.test.ts", line: 1 },
				},
			],
		});

		const ghosts = await detectGhosts(FIXTURES_DIR, surfaceMap);
		expect(ghosts).toHaveLength(0);
	});

	it("detects ghost entries for deleted files", async () => {
		const surfaceMap = makeSurfaceMap({
			requirements: [
				{
					id: "REQ-999",
					type: "unit",
					area: "auth",
					summary: "Ghost test",
					tags: [],
					changed: [],
					authors: [],
					created: "2026-01-01",
					last_modified: "2026-01-01",
					status: "active",
					override: null,
					flaky: false,
					location: { file: "tests/this-file-does-not-exist.test.ts", line: 1 },
				},
			],
		});

		const ghosts = await detectGhosts(FIXTURES_DIR, surfaceMap);
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]?.id).toBe("REQ-999");
		expect(ghosts[0]?.reason).toMatch(/file-deleted|file-renamed/);
	});
});

describe("buildDriftReport", () => {
	it("returns a DriftReport with summary", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");
		const surfaceMap = makeSurfaceMap();

		const report = await buildDriftReport(FIXTURES_DIR, surfaceMap, adapter);

		expect(report.scanned_at).toBeTruthy();
		expect(Array.isArray(report.untracked)).toBe(true);
		expect(Array.isArray(report.ghosts)).toBe(true);
		expect(Array.isArray(report.status_drift)).toBe(true);
		expect(report.summary).toBeDefined();
		expect(typeof report.summary.clean).toBe("boolean");
	});

	it("summary.clean is false when there are untracked tests", async () => {
		const adapter = getAdapter("typescript-vitest");
		if (!adapter) throw new Error("adapter not found");
		const surfaceMap = makeSurfaceMap();

		const report = await buildDriftReport(FIXTURES_DIR, surfaceMap, adapter);

		// untracked.test.ts has no metadata, so clean should be false
		expect(report.summary.clean).toBe(false);
		expect(report.summary.total_untracked).toBeGreaterThan(0);
	});
});
