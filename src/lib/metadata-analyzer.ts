/**
 * Metadata Analyzer
 *
 * Analyzes existing hand-written YAML metadata to extract style patterns.
 * The /surface:backfill skill uses this to generate enriched metadata that
 * matches the project's existing conventions.
 */

import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { StackAdapter } from "./adapters/adapter.js";
import { extractAllYamlBlocks, findTestFiles } from "./parser.js";

// =============================================================================
// Types
// =============================================================================

export interface MetadataStyleGuide {
	/** Total number of parsed YAML blocks. */
	totalBlocks: number;
	/** All unique area values found. */
	areas: string[];
	/** Tags sorted by frequency (most common first). */
	commonTags: string[];
	/** Average number of it() calls covered per YAML block. */
	avgTestsPerRequirement: number;
	/** Whether any existing blocks include a rationale field. */
	hasRationale: boolean;
	/** Whether any existing blocks include acceptance criteria. */
	hasAcceptance: boolean;
	/** Whether any existing blocks include tags. */
	hasTags: boolean;
	/** 3-5 representative YAML blocks as style examples (shortest to longest). */
	exampleBlocks: ExampleBlock[];
}

export interface ExampleBlock {
	raw: string;
	file: string;
	area: string;
}

// =============================================================================
// Analysis
// =============================================================================

/**
 * Analyze all existing YAML metadata in the project to extract style patterns.
 * Returns a MetadataStyleGuide that the skill uses to generate consistent metadata.
 */
export async function analyzeExistingMetadata(
	dir: string,
	adapter: StackAdapter,
	testFilePatterns?: string[],
): Promise<MetadataStyleGuide> {
	const testFiles = findTestFiles(dir, testFilePatterns ?? adapter.filePatterns);

	const allBlocks: Array<{ yaml: Record<string, unknown>; raw: string; file: string }> = [];
	let totalTestsInBlockFiles = 0;

	for (const absFile of testFiles) {
		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}

		const blocks = extractAllYamlBlocks(content);
		if (blocks.length === 0) continue;

		const relFile = relative(dir, absFile);
		for (const block of blocks) {
			allBlocks.push({
				yaml: block.yaml as Record<string, unknown>,
				raw: block.raw,
				file: relFile,
			});
		}

		// Count it() calls in this file to estimate tests-per-block ratio
		const itMatches = [...content.matchAll(new RegExp(adapter.itPattern.source, "g"))];
		totalTestsInBlockFiles += itMatches.length;
	}

	if (allBlocks.length === 0) {
		return emptyStyleGuide();
	}

	// Extract areas
	const areaCounts = new Map<string, number>();
	for (const b of allBlocks) {
		const area = String(b.yaml.area ?? "");
		if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
	}

	// Extract tags
	const tagCounts = new Map<string, number>();
	for (const b of allBlocks) {
		const tags = b.yaml.tags;
		if (Array.isArray(tags)) {
			for (const tag of tags) {
				const t = String(tag);
				tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
			}
		}
	}

	// Check for rationale, acceptance, tags presence
	const hasRationale = allBlocks.some((b) => b.yaml.rationale !== undefined);
	const hasAcceptance = allBlocks.some(
		(b) => b.yaml.acceptance !== undefined && Array.isArray(b.yaml.acceptance),
	);
	const hasTags = allBlocks.some(
		(b) => Array.isArray(b.yaml.tags) && (b.yaml.tags as unknown[]).length > 0,
	);

	// Average tests per requirement
	const avgTestsPerRequirement =
		allBlocks.length > 0 ? totalTestsInBlockFiles / allBlocks.length : 1;

	// Select example blocks (prefer ones with rationale + acceptance)
	const examples = selectExampleBlocks(allBlocks);

	return {
		totalBlocks: allBlocks.length,
		areas: [...areaCounts.keys()].sort(),
		commonTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag),
		avgTestsPerRequirement: Math.round(avgTestsPerRequirement * 10) / 10,
		hasRationale,
		hasAcceptance,
		hasTags,
		exampleBlocks: examples,
	};
}

function emptyStyleGuide(): MetadataStyleGuide {
	return {
		totalBlocks: 0,
		areas: [],
		commonTags: [],
		avgTestsPerRequirement: 1,
		hasRationale: false,
		hasAcceptance: false,
		hasTags: false,
		exampleBlocks: [],
	};
}

/**
 * Select 3-5 representative example blocks, preferring blocks with
 * rationale and acceptance criteria (the "richest" examples).
 */
function selectExampleBlocks(
	allBlocks: Array<{ yaml: Record<string, unknown>; raw: string; file: string }>,
): ExampleBlock[] {
	// Score blocks by richness
	const scored = allBlocks.map((b) => {
		let score = 0;
		if (b.yaml.rationale) score += 3;
		if (Array.isArray(b.yaml.acceptance) && (b.yaml.acceptance as unknown[]).length > 0) score += 2;
		if (Array.isArray(b.yaml.tags) && (b.yaml.tags as unknown[]).length > 0) score += 1;
		if (b.yaml.summary) score += 1;
		return { ...b, score };
	});

	// Take top 5 by score, then sort by raw length (shortest first for readability)
	const top = scored
		.sort((a, b) => b.score - a.score)
		.slice(0, 5)
		.sort((a, b) => a.raw.length - b.raw.length);

	return top.map((b) => ({
		raw: b.raw,
		file: b.file,
		area: String(b.yaml.area ?? ""),
	}));
}
