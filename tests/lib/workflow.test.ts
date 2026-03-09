/**
 * Workflow Integration Test
 *
 * Tests the full init → capture → gen → check → reconcile pipeline.
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatJson } from "../../src/lib/formatters.js";
import { captureRequirement, persistLearning } from "../../src/lib/ingest.js";
import { reconcileSources } from "../../src/lib/reconcile.js";
import type { SurfaceMap } from "../../src/lib/types.js";

// Import adapters to register them
import "../../src/lib/adapters/typescript-vitest.js";

const EMPTY_SURFACE_MAP: SurfaceMap = {
	generated: new Date(0).toISOString(),
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
	placeholders: [],
	gaps: [],
};

function git(dir: string, ...args: string[]): void {
	execFileSync("git", args, { cwd: dir, stdio: "ignore" });
}

async function initTestRepo(adapter = "typescript-vitest"): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "surface-workflow-"));

	// Initialize git so findTestFiles works
	git(dir, "init");
	git(dir, "config", "user.email", "test@test.com");
	git(dir, "config", "user.name", "Test");

	// Create minimal Surface Protocol footprint
	await mkdir(join(dir, ".surface/state"), { recursive: true });
	await mkdir(join(dir, ".surface/sources"), { recursive: true });
	await mkdir(join(dir, ".surface/learnings"), { recursive: true });
	await writeFile(join(dir, "surfaceprotocol.settings.json"), formatJson({ adapter }), "utf-8");
	await writeFile(join(dir, "surface.json"), formatJson(EMPTY_SURFACE_MAP), "utf-8");
	await writeFile(join(dir, ".surface/state/id-counter"), "0\n", "utf-8");

	// Initial commit so git ls-files works
	git(dir, "add", "-A");
	git(dir, "commit", "-m", "init");

	return dir;
}

describe("target repo workflow", () => {
	it("captures a requirement and creates source + stub", async () => {
		const dir = await initTestRepo();

		const result = await captureRequirement({
			dir,
			sourceKind: "prd",
			sourceRef: "PRD-Checkout",
			summary: "Checkout form submits valid cart",
			area: "checkout",
			acceptance: ["Submit button persists cart", "Validation errors are visible"],
		});

		expect(result.id).toBe("REQ-001");

		// Source doc was created
		const sourceContent = await readFile(result.sourcePath, "utf-8");
		expect(sourceContent).toContain("REQ-001");
		expect(sourceContent).toContain("Checkout form submits valid cart");
		expect(sourceContent).toContain("Submit button persists cart");

		// Test stub was created
		const stubContent = await readFile(result.stubPath, "utf-8");
		expect(stubContent).toContain("REQ-001");
		expect(stubContent).toContain("it.todo");
		expect(stubContent).toContain("checkout");
	});

	it("increments IDs across multiple captures", async () => {
		const dir = await initTestRepo();

		const first = await captureRequirement({
			dir,
			sourceKind: "github",
			sourceRef: "#42",
			summary: "First requirement",
			acceptance: ["It works"],
		});

		const second = await captureRequirement({
			dir,
			sourceKind: "github",
			sourceRef: "#43",
			summary: "Second requirement",
			acceptance: ["It also works"],
		});

		expect(first.id).toBe("REQ-001");
		expect(second.id).toBe("REQ-002");
	});

	it("persists a learning", async () => {
		const dir = await initTestRepo();

		const path = await persistLearning({
			dir,
			title: "Database connections pool exhaustion",
			summary: "Connections were leaking due to unclosed transactions.",
			insights: [
				"Always use connection.release() in finally blocks",
				"Set pool max to match worker count",
			],
		});

		const content = await readFile(path, "utf-8");
		expect(content).toContain("Database connections pool exhaustion");
		expect(content).toContain("Always use connection.release()");
		expect(content).toContain("Set pool max to match worker count");
	});

	it("reconciles sources — no issues when sources match", async () => {
		const dir = await initTestRepo();

		// Capture creates both source and stub
		const capture = await captureRequirement({
			dir,
			sourceKind: "prd",
			sourceRef: "PRD-Auth",
			summary: "User login flow",
			area: "auth",
			acceptance: ["Valid credentials return token"],
		});

		// Build a minimal surface map that references the captured source
		const surfaceMap: SurfaceMap = {
			...EMPTY_SURFACE_MAP,
			stats: { ...EMPTY_SURFACE_MAP.stats, total: 1 },
			requirements: [
				{
					id: capture.id,
					type: "unit",
					area: "auth",
					summary: "User login flow",
					tags: [],
					location: { file: capture.stubPath, line: 1 },
					changed: [],
					authors: [],
					created: "",
					last_modified: "",
					status: "pending",
					override: null,
					flaky: false,
					source: {
						type: "prd",
						ref: `prd/req-001-user-login-flow.md`,
					},
				},
			],
		};

		const result = await reconcileSources(dir, surfaceMap);
		expect(result.missing_sources).toHaveLength(0);
		expect(result.stale_sources).toHaveLength(0);
	});

	it("reconciles sources — detects stale sources", async () => {
		const dir = await initTestRepo();

		// Create a source file that nothing references
		await mkdir(join(dir, ".surface/sources/prd"), { recursive: true });
		await writeFile(join(dir, ".surface/sources/prd/orphan-source.md"), "# Orphan\n", "utf-8");

		// Empty surface map — no requirements reference the source
		const result = await reconcileSources(dir, EMPTY_SURFACE_MAP);
		expect(result.stale_sources).toContain("prd/orphan-source.md");
	});
});
