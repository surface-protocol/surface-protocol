/**
 * Coverage Linker
 *
 * Cross-references discovered entry points against surface.json and test files
 * to classify each entry point as covered, untracked, or untested.
 *
 * Two strategies:
 * 1. Explicit: Test metadata contains `covers: ["POST /api/auth/login"]`
 * 2. Heuristic: Search test files for the route path string + file proximity
 */

import { readFile } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";
import type { CoverageState, RawEntryPoint, Requirement, SurfaceEntryPoint, SurfaceMap } from "../types.js";
import { findTestFiles } from "../parser.js";

// =============================================================================
// Entry point key normalization
// =============================================================================

function entryPointKey(ep: RawEntryPoint): string {
	return ep.method ? `${ep.method.toUpperCase()} ${ep.path}` : ep.path;
}

// =============================================================================
// Explicit coverage (via `covers` field in test metadata)
// =============================================================================

function buildExplicitCoverageMap(
	surfaceMap: SurfaceMap,
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	const allReqs: Requirement[] = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];

	for (const req of allReqs) {
		const covers = (req as unknown as { covers?: string[] }).covers;
		if (!covers) continue;
		for (const key of covers) {
			const existing = map.get(key) ?? [];
			existing.push(req.id);
			map.set(key, existing);
		}
	}

	return map;
}

// =============================================================================
// Heuristic coverage (string search + file proximity)
// =============================================================================

/**
 * Search test file contents for any mention of the entry point path.
 */
async function searchTestFilesForPath(
	testFiles: string[],
	path: string,
	dir: string,
): Promise<string[]> {
	const matchingFiles: string[] = [];

	for (const absFile of testFiles) {
		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}
		if (content.includes(path)) {
			matchingFiles.push(relative(dir, absFile));
		}
	}

	return matchingFiles;
}

/**
 * Check file proximity: if test file path mirrors the source file path.
 * e.g., src/routes/auth.ts ↔ tests/routes/auth.test.ts
 */
function checkFileProximity(entryPointFile: string, testFiles: string[], dir: string): string[] {
	const epBase = basename(entryPointFile, ".ts")
		.replace(/\.(js|jsx|tsx)$/, "")
		.replace(/\.(route|routes|controller|handler|api)$/, "");

	return testFiles
		.map((f) => relative(dir, f))
		.filter((tf) => {
			const tfBase = basename(tf)
				.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "")
				.replace(/_spec\.(rb)$/, "");
			return tfBase === epBase || tfBase === `${epBase}.test` || tfBase.startsWith(epBase);
		});
}

// =============================================================================
// Find matching requirement IDs from surface.json via test file
// =============================================================================

function requirementIdsForTestFiles(
	testFileRelPaths: string[],
	surfaceMap: SurfaceMap,
): string[] {
	const ids: string[] = [];
	const allReqs: Requirement[] = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];

	for (const req of allReqs) {
		if (testFileRelPaths.some((tf) => req.location.file === tf || req.location.file.includes(tf))) {
			ids.push(req.id);
		}
	}

	return ids;
}

function hasTestFiles(testFileRelPaths: string[], surfaceMap: SurfaceMap): boolean {
	const allReqs: Requirement[] = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];
	return allReqs.some((req) =>
		testFileRelPaths.some((tf) => req.location.file === tf || req.location.file.includes(tf)),
	);
}

// =============================================================================
// Main linker
// =============================================================================

export async function linkCoverage(
	dir: string,
	entryPoints: RawEntryPoint[],
	surfaceMap: SurfaceMap,
	testFilePatterns?: string[],
): Promise<SurfaceEntryPoint[]> {
	const allTestFiles = findTestFiles(dir, testFilePatterns);
	const explicitMap = buildExplicitCoverageMap(surfaceMap);

	const result: SurfaceEntryPoint[] = [];

	for (const ep of entryPoints) {
		const key = entryPointKey(ep);

		// 1. Explicit coverage via `covers` field
		const explicitIds = explicitMap.get(key);
		if (explicitIds && explicitIds.length > 0) {
			result.push({ ...ep, coverage: "covered", requirement_ids: explicitIds });
			continue;
		}

		// 2. Heuristic: search test file contents for the path string
		const [pathMatches, proximityMatches] = await Promise.all([
			searchTestFilesForPath(allTestFiles, ep.path, dir),
			Promise.resolve(checkFileProximity(ep.file, allTestFiles, dir)),
		]);

		const allMatchingTests = [...new Set([...pathMatches, ...proximityMatches])];

		if (allMatchingTests.length > 0) {
			const reqIds = requirementIdsForTestFiles(allMatchingTests, surfaceMap);
			if (reqIds.length > 0) {
				// Tests exist AND they have surface metadata → covered
				result.push({ ...ep, coverage: "covered", requirement_ids: reqIds });
			} else {
				// Tests exist but no surface metadata → untracked
				result.push({ ...ep, coverage: "untracked", requirement_ids: [] });
			}
			continue;
		}

		// 3. No tests found → untested
		result.push({ ...ep, coverage: "untested", requirement_ids: [] });
	}

	return result;
}
