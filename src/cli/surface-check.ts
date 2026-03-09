/**
 * surface check — Validate Surface Coverage
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { formatCoverageReport, formatJson } from "../lib/formatters.js";
import { parseDirectory } from "../lib/parser.js";
import type { CoverageReport, LifecycleStage, SurfaceMap, TestType } from "../lib/types.js";
import { isDangerous, isOverrideExpired } from "../lib/validators.js";

async function analyzeCoverage(dir: string): Promise<CoverageReport> {
	const { tests, gaps } = await parseDirectory(dir, { includeGaps: true });
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
	let dangerousCount = 0;
	let overrideCount = 0;
	let flakyCount = 0;
	let placeholderCount = 0;

	for (const test of tests) {
		const meta = test.metadata;
		byType[meta.type] = (byType[meta.type] ?? 0) + 1;
		if (meta.area) byArea[meta.area] = (byArea[meta.area] ?? 0) + 1;
		if (isDangerous(meta)) dangerousCount++;
		if (meta.override_approved) overrideCount++;
		if (meta.flaky) flakyCount++;
		if (meta.placeholder) placeholderCount++;
	}

	const total = tests.length + gaps.length;
	return {
		total_tests: total,
		with_metadata: tests.length,
		without_metadata: gaps.length,
		coverage_percent: total > 0 ? (tests.length / total) * 100 : 0,
		by_type: byType,
		by_area: byArea,
		dangerous_count: dangerousCount,
		override_count: overrideCount,
		flaky_count: flakyCount,
		placeholder_count: placeholderCount,
		gaps,
	};
}

interface FreshnessIssue {
	file: string;
	lastBlame: string;
	lastChanged: string;
	diff: number;
}

async function checkFreshness(surfaceMap: SurfaceMap): Promise<FreshnessIssue[]> {
	const issues: FreshnessIssue[] = [];
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
	];

	for (const req of allReqs) {
		if (req.changed.length === 0) continue;
		try {
			const blameOutput = execSync(`git log -1 --format=%cs -- "${req.location.file}"`, {
				encoding: "utf-8",
			}).trim();
			if (!blameOutput) continue;
			const dates = req.changed.map((c) => c.date).filter(Boolean);
			const lastChanged = dates.sort().reverse()[0] ?? "";
			const diffDays = Math.floor(
				(new Date(blameOutput).getTime() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24),
			);
			if (diffDays > 7) {
				issues.push({
					file: req.location.file,
					lastBlame: blameOutput,
					lastChanged,
					diff: diffDays,
				});
			}
		} catch {
			/* ignore git errors */
		}
	}
	return issues;
}

function checkOverrides(surfaceMap: SurfaceMap) {
	const overrides: Array<{
		id: string;
		file: string;
		approved: string;
		reason: string;
		expires?: string;
		expired: boolean;
	}> = [];
	const allReqs = [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
	];
	for (const req of allReqs) {
		if (req.override) {
			overrides.push({
				id: req.id,
				file: req.location.file,
				approved: req.override.approved,
				reason: req.override.reason,
				expires: req.override.expires,
				expired: isOverrideExpired(req.override.expires),
			});
		}
	}
	return overrides;
}

export function registerCheckCommand(program: Command): void {
	program
		.command("check")
		.description("Validate coverage, freshness, gaps")
		.option("--coverage", "Report coverage percentages")
		.option("--freshness", "Compare git blame vs @changed dates")
		.option("--gaps", "Find untested areas")
		.option("--placeholders", "List pending/skip tests")
		.option("--overrides", "Check for expired overrides")
		.option("--lifecycle", "Show lifecycle stage breakdown")
		.option("--json", "JSON output")
		.action(async (options) => {
			const cwd = process.cwd();
			const config = await loadConfig(cwd);
			const surfaceJsonPath = join(cwd, config.output.surfaceJson);
			const jsonOutput = options.json as boolean;

			let surfaceMap: SurfaceMap | null = null;
			try {
				const content = await readFile(surfaceJsonPath, "utf-8");
				surfaceMap = JSON.parse(content) as SurfaceMap;
			} catch {
				/* will regenerate if needed */
			}

			const showAll =
				!options.coverage &&
				!options.freshness &&
				!options.gaps &&
				!options.placeholders &&
				!options.overrides &&
				!options.lifecycle;
			const results: Record<string, unknown> = {};

			if (options.coverage || showAll) {
				const coverage = await analyzeCoverage(cwd);
				results.coverage = coverage;
				if (!jsonOutput) {
					console.log(formatCoverageReport(coverage));
					console.log("");
				}
			}

			if ((options.freshness || showAll) && surfaceMap) {
				const freshness = await checkFreshness(surfaceMap);
				results.freshness = freshness;
				if (!jsonOutput) {
					if (freshness.length > 0) {
						console.log(chalk.bold("Freshness Issues:"));
						for (const issue of freshness)
							console.log(
								chalk.yellow(`  ${issue.file}: ${issue.diff} days since metadata update`),
							);
					} else {
						console.log(chalk.green("No freshness issues found."));
					}
					console.log("");
				}
			}

			if (options.gaps || showAll) {
				const { gaps } = await parseDirectory(cwd, { includeGaps: true });
				results.gaps = gaps;
				if (!jsonOutput) {
					if (gaps.length > 0) {
						console.log(chalk.bold(`Gaps (${gaps.length}):`));
						for (const gap of gaps.slice(0, 10))
							console.log(chalk.dim(`  ${gap.file}: ${gap.reason}`));
						if (gaps.length > 10) console.log(chalk.dim(`  ... and ${gaps.length - 10} more`));
					} else {
						console.log(chalk.green("No coverage gaps found."));
					}
					console.log("");
				}
			}

			if ((options.overrides || showAll) && surfaceMap) {
				const overrides = checkOverrides(surfaceMap);
				results.overrides = overrides;
				if (!jsonOutput) {
					if (overrides.length > 0) {
						console.log(chalk.bold(`Overrides (${overrides.length}):`));
						for (const o of overrides) {
							const status = o.expired ? chalk.red("EXPIRED") : chalk.yellow("ACTIVE");
							console.log(`  ${o.id}: ${status} - ${o.reason}`);
						}
					} else {
						console.log(chalk.green("No active overrides."));
					}
					console.log("");
				}
			}

			if ((options.lifecycle || showAll) && surfaceMap) {
				const allReqs = [
					...surfaceMap.requirements,
					...surfaceMap.regressions,
					...surfaceMap.flows,
					...surfaceMap.contracts,
				];
				const lc: Record<LifecycleStage, number> = { stub: 0, coded: 0, tested: 0, deployed: 0 };
				for (const req of allReqs) {
					if (req.lifecycle) lc[req.lifecycle.stage]++;
				}
				results.lifecycle = lc;
				if (!jsonOutput) {
					console.log(chalk.bold("Lifecycle Breakdown:"));
					console.log(`  ${chalk.dim("stub:")}     ${lc.stub}`);
					console.log(`  ${chalk.yellow("coded:")}    ${lc.coded}`);
					console.log(`  ${chalk.green("tested:")}   ${lc.tested}`);
					console.log(`  ${chalk.blue("deployed:")} ${lc.deployed}`);
					const stubs = allReqs.filter((r) => r.lifecycle?.stage === "stub");
					if (stubs.length > 0) {
						console.log("");
						console.log(chalk.bold(`Stubs needing implementation (${stubs.length}):`));
						for (const s of stubs.slice(0, 10)) console.log(chalk.dim(`  ${s.id}: ${s.summary}`));
						if (stubs.length > 10) console.log(chalk.dim(`  ... and ${stubs.length - 10} more`));
					}
					console.log("");
				}
			}

			if (jsonOutput) console.log(formatJson(results));
		});
}
