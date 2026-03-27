/**
 * Surface Backfill
 *
 * Auto-annotates untracked test files with inferred YAML frontmatter.
 * Used by `surface backfill` to establish a known-good surface baseline.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CommentFormat, StackAdapter } from "./adapters/adapter.js";
import type { SurfaceConfig } from "./config.js";
import { extractAllYamlBlocks } from "./parser.js";
import type { TestMetadata, TestType, UntrackedTest } from "./types.js";

// =============================================================================
// Inference Helpers
// =============================================================================

const GENERIC_SEGMENTS = new Set([
	"tests",
	"test",
	"__tests__",
	"spec",
	"specs",
	"src",
	"lib",
	"app",
	"apps",
	"packages",
	"unit",
	"integration",
	"e2e",
	"features",
]);

/**
 * Infer the area name from a file path.
 * Uses the first meaningful path segment (skipping generic dirs).
 */
export function inferArea(filePath: string, configAreas: Record<string, unknown> = {}): string {
	// Check configured area prefixes first
	const normalizedPath = filePath.replace(/\\/g, "/");
	for (const area of Object.keys(configAreas)) {
		if (normalizedPath.includes(`/${area}/`) || normalizedPath.startsWith(`${area}/`)) {
			return area;
		}
	}

	// Heuristic: find first meaningful segment
	const segments = normalizedPath.split("/").filter(Boolean);
	// Remove the filename itself
	const dirs = segments.slice(0, -1);

	for (const seg of dirs) {
		const _clean = seg.replace(/[-_.]/g, " ").split(" ")[0] ?? seg;
		if (!GENERIC_SEGMENTS.has(seg.toLowerCase()) && !seg.startsWith(".")) {
			return seg;
		}
	}

	// Fallback: use the file's directory name
	const fileDir = dirname(normalizedPath);
	const lastDir = fileDir.split("/").filter(Boolean).pop();
	if (lastDir && lastDir !== "." && !GENERIC_SEGMENTS.has(lastDir.toLowerCase())) return lastDir;

	return "general";
}

/**
 * Infer the test type from a file path and adapter.
 */
export function inferTestType(filePath: string, adapter: StackAdapter): TestType {
	const p = filePath.toLowerCase().replace(/\\/g, "/");

	if (p.includes("/e2e/") || p.includes(".e2e.") || p.includes("playwright")) return "e2e";
	if (p.includes("/smoke/") || p.includes(".smoke.")) return "smoke";
	if (p.includes("/contract/") || p.includes("/pact/") || p.includes(".contract."))
		return "contract";
	if (p.includes("/perf/") || p.includes("/performance/") || p.includes(".perf."))
		return "performance";
	if (p.includes("/security/") || p.includes("/sec/") || p.includes(".security."))
		return "security";
	if (p.includes("/regression/") || p.includes(".regr.") || p.includes(".regression."))
		return "regression";

	// Ruby files default to unit
	if (adapter.name === "ruby-rspec" || p.endsWith("_spec.rb")) return "unit";

	return "unit";
}

/**
 * Clean a raw test label into a human-readable summary.
 * Prepends describe context if provided.
 */
export function generateSummaryFromLabel(itLabel: string, describeLabel?: string): string {
	// Strip parenthetical IDs like "(REQ-001)" at the end
	let clean = itLabel.replace(/\s*\([A-Z]+-\d+\)\s*$/, "").trim();

	// Capitalize first letter
	if (clean.length > 0) {
		clean = clean.charAt(0).toUpperCase() + clean.slice(1);
	}

	if (describeLabel) {
		const prefix = describeLabel.trim();
		const candidate = `${prefix}: ${clean}`;
		return candidate.length <= 120 ? candidate : clean;
	}

	return clean || "Untracked test";
}

/**
 * Select the right ID prefix for a given test type.
 */
export function idPrefixForType(type: TestType, config: SurfaceConfig): string {
	switch (type) {
		case "e2e":
			return config.idPrefixes.flow;
		case "regression":
			return config.idPrefixes.regression;
		case "contract":
			return config.idPrefixes.contract;
		case "smoke":
			return config.idPrefixes.smoke;
		case "performance":
			return config.idPrefixes.performance;
		case "security":
			return config.idPrefixes.security;
		case "functional":
			return config.idPrefixes.functional;
		default:
			return config.idPrefixes.requirement;
	}
}

// =============================================================================
// YAML Helpers
// =============================================================================

/**
 * Quote a YAML value if it contains characters that would break parsing.
 * Colons, braces, brackets, and hash signs all need quoting.
 */
function yamlSafeValue(value: string): string {
	if (/[:{}[\]#&*?|>!%@`]/.test(value) || value.startsWith('"') || value.startsWith("'")) {
		return JSON.stringify(value);
	}
	return value;
}

// =============================================================================
// YAML Block Generation
// =============================================================================

/**
 * Build the YAML frontmatter string for a given comment format.
 */
export function buildYamlBlock(metadata: Partial<TestMetadata>, format: CommentFormat): string {
	const today = new Date().toISOString().slice(0, 10);

	// Build minimal YAML manually to control field order
	const lines: string[] = [];

	if (metadata.req) lines.push(`req: ${metadata.req}`);
	else if (metadata.flow) lines.push(`flow: ${metadata.flow}`);
	else if (metadata.smoke) lines.push(`smoke: ${metadata.smoke}`);
	else if (metadata.regr) lines.push(`regr: ${metadata.regr}`);
	else if (metadata.contract) lines.push(`contract: ${metadata.contract}`);
	else if (metadata.sec) lines.push(`sec: ${metadata.sec}`);
	else if (metadata.perf) lines.push(`perf: ${metadata.perf}`);

	lines.push(`type: ${metadata.type ?? "unit"}`);
	lines.push(`status: active`);
	if (metadata.area) lines.push(`area: ${metadata.area}`);
	lines.push(`summary: ${yamlSafeValue(metadata.summary ?? "Backfilled requirement")}`);

	lines.push("source:");
	lines.push("  type: implementation");
	lines.push("  ref: implementation-discovery");

	lines.push("changed:");
	lines.push(`  - date: ${today}`);
	lines.push("    commit: pending");
	lines.push("    note: Backfilled by surface backfill — review and update");

	const yamlContent = lines.join("\n");

	if (format.linePrefix) {
		// Hash-block: prefix every line
		const prefixed = yamlContent
			.split("\n")
			.map((l) => `${format.linePrefix}${l}`)
			.join("\n");
		return `${format.openLiteral}${prefixed}${format.closeLiteral}`;
	}

	return `${format.openLiteral}${yamlContent}${format.closeLiteral}`;
}

// =============================================================================
// File Injection
// =============================================================================

/**
 * Inject a YAML block immediately before a specific line in a file.
 * Reads current content, inserts, writes back.
 * Returns the updated content string.
 */
export async function injectYamlIntoFile(
	filePath: string,
	insertBeforeLine: number, // 1-indexed line of the it() call
	yamlBlock: string,
): Promise<string> {
	const original = await readFile(filePath, "utf-8");
	const updated = injectYamlIntoContent(original, insertBeforeLine, yamlBlock);
	await writeFile(filePath, updated, "utf-8");
	return updated;
}

/**
 * Pure function: insert yamlBlock before insertBeforeLine in content string.
 * Exported for testing.
 */
export function injectYamlIntoContent(
	content: string,
	insertBeforeLine: number, // 1-indexed
	yamlBlock: string,
): string {
	const lines = content.split("\n");
	const idx = insertBeforeLine - 1; // 0-indexed

	// Insert: blank line + yamlBlock + blank line at idx
	const insertion = ["", yamlBlock, ""];
	lines.splice(idx, 0, ...insertion);

	return lines.join("\n");
}

// =============================================================================
// Backfill Candidate
// =============================================================================

export interface BackfillCandidate {
	file: string; // relative path
	untracked: UntrackedTest[];
}

export interface BackfillResult {
	file: string;
	injected: Array<{ id: string; line: number; summary: string }>;
	errors: string[];
}

/**
 * Backfill a single file: inject YAML for all untracked tests.
 * Processes tests in reverse line order to avoid shifting line numbers.
 *
 * @param dir - project root
 * @param candidate - file and its untracked tests
 * @param adapter - stack adapter (for comment format)
 * @param config - surface config (for ID prefixes, areas)
 * @param allocatedIds - pre-allocated IDs, one per untracked test (in original order)
 */
export async function backfillFile(
	dir: string,
	candidate: BackfillCandidate,
	adapter: StackAdapter,
	config: SurfaceConfig,
	allocatedIds: string[],
): Promise<BackfillResult> {
	const absFile = candidate.file.startsWith("/") ? candidate.file : `${dir}/${candidate.file}`;
	const result: BackfillResult = { file: candidate.file, injected: [], errors: [] };

	// Read original content for round-trip verification
	let content: string;
	try {
		content = await readFile(absFile, "utf-8");
	} catch (e) {
		result.errors.push(`Cannot read file: ${e instanceof Error ? e.message : String(e)}`);
		return result;
	}

	const originalBlockCount = extractAllYamlBlocks(content).length;

	// Sort tests in reverse line order so injections don't shift subsequent line numbers
	const sortedTests = [...candidate.untracked].sort((a, b) => b.line - a.line);

	// Map from sorted index back to original index for ID assignment
	const originalIndices = sortedTests.map((t) => candidate.untracked.indexOf(t));

	let workingContent = content;

	for (let i = 0; i < sortedTests.length; i++) {
		const test = sortedTests[i];
		if (!test) continue;
		const originalIdx = originalIndices[i] ?? 0;
		const id = allocatedIds[originalIdx];
		if (!id) {
			result.errors.push(`No ID allocated for test at line ${test.line}`);
			continue;
		}

		const type = inferTestType(candidate.file, adapter);
		const area = inferArea(candidate.file, config.areas);
		const summary = generateSummaryFromLabel(test.it ?? "Untracked test", test.describe);

		// Build metadata with the right ID field
		const metadata: Partial<TestMetadata> = { type, area, summary };
		const prefix = idPrefixForType(type, config);
		if (prefix === config.idPrefixes.flow) metadata.flow = id;
		else if (prefix === config.idPrefixes.regression) metadata.regr = id;
		else if (prefix === config.idPrefixes.contract) metadata.contract = id;
		else if (prefix === config.idPrefixes.smoke) metadata.smoke = id;
		else if (prefix === config.idPrefixes.security) metadata.sec = id;
		else if (prefix === config.idPrefixes.performance) metadata.perf = id;
		else metadata.req = id;

		const yamlBlock = buildYamlBlock(metadata, adapter.commentFormat);

		// When processing in reverse order, we inject into workingContent directly
		// But since we're tracking line positions in the *original* content,
		// and processing bottom-to-top, early injections don't affect later line numbers.
		// We inject into workingContent (already modified by previous injections from below).
		workingContent = injectYamlIntoContent(workingContent, test.line, yamlBlock);

		result.injected.push({ id, line: test.line, summary });
	}

	// Write the fully modified content
	try {
		await writeFile(absFile, workingContent, "utf-8");
	} catch (e) {
		result.errors.push(`Cannot write file: ${e instanceof Error ? e.message : String(e)}`);
		return result;
	}

	// Round-trip verification
	const newContent = await readFile(absFile, "utf-8");
	const newBlockCount = extractAllYamlBlocks(newContent).length;
	const expectedCount = originalBlockCount + sortedTests.length - result.errors.length;

	if (newBlockCount < expectedCount) {
		// Restore original and report error
		await writeFile(absFile, content, "utf-8");
		result.errors.push(
			`Round-trip verification failed (expected ${expectedCount} blocks, got ${newBlockCount}). File restored.`,
		);
		result.injected = [];
	}

	return result;
}
