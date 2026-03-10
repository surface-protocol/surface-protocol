/**
 * surface gen — Generate Surface Map
 *
 * THE KEYSTONE COMMAND. Generates surface.json + SURFACE.md from test metadata.
 */

import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import {
	buildSmokeVerificationMap,
	promoteToDeployed,
} from "../lib/detect-implementation-status.js";
import {
	formatFeatureDoc,
	formatJson,
	formatMarkdown,
	formatStatus,
	groupRequirementsByArea,
	normalizeAcceptance,
} from "../lib/formatters.js";
import { extractRequirementId, getRequirementCategory, parseDirectory } from "../lib/parser.js";
import type {
	LifecycleStage,
	ParsedTest,
	Placeholder,
	Requirement,
	SurfaceMap,
	SurfaceMapStats,
	TestType,
} from "../lib/types.js";
import { writeIfContentChanged } from "../lib/write-if-changed.js";

const PROTOCOL_VERSION = "2.0";

const PLACEHOLDER_STATUSES = new Set([
	"not-designed",
	"in-design",
	"ready-for-implementation",
	"in-progress",
]);

function toPlaceholderStatus(status: string | undefined): Placeholder["status"] {
	if (status && PLACEHOLDER_STATUSES.has(status)) {
		return status as Placeholder["status"];
	}
	return "not-designed";
}

// =============================================================================
// Surface Map Generation
// =============================================================================

function testsToRequirements(tests: ParsedTest[]): Requirement[] {
	return tests.map((test) => {
		const id = extractRequirementId(test.metadata);
		if (!id) {
			throw new Error(`Test at ${test.location.file}:${test.location.line} has no ID`);
		}

		const changed = test.metadata.changed ?? [];
		const authors = [...new Set(changed.map((c) => c.author).filter(Boolean))];
		const created = changed.length > 0 ? (changed[0]?.date ?? "") : "";
		const lastModified = changed.length > 0 ? (changed[changed.length - 1]?.date ?? "") : "";

		return {
			id,
			type: test.metadata.type,
			area: test.metadata.area,
			summary: test.metadata.summary,
			description: test.metadata.description,
			rationale: test.metadata.rationale,
			tags: test.metadata.tags ?? [],
			acceptance: normalizeAcceptance(test.metadata.acceptance as unknown[]),
			source: test.metadata.source,
			location: test.location,
			related: test.metadata.related,
			conflicts: test.metadata.conflicts_with ? [test.metadata.conflicts_with] : undefined,
			changed,
			authors: authors as string[],
			created,
			last_modified: lastModified,
			status: test.metadata.status ?? "active",
			override: test.metadata.override_approved
				? {
						approved: test.metadata.override_approved,
						reason: test.metadata.override_reason ?? "",
						expires: test.metadata.override_expires,
						ticket: test.metadata.override_ticket,
					}
				: null,
			flaky: test.metadata.flaky ?? false,
			audience: test.metadata.audience,
			implementation: test.implementation,
			lifecycle: test.lifecycle,
			discovered: test.metadata.discovered,
			incident: test.metadata.incident,
			rootcause: test.metadata.rootcause,
			learning: test.metadata.learning,
			consolidated_into: test.metadata.consolidated_into,
		};
	});
}

function extractPlaceholders(tests: ParsedTest[]): Placeholder[] {
	const placeholders: Placeholder[] = [];
	for (const test of tests) {
		if (test.metadata.placeholder) {
			placeholders.push({
				component: test.metadata.placeholder,
				status: toPlaceholderStatus(test.metadata.status),
				created: test.metadata.changed?.[0]?.date ?? new Date().toISOString().slice(0, 10),
				figma_id: test.metadata.figma_id,
				description: test.metadata.description,
				interaction: test.metadata.interaction,
				blocked_by: test.metadata.blocked_by,
			});
		}
	}
	return placeholders;
}

function calculateStats(
	requirements: Requirement[],
	regressions: Requirement[],
	flows: Requirement[],
	contracts: Requirement[],
	smoke: Requirement[],
	gapsCount: number,
): SurfaceMapStats {
	const all = [...requirements, ...regressions, ...flows, ...contracts, ...smoke];
	const byType: Record<TestType, number> = {
		unit: 0,
		regression: 0,
		functional: 0,
		e2e: 0,
		contract: 0,
		performance: 0,
		security: 0,
		smoke: 0,
	};
	const byArea: Record<string, number> = {};
	const byTag: Record<string, number> = {};

	for (const req of all) {
		byType[req.type] = (byType[req.type] ?? 0) + 1;
		if (req.area) byArea[req.area] = (byArea[req.area] ?? 0) + 1;
		for (const tag of req.tags) byTag[tag] = (byTag[tag] ?? 0) + 1;
	}

	return {
		total: all.length,
		by_type: byType,
		by_area: byArea,
		by_tag: byTag,
		coverage: { with_metadata: all.length, without_metadata: gapsCount },
	};
}

async function generateSurfaceMap(dir: string, testFilePatterns?: string[]): Promise<SurfaceMap> {
	const { tests, gaps } = await parseDirectory(dir, { includeGaps: true, testFilePatterns });
	const requirements = testsToRequirements(tests);

	const categorized = {
		requirements: [] as Requirement[],
		regressions: [] as Requirement[],
		flows: [] as Requirement[],
		contracts: [] as Requirement[],
		smoke: [] as Requirement[],
	};

	for (const req of requirements) {
		const category = getRequirementCategory(req.id);
		categorized[category].push(req);
	}

	const smokeMap = buildSmokeVerificationMap(tests);
	const allReqs = [
		...categorized.requirements,
		...categorized.regressions,
		...categorized.flows,
		...categorized.contracts,
		...categorized.smoke,
	];
	promoteToDeployed(allReqs, smokeMap);

	const placeholders = extractPlaceholders(tests);
	const stats = calculateStats(
		categorized.requirements,
		categorized.regressions,
		categorized.flows,
		categorized.contracts,
		categorized.smoke,
		gaps.length,
	);

	return {
		generated: new Date().toISOString(),
		version: PROTOCOL_VERSION,
		stats,
		...categorized,
		placeholders,
		gaps,
	};
}

// =============================================================================
// Status Check
// =============================================================================

async function checkStatus(
	dir: string,
	outputDir: string,
	surfaceJsonName: string,
	testFilePatterns?: string[],
): Promise<{ status: "CURRENT" | "STALE" | "INVALID"; message: string }> {
	const surfaceJsonPath = join(outputDir, surfaceJsonName);
	try {
		const existingContent = await readFile(surfaceJsonPath, "utf-8");
		const existing = JSON.parse(existingContent) as SurfaceMap;
		const current = await generateSurfaceMap(dir, testFilePatterns);

		const existingWithoutTime = { ...existing, generated: "" };
		const currentWithoutTime = { ...current, generated: "" };

		if (JSON.stringify(existingWithoutTime) === JSON.stringify(currentWithoutTime)) {
			return { status: "CURRENT", message: "Surface map matches test metadata" };
		}
		return { status: "STALE", message: "Tests modified since last generation" };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { status: "INVALID", message: "surface.json not found — run `surface gen` to create" };
		}
		return {
			status: "INVALID",
			message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
		};
	}
}

// =============================================================================
// Command Registration
// =============================================================================

export function registerGenCommand(program: Command): void {
	program
		.command("gen")
		.description("Generate surface.json + SURFACE.md from test metadata")
		.option("-o, --output <dir>", "Output directory", ".")
		.option("-s, --status", "Just check if current (exit 0/1)")
		.option("-q, --quiet", "Minimal output")
		.action(async (options) => {
			const cwd = process.cwd();
			const config = await loadConfig(cwd);
			const outputDir = resolve(cwd, options.output as string);
			const quiet = options.quiet as boolean;
			const surfaceJsonName = config.output.surfaceJson;
			const surfaceMdName = config.output.surfaceMd;
			const featureDocsDir = config.output.featureDocs;
			const testFilePatterns = config.testFilePatterns;

			if (options.status) {
				const result = await checkStatus(cwd, outputDir, surfaceJsonName, testFilePatterns);
				if (!quiet) {
					console.log(formatStatus(result.status, result.message));
				} else {
					console.log(result.status);
				}
				process.exit(result.status === "CURRENT" ? 0 : 1);
			}

			try {
				const surfaceMap = await generateSurfaceMap(cwd, testFilePatterns);

				const jsonPath = join(outputDir, surfaceJsonName);
				await writeIfContentChanged(jsonPath, `${formatJson(surfaceMap)}\n`);

				const mdPath = join(outputDir, surfaceMdName);
				await writeIfContentChanged(mdPath, `${formatMarkdown(surfaceMap)}\n`);

				const featuresDir = join(outputDir, featureDocsDir);
				await mkdir(featuresDir, { recursive: true });
				const areaGroups = groupRequirementsByArea(surfaceMap);
				const featureDocPaths: string[] = [];
				for (const [area, reqs] of areaGroups) {
					const featurePath = join(featuresDir, `${area}.md`);
					await writeIfContentChanged(
						featurePath,
						`${formatFeatureDoc(area, reqs, surfaceMap.generated)}\n`,
					);
					featureDocPaths.push(featurePath);
				}

				if (!quiet) {
					console.log(chalk.green("Generated:"));
					console.log(`  ${jsonPath}`);
					console.log(`  ${mdPath}`);
					for (const fp of featureDocPaths) console.log(`  ${fp}`);
					console.log("");
					console.log(`Total requirements: ${surfaceMap.stats.total}`);
					console.log(
						`Coverage: ${surfaceMap.stats.coverage.with_metadata} with metadata, ${surfaceMap.stats.coverage.without_metadata} gaps`,
					);

					// Dangerous requirements
					const dangerousTags = new Set(config.tagCategories.dangerous);
					const dangerous = [
						...surfaceMap.requirements,
						...surfaceMap.regressions,
						...surfaceMap.flows,
						...surfaceMap.contracts,
						...surfaceMap.smoke,
					].filter((r) => r.tags.some((t) => dangerousTags.has(t)));

					if (dangerous.length > 0) {
						console.log("");
						console.log(chalk.red(`DANGEROUS requirements: ${dangerous.length}`));
						for (const d of dangerous.slice(0, 5)) {
							console.log(chalk.dim(`  - ${d.id}: ${d.summary}`));
						}
						if (dangerous.length > 5) {
							console.log(chalk.dim(`  ... and ${dangerous.length - 5} more`));
						}
					}

					// Lifecycle
					const allReqs = [
						...surfaceMap.requirements,
						...surfaceMap.regressions,
						...surfaceMap.flows,
						...surfaceMap.contracts,
						...surfaceMap.smoke,
					];
					const lc: Record<LifecycleStage, number> = { stub: 0, coded: 0, tested: 0, deployed: 0 };
					for (const r of allReqs) {
						if (r.lifecycle) lc[r.lifecycle.stage]++;
					}
					if (allReqs.length > 0) {
						console.log("");
						console.log(chalk.bold("Lifecycle:"));
						console.log(
							`  stub: ${lc.stub}  coded: ${lc.coded}  tested: ${lc.tested}  deployed: ${lc.deployed}`,
						);
					}
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown"}`));
				process.exit(1);
			}
		});
}
