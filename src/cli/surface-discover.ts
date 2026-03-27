/**
 * surface discover — Code surface discovery
 *
 * Scans implementation code (not test files) to find all customer-facing
 * entry points: API routes, web pages, CLI commands, package scripts, etc.
 *
 * Cross-references against surface.json to classify coverage:
 * - covered: has a test with YAML surface metadata
 * - untracked: has a test but no metadata
 * - untested: no test coverage at all
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import "../lib/adapters/index.js";
import { loadConfig } from "../lib/config.js";
import "../lib/discovery/index.js";
import { autoDetectAdapters } from "../lib/discovery/adapter.js";
import { linkCoverage } from "../lib/discovery/coverage-linker.js";
import { formatJson } from "../lib/formatters.js";
import type {
	DiscoveryReport,
	EntryPointType,
	SurfaceEntryPoint,
	SurfaceMap,
} from "../lib/types.js";

export function registerDiscoverCommand(program: Command): void {
	program
		.command("discover")
		.description(
			"Scan implementation code to find customer-facing entry points (APIs, pages, CLI, scripts) and assess test coverage",
		)
		.option("--json", "Output machine-readable DiscoveryReport JSON")
		.option("--type <type>", "Filter to one entry point type: api, page, cli, script, graphql")
		.option("--uncovered", "Show only untested and untracked entry points")
		.option("--exit-code", "Exit 1 if any untested entry points found")
		.option("--coverage", "Show coverage percentages per type")
		.option(
			"--save",
			"Save discovery results to surface.json (adds `discovered` section)",
		)
		.action(async (options) => {
			const cwd = process.cwd();

			const config = await loadConfig(cwd);
			const surfaceJsonPath = join(cwd, config.output.surfaceJson);

			let surfaceMap: SurfaceMap;
			try {
				const content = await readFile(surfaceJsonPath, "utf-8");
				surfaceMap = JSON.parse(content) as SurfaceMap;
			} catch {
				console.error(
					chalk.red(
						`Error: surface.json not found at ${surfaceJsonPath}. Run \`surface gen\` first.`,
					),
				);
				process.exit(2);
			}

			// Auto-detect applicable discovery adapters
			const adapters = await autoDetectAdapters(cwd);

			if (adapters.length === 0) {
				console.log(
					chalk.yellow(
						"No discovery adapters detected for this project. Supported: Hono, Astro, Rails, Commander, GraphQL, package.json scripts.",
					),
				);
				return;
			}

			if (!options.json) {
				console.log(
					chalk.dim(`Detected adapters: ${adapters.map((a) => a.name).join(", ")}`),
				);
			}

			// Discover entry points from all adapters
			const rawEntryPoints = (
				await Promise.all(adapters.map((a) => a.discover(cwd).catch(() => [])))
			).flat();

			// Filter by type if requested
			const filtered = options.type
				? rawEntryPoints.filter((ep) => ep.type === options.type)
				: rawEntryPoints;

			if (filtered.length === 0) {
				if (options.type) {
					console.log(chalk.yellow(`No entry points of type "${options.type}" found.`));
				} else {
					console.log(chalk.yellow("No entry points discovered."));
				}
				return;
			}

			// Link coverage
			const entryPoints = await linkCoverage(
				cwd,
				filtered,
				surfaceMap,
				config.testFilePatterns,
			);

			// Build report
			const report: DiscoveryReport = buildDiscoveryReport(entryPoints);

			if (options.save) {
				surfaceMap.discovered = report;
				await writeFile(surfaceJsonPath, JSON.stringify(surfaceMap, null, 2), "utf-8");
				if (!options.json) {
					console.log(chalk.green(`Saved discovery results to ${surfaceJsonPath}`));
				}
			}

			if (options.json) {
				console.log(formatJson(report));
			} else {
				printDiscoveryReport(report, {
					uncoveredOnly: options.uncovered,
					showCoverage: options.coverage,
					filterType: options.type as EntryPointType | undefined,
				});
			}

			if (options.exitCode && report.stats.untested > 0) process.exit(1);
		});
}

function buildDiscoveryReport(entryPoints: SurfaceEntryPoint[]): DiscoveryReport {
	const stats = {
		total: entryPoints.length,
		covered: entryPoints.filter((ep) => ep.coverage === "covered").length,
		untracked: entryPoints.filter((ep) => ep.coverage === "untracked").length,
		untested: entryPoints.filter((ep) => ep.coverage === "untested").length,
		by_type: {} as Partial<Record<EntryPointType, number>>,
	};

	for (const ep of entryPoints) {
		stats.by_type[ep.type] = (stats.by_type[ep.type] ?? 0) + 1;
	}

	return {
		generated: new Date().toISOString(),
		entry_points: entryPoints,
		stats,
	};
}

interface PrintOpts {
	uncoveredOnly: boolean;
	showCoverage: boolean;
	filterType?: EntryPointType;
}

function printDiscoveryReport(report: DiscoveryReport, opts: PrintOpts): void {
	const { stats, entry_points } = report;

	console.log(chalk.bold("SURFACE DISCOVERY REPORT"));
	console.log(chalk.bold("========================"));
	console.log("");

	// Group by type
	const byType = new Map<EntryPointType, SurfaceEntryPoint[]>();
	for (const ep of entry_points) {
		const arr = byType.get(ep.type) ?? [];
		arr.push(ep);
		byType.set(ep.type, arr);
	}

	const typeOrder: EntryPointType[] = ["api", "page", "cli", "script", "graphql", "webhook"];

	for (const type of typeOrder) {
		const eps = byType.get(type);
		if (!eps || eps.length === 0) continue;

		const displayed = opts.uncoveredOnly
			? eps.filter((ep) => ep.coverage !== "covered")
			: eps;

		if (displayed.length === 0) continue;

		const coveredCount = eps.filter((ep) => ep.coverage === "covered").length;
		const typeLabel = `${type.toUpperCase()}S`;
		const coverageNote = opts.showCoverage
			? chalk.dim(` (${coveredCount}/${eps.length} covered)`)
			: "";

		console.log(chalk.bold(`${typeLabel} (${displayed.length}${opts.uncoveredOnly ? " uncovered" : ""} / ${eps.length} total)${coverageNote}:`));

		for (const ep of displayed.slice(0, 30)) {
			const icon = coverageIcon(ep.coverage);
			const method = ep.method ? chalk.dim(`${ep.method} `) : "";
			const path = chalk.white(ep.path);
			const file = chalk.dim(`  ${ep.file}:${ep.line}`);
			const reqLabel =
				ep.requirement_ids.length > 0
					? chalk.dim(` [${ep.requirement_ids.join(", ")}]`)
					: "";
			const coverageLabel = coverageBadge(ep.coverage);

			console.log(`  ${icon} ${method}${path}${file}${reqLabel} ${coverageLabel}`);
		}
		if (displayed.length > 30) {
			console.log(chalk.dim(`  ... and ${displayed.length - 30} more`));
		}
		console.log("");
	}

	// Summary
	console.log(chalk.bold("Summary:"));
	console.log(`  Total entry points:  ${stats.total}`);
	console.log(`  ${chalk.green("✓")} Covered:    ${stats.covered}`);
	if (stats.untracked > 0) {
		console.log(`  ${chalk.yellow("~")} Untracked:  ${stats.untracked}  ${chalk.dim("(tests exist but no surface metadata)")}`);
	}
	if (stats.untested > 0) {
		console.log(`  ${chalk.red("✗")} Untested:   ${stats.untested}  ${chalk.dim("(no test coverage)")}`);
	}

	if (stats.untracked > 0) {
		console.log(chalk.dim("\n→ Run `surface backfill` to annotate untracked tests."));
	}
	if (stats.untested > 0) {
		console.log(
			chalk.dim(
				"→ Run `surface capture` for each untested entry point to create test stubs.",
			),
		);
	}
}

function coverageIcon(coverage: SurfaceEntryPoint["coverage"]): string {
	if (coverage === "covered") return chalk.green("✓");
	if (coverage === "untracked") return chalk.yellow("~");
	return chalk.red("✗");
}

function coverageBadge(coverage: SurfaceEntryPoint["coverage"]): string {
	if (coverage === "covered") return chalk.green("[covered]");
	if (coverage === "untracked") return chalk.yellow("[untracked]");
	return chalk.red("[untested]");
}
