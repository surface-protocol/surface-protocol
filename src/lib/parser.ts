/**
 * Surface Protocol YAML Parser
 *
 * Extracts YAML frontmatter from test files and parses it into structured metadata.
 * Supports multiple comment formats via the adapter system.
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CommentFormat } from "./adapters/adapter.js";
import { buildFrontmatterRegex, HASH_BLOCK, JS_BLOCK, preprocessYaml } from "./comment-formats.js";
import {
	detectImplementationStatus,
	detectLifecycleStage,
} from "./detect-implementation-status.js";
import type { ParsedTest, TestLocation, TestMetadata } from "./types.js";

// =============================================================================
// Multi-format YAML Extraction
// =============================================================================

/** All supported comment formats, tried in order */
const ALL_FORMATS: CommentFormat[] = [JS_BLOCK, HASH_BLOCK];

/**
 * Extracts YAML frontmatter from a string, trying all known formats.
 * Returns null if no valid frontmatter found.
 */
export function extractYamlFrontmatter(content: string): object | null {
	for (const format of ALL_FORMATS) {
		const regex = buildFrontmatterRegex(format);
		const match = regex.exec(content);
		if (match?.[1]) {
			try {
				const yamlContent = preprocessYaml(match[1], format);
				const parsed = parseYaml(yamlContent);
				if (typeof parsed === "object" && parsed !== null) return parsed;
			} catch {
				/* try next format */
			}
		}
	}
	return null;
}

/**
 * Extracts all YAML frontmatter blocks from a file.
 * Tries all known comment formats.
 */
export function extractAllYamlBlocks(
	content: string,
): Array<{ yaml: object; startLine: number; endLine: number; raw: string }> {
	const blocks: Array<{
		yaml: object;
		startLine: number;
		endLine: number;
		raw: string;
	}> = [];

	for (const format of ALL_FORMATS) {
		const regex = buildFrontmatterRegex(format);
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
		while ((match = regex.exec(content)) !== null) {
			const raw = match[1] ?? "";
			try {
				const yamlContent = preprocessYaml(raw, format);
				const yaml = parseYaml(yamlContent);
				if (typeof yaml !== "object" || yaml === null) continue;

				const beforeMatch = content.slice(0, match.index);
				const startLine = beforeMatch.split("\n").length;
				const blockLines = match[0].split("\n").length;
				const endLine = startLine + blockLines - 1;

				blocks.push({ yaml, startLine, endLine, raw });
			} catch {
				/* Skip invalid YAML blocks */
			}
		}

		// If we found blocks with this format, don't try other formats
		if (blocks.length > 0) break;
	}

	return blocks;
}

// =============================================================================
// Test Location Extraction
// =============================================================================

/**
 * Finds the nearest describe/it block after a given line number.
 * Supports both JS (describe/it) and Ruby (describe/it/context) syntax.
 */
function findTestLocation(
	content: string,
	afterLine: number,
): { describe: string | undefined; it: string | undefined } {
	const lines = content.split("\n");
	const searchContent = lines.slice(afterLine).join("\n");

	// JS: describe("name", ...) or Ruby: RSpec.describe "name" do / describe "name" do
	const describeMatch = searchContent.match(
		/(?:RSpec\.)?(?:describe|context)\s*[(]?\s*['"`]([^'"`]+)['"`]/,
	);
	const describe = describeMatch?.[1];

	// JS: it("name", ...) or it.todo("name") / Ruby: it "name" do
	const itMatch = searchContent.match(/it(?:\.todo)?\s*[(]?\s*['"`]([^'"`]+)['"`]/);
	const it = itMatch?.[1];

	return { describe, it };
}

// =============================================================================
// File Parsing
// =============================================================================

export async function parseTestFile(filePath: string): Promise<ParsedTest[]> {
	const content = await readFile(filePath, "utf-8");
	return parseTestFileContent(content, filePath);
}

export function parseTestFileContent(content: string, filePath: string): ParsedTest[] {
	const blocks = extractAllYamlBlocks(content);
	const tests: ParsedTest[] = [];

	for (const block of blocks) {
		const { describe, it } = findTestLocation(content, block.endLine);
		const location: TestLocation = { file: filePath, line: block.startLine, describe, it };

		const detectionContext = {
			content,
			yamlEndLine: block.endLine,
			metadata: block.yaml as TestMetadata,
		};
		const implementation = detectImplementationStatus(detectionContext);
		const lifecycle = detectLifecycleStage(detectionContext);

		tests.push({
			metadata: block.yaml as TestMetadata,
			location,
			raw: block.raw,
			implementation,
			lifecycle,
		});
	}

	return tests;
}

export function parseTestFileContentBasic(content: string, filePath: string): ParsedTest[] {
	const blocks = extractAllYamlBlocks(content);
	const tests: ParsedTest[] = [];

	for (const block of blocks) {
		const { describe, it } = findTestLocation(content, block.endLine);
		const location: TestLocation = { file: filePath, line: block.startLine, describe, it };
		tests.push({ metadata: block.yaml as TestMetadata, location, raw: block.raw });
	}

	return tests;
}

// =============================================================================
// Directory Scanning
// =============================================================================

/**
 * Default test file patterns (used when no config specifies patterns).
 */
const DEFAULT_PATTERNS = [
	'"*.test.ts"',
	'"*.test.tsx"',
	'"*.spec.ts"',
	'"*.spec.tsx"',
	'"*_spec.rb"',
];

/**
 * Finds all test files using git ls-files.
 * Accepts optional patterns to override the defaults.
 * Falls back to `find` if not in a git repo.
 */
function findTestFiles(dir: string, patterns?: string[]): string[] {
	const globPatterns = patterns
		? patterns.map((p) => `"${p.replace(/\*\*\//g, "")}"`)
		: DEFAULT_PATTERNS;

	try {
		const output = execSync(
			`git ls-files --cached --others --exclude-standard ${globPatterns.join(" ")}`,
			{ cwd: dir, encoding: "utf-8" },
		);
		return output
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((f) => join(dir, f))
			.sort();
	} catch {
		// Not a git repo — fall back to find
		const rawPatterns = patterns ?? ["*.test.ts", "*.spec.ts", "*_spec.rb"];
		const findArgs = rawPatterns.map((p) => `-name "${p.replace(/\*\*\//g, "")}"`).join(" -o ");
		try {
			const output = execSync(`find . -type f \\( ${findArgs} \\) -not -path "*/node_modules/*"`, {
				cwd: dir,
				encoding: "utf-8",
			});
			return output
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((f) => join(dir, f.replace(/^\.\//, "")))
				.sort();
		} catch {
			return [];
		}
	}
}

/**
 * Parses all test files in a directory.
 */
export async function parseDirectory(
	dir: string,
	options: {
		glob?: string;
		includeGaps?: boolean;
		testFilePatterns?: string[];
	} = {},
): Promise<{
	tests: ParsedTest[];
	gaps: Array<{ file: string; reason: string }>;
}> {
	const testFiles = findTestFiles(dir, options.testFilePatterns);
	const tests: ParsedTest[] = [];
	const gaps: Array<{ file: string; reason: string }> = [];

	for (const file of testFiles) {
		try {
			const fileTests = await parseTestFile(file);
			if (fileTests.length === 0 && options.includeGaps) {
				gaps.push({ file: relative(dir, file), reason: "No metadata found" });
			}
			tests.push(...fileTests);
		} catch (error) {
			if (options.includeGaps) {
				gaps.push({
					file: relative(dir, file),
					reason: `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}
	}

	return { tests, gaps };
}

// =============================================================================
// ID Extraction
// =============================================================================

export function extractRequirementId(metadata: TestMetadata): string | null {
	return metadata.req || metadata.flow || metadata.contract || metadata.smoke || null;
}

export function getRequirementCategory(
	id: string,
): "requirements" | "regressions" | "flows" | "contracts" {
	if (id.startsWith("REGR-")) return "regressions";
	if (id.startsWith("FLOW-")) return "flows";
	if (id.startsWith("CONTRACT-")) return "contracts";
	return "requirements";
}

// =============================================================================
// Validation Helpers
// =============================================================================

export function hasRequiredFields(metadata: TestMetadata): boolean {
	const hasId = Boolean(metadata.req || metadata.flow || metadata.contract || metadata.smoke);
	return hasId && Boolean(metadata.type) && Boolean(metadata.summary);
}

export function getMissingFields(metadata: TestMetadata): string[] {
	const missing: string[] = [];
	if (!(metadata.req || metadata.flow || metadata.contract || metadata.smoke)) {
		missing.push("req|flow|contract|smoke (at least one required)");
	}
	if (!metadata.type) missing.push("type");
	if (!metadata.summary) missing.push("summary");
	return missing;
}
