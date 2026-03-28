/**
 * Surface Drift Detection
 *
 * Compares the live codebase against surface.json to identify:
 * - Untracked tests: it() blocks with no YAML frontmatter
 * - Ghost entries: requirements whose test files were deleted/renamed
 * - Status drift: tests whose implementation state changed since last gen
 */

import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { StackAdapter } from "./adapters/adapter.js";
import { detectImplementationStatus } from "./detect-implementation-status.js";
import { extractAllYamlBlocks, findTestFiles } from "./parser.js";
import type {
	CoverageGap,
	DriftReport,
	GhostEntry,
	ImplementationStatus,
	StatusDrift,
	SurfaceMap,
	UntrackedTest,
} from "./types.js";

// =============================================================================
// Untracked Test Detection
// =============================================================================

/**
 * Scan all test files to find it() / test() blocks that have no YAML frontmatter.
 *
 * Algorithm per file:
 * 1. Extract all YAML block line ranges
 * 2. Scan for it() / test() calls using the adapter's itPattern
 * 3. A test is "untracked" if its line is not covered by any YAML block
 */
export async function scanUntrackedTests(
	dir: string,
	adapter: StackAdapter,
	testFilePatterns?: string[],
): Promise<UntrackedTest[]> {
	const testFiles = findTestFiles(dir, testFilePatterns ?? adapter.filePatterns);
	const untracked: UntrackedTest[] = [];

	for (const absFile of testFiles) {
		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}

		const relFile = relative(dir, absFile);
		const blocks = extractAllYamlBlocks(content);
		const lines = content.split("\n");

		// Build covered line ranges: each YAML block covers from its start to just before the next block starts.
		// The last block covers to end of file. This handles the common pattern of one YAML block
		// covering multiple it() calls within a describe.
		const coveredRanges: Array<[number, number]> = blocks.map((b, i) => {
			const nextBlock = blocks[i + 1];
			const rangeEnd = nextBlock ? nextBlock.startLine - 1 : lines.length;
			return [b.startLine, rangeEnd];
		});

		// Find all it() / test() calls using the adapter's itPattern
		const itRegex = new RegExp(adapter.itPattern.source, "g");
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
		while ((match = itRegex.exec(content)) !== null) {
			const beforeMatch = content.slice(0, match.index);
			const testLine = beforeMatch.split("\n").length; // 1-indexed

			// Skip if covered by a YAML block
			const isCovered = coveredRanges.some(([start, end]) => testLine >= start && testLine <= end);
			if (isCovered) continue;

			const testLabel = match[1] ?? match[0];
			const describeLabel = findEnclosingDescribe(content, testLine, adapter);
			const implementation = detectImplementationForLine(content, testLine, adapter, lines);

			untracked.push({
				file: relFile,
				line: testLine,
				describe: describeLabel,
				it: testLabel,
				implementation,
			});
		}
	}

	return untracked;
}

/**
 * Scan backwards from a line number to find the nearest enclosing describe block.
 */
function findEnclosingDescribe(
	content: string,
	testLine: number,
	adapter: StackAdapter,
): string | undefined {
	const lines = content.split("\n");
	for (let i = testLine - 2; i >= 0; i--) {
		const line = lines[i] ?? "";
		const dm = adapter.describePattern.exec(line);
		if (dm?.[1]) return dm[1];
	}
	return undefined;
}

/**
 * Detect the implementation status for an untracked test at a given line.
 */
function detectImplementationForLine(
	content: string,
	testLine: number,
	adapter: StackAdapter,
	lines: string[],
): ImplementationStatus {
	const lineContent = lines[testLine - 1] ?? "";

	for (const pattern of adapter.stubPatterns) {
		if (pattern.test(lineContent)) {
			return { state: "stub", detected_from: "it-todo", reason: "Test uses todo/pending syntax" };
		}
	}

	for (const pattern of adapter.skipPatterns) {
		if (pattern.test(lineContent)) {
			return { state: "skipped", detected_from: "it-skip", reason: "Test is skipped" };
		}
	}

	return detectImplementationStatus({
		content,
		yamlEndLine: testLine,
		metadata: { type: "unit", summary: "" },
	});
}

// =============================================================================
// Ghost Entry Detection
// =============================================================================

/**
 * Find requirements in surface.json whose test files no longer exist on disk.
 */
export async function detectGhosts(dir: string, surfaceMap: SurfaceMap): Promise<GhostEntry[]> {
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];

	// Deduplicate files to avoid checking the same file multiple times
	const fileToIds = new Map<string, string[]>();
	for (const req of allReqs) {
		const f = req.location.file;
		const existing = fileToIds.get(f) ?? [];
		existing.push(req.id);
		fileToIds.set(f, existing);
	}

	const ghosts: GhostEntry[] = [];

	for (const [relFile, ids] of fileToIds) {
		const absFile = join(dir, relFile);
		const exists = await fileExists(absFile);
		if (exists) continue;

		const reason = await detectGhostReason(dir, relFile);
		for (const id of ids) {
			ghosts.push({ id, last_file: relFile, reason });
		}
	}

	return ghosts;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function detectGhostReason(
	dir: string,
	relFile: string,
): Promise<"file-deleted" | "file-renamed"> {
	try {
		// Use execFileSync with array args to avoid shell injection
		const output = execFileSync(
			"git",
			["log", "--diff-filter=R", "--name-status", "--follow", "--", relFile],
			{ cwd: dir, encoding: "utf-8" },
		).trim();
		if (output.includes("\tR")) return "file-renamed";
	} catch {
		// git not available or other error — default to deleted
	}
	return "file-deleted";
}

// =============================================================================
// Status Drift Detection
// =============================================================================

/**
 * Find requirements where the current implementation state differs from surface.json.
 */
export async function detectStatusDrift(
	dir: string,
	surfaceMap: SurfaceMap,
): Promise<StatusDrift[]> {
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];

	const fileContentCache = new Map<string, string>();
	const drifted: StatusDrift[] = [];

	for (const req of allReqs) {
		if (!req.implementation) continue;

		const relFile = req.location.file;
		const absFile = join(dir, relFile);

		let content = fileContentCache.get(relFile);
		if (content === undefined) {
			try {
				content = await readFile(absFile, "utf-8");
				fileContentCache.set(relFile, content);
			} catch {
				continue; // File deleted — handled by ghost detection
			}
		}

		const fresh = detectImplementationStatus({
			content,
			yamlEndLine: req.location.line,
			metadata: { type: "unit" as const, summary: req.summary, status: req.status },
		});

		if (fresh.state !== req.implementation.state) {
			drifted.push({
				id: req.id,
				file: relFile,
				recorded: req.implementation.state,
				actual: fresh.state,
			});
		}
	}

	return drifted;
}

// =============================================================================
// Coverage Gap Revalidation
// =============================================================================

/**
 * Re-check files listed as coverage gaps in surface.json.
 * A gap is stale if the file now contains parseable YAML blocks
 * (e.g. after parser improvements or manual annotation).
 */
async function revalidateGaps(dir: string, gaps: CoverageGap[]): Promise<CoverageGap[]> {
	const valid: CoverageGap[] = [];

	for (const gap of gaps) {
		const absFile = join(dir, gap.file);
		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			// File deleted — gap is moot (ghost detection handles this)
			continue;
		}

		const blocks = extractAllYamlBlocks(content);
		if (blocks.length === 0) {
			// Still a real gap
			valid.push(gap);
		}
		// else: file now has metadata, gap is stale — drop it
	}

	return valid;
}

// =============================================================================
// Full Drift Report
// =============================================================================

/**
 * Build a complete drift report comparing the live codebase against surface.json.
 */
export async function buildDriftReport(
	dir: string,
	surfaceMap: SurfaceMap,
	adapter: StackAdapter,
	testFilePatterns?: string[],
): Promise<DriftReport> {
	const [untracked, ghosts, status_drift] = await Promise.all([
		scanUntrackedTests(dir, adapter, testFilePatterns),
		detectGhosts(dir, surfaceMap),
		detectStatusDrift(dir, surfaceMap),
	]);

	// Re-check coverage gaps: surface.json may list a file as "no metadata"
	// but the parser may now detect blocks (e.g. after fixing indented YAML support).
	const coverage_gaps = await revalidateGaps(dir, surfaceMap.gaps ?? []);

	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
		...surfaceMap.smoke,
	];

	const testFiles = findTestFiles(dir, testFilePatterns ?? adapter.filePatterns);

	return {
		scanned_at: new Date().toISOString(),
		untracked,
		ghosts,
		status_drift,
		coverage_gaps,
		summary: {
			total_test_files: testFiles.length,
			total_tracked: allReqs.length,
			total_untracked: untracked.length,
			ghost_count: ghosts.length,
			drift_count: status_drift.length,
			clean: untracked.length === 0 && ghosts.length === 0 && status_drift.length === 0,
		},
	};
}
