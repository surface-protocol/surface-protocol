/**
 * Enrichment Helpers
 *
 * Utilities for intelligent backfill: grouping untracked tests by describe block
 * and tracing imports to find implementation code.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { UntrackedTest } from "./types.js";

// =============================================================================
// Test Grouping
// =============================================================================

/**
 * A group of untracked tests sharing the same describe block in the same file.
 * Used by the /surface:backfill skill to generate one requirement per group
 * instead of one per it() call.
 */
export interface TestGroup {
	file: string;
	describeLabel: string;
	/** Line of the describe() block (for YAML injection placement). 0 if top-level. */
	describeLine: number;
	tests: UntrackedTest[];
	/** Module paths imported by the test file (for code analysis). */
	importedModules: string[];
}

/**
 * Group untracked tests by (file, describe) so the skill can generate
 * one enriched YAML block per group rather than one per it() call.
 *
 * Tests without a describe label are grouped under "(top-level)".
 */
export function groupUntrackedByDescribe(tests: UntrackedTest[]): TestGroup[] {
	const key = (t: UntrackedTest): string => `${t.file}::${t.describe ?? "(top-level)"}`;

	const map = new Map<string, UntrackedTest[]>();
	for (const t of tests) {
		const k = key(t);
		const arr = map.get(k) ?? [];
		arr.push(t);
		map.set(k, arr);
	}

	const groups: TestGroup[] = [];
	for (const [, groupTests] of map) {
		const first = groupTests[0];
		if (!first) continue;

		groups.push({
			file: first.file,
			describeLabel: first.describe ?? "(top-level)",
			describeLine: findDescribeLine(first),
			tests: groupTests.sort((a, b) => a.line - b.line),
			importedModules: [], // populated separately by findImportedModules
		});
	}

	// Sort groups by file then line for deterministic output
	return groups.sort((a, b) => a.file.localeCompare(b.file) || a.describeLine - b.describeLine);
}

/**
 * Estimate the line of the describe() block from the first test in the group.
 * The describe is always before the first it() call.
 */
function findDescribeLine(test: UntrackedTest): number {
	// The describe is somewhere above the first it() call.
	// Use (first test line - 1) as a reasonable estimate.
	// The skill will refine this by reading the file.
	return Math.max(1, test.line - 1);
}

// =============================================================================
// Import Tracing
// =============================================================================

/**
 * Find modules imported by a test file. Returns relative paths resolved
 * against the project root.
 *
 * Only traces local imports (starting with . or /) — not npm packages.
 */
export function findImportedModules(dir: string, testFile: string): string[] {
	const absFile = testFile.startsWith("/") ? testFile : join(dir, testFile);

	let content: string;
	try {
		content = readFileSync(absFile, "utf-8");
	} catch {
		return [];
	}

	const imports: string[] = [];
	const testDir = dirname(absFile);

	// Match: import ... from "path" or import ... from 'path'
	const fromRegex = /from\s+['"]([^'"]+)['"]/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
	while ((match = fromRegex.exec(content)) !== null) {
		const specifier = match[1];
		if (!specifier) continue;

		// Skip non-local imports (npm packages, node: builtins)
		if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue;

		// Resolve to a path relative to the project root
		const resolved = resolve(testDir, specifier);
		const relPath = resolved.startsWith(dir) ? resolved.slice(dir.length + 1) : resolved;

		imports.push(relPath);
	}

	return imports;
}

/**
 * Populate importedModules for each TestGroup by tracing imports
 * from the test file.
 */
export function populateImports(dir: string, groups: TestGroup[]): void {
	// Cache per file since multiple groups can share the same file
	const cache = new Map<string, string[]>();

	for (const group of groups) {
		let modules = cache.get(group.file);
		if (!modules) {
			modules = findImportedModules(dir, group.file);
			cache.set(group.file, modules);
		}
		group.importedModules = modules;
	}
}
