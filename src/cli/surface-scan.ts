/**
 * surface scan — Detect drift between test files and surface.json
 *
 * Shows:
 * - Untracked tests: it() blocks with no YAML metadata
 * - Ghost entries: requirements whose test files were deleted/renamed
 * - Status drift: tests whose implementation state changed since last gen
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/adapter.js";
import "../lib/adapters/index.js";
import { loadConfig } from "../lib/config.js";
import { buildDriftReport } from "../lib/drift.js";
import { formatJson } from "../lib/formatters.js";
import type { DriftReport, SurfaceMap } from "../lib/types.js";

export function registerScanCommand(program: Command): void {
	program
		.command("scan")
		.description(
			"Detect drift between test files and surface.json (untracked tests, ghost entries, status changes)",
		)
		.option("--json", "Output machine-readable DriftReport JSON")
		.option("--exit-code", "Exit 1 if any drift is detected (for CI gates)")
		.option("--untracked", "Show only untracked tests")
		.option("--ghosts", "Show only ghost entries (deleted/renamed files)")
		.option("--status-drift", "Show only implementation status drift")
		.option("--quiet", "Counts only, no details")
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

			const adapter = getAdapter(config.adapter);
			if (!adapter) {
				console.error(chalk.red(`Error: Unknown adapter "${config.adapter}"`));
				process.exit(2);
			}

			const report = await buildDriftReport(cwd, surfaceMap, adapter, config.testFilePatterns);

			if (options.json) {
				console.log(formatJson(report));
				if (options.exitCode && !report.summary.clean) process.exit(1);
				return;
			}

			const filterAll = !options.untracked && !options.ghosts && !options.statusDrift;

			printScanReport(report, {
				showUntracked: filterAll || options.untracked,
				showGhosts: filterAll || options.ghosts,
				showStatusDrift: filterAll || options.statusDrift,
				quiet: options.quiet,
			});

			if (options.exitCode && !report.summary.clean) process.exit(1);
		});
}

interface PrintOptions {
	showUntracked: boolean;
	showGhosts: boolean;
	showStatusDrift: boolean;
	quiet: boolean;
}

function printScanReport(report: DriftReport, opts: PrintOptions): void {
	const { summary } = report;

	if (summary.clean) {
		console.log(chalk.green("Surface is clean — no drift detected."));
		console.log(
			chalk.dim(
				`  ${summary.total_test_files} test files, ${summary.total_tracked} tracked requirements`,
			),
		);
		return;
	}

	console.log(chalk.bold("SURFACE DRIFT SCAN"));
	console.log(chalk.bold("=================="));
	console.log("");

	// Untracked tests
	if (opts.showUntracked && report.untracked.length > 0) {
		console.log(chalk.bold.yellow(`Untracked Tests (${report.untracked.length}):`));
		if (!opts.quiet) {
			const shown = report.untracked.slice(0, 20);
			for (const t of shown) {
				const label = t.describe ? `${t.describe} > ${t.it}` : (t.it ?? "unknown");
				console.log(chalk.yellow(`  ${t.file}:${t.line}  "${label}"`));
			}
			if (report.untracked.length > 20) {
				console.log(chalk.dim(`  ... and ${report.untracked.length - 20} more`));
			}
		}
		console.log("");
	}

	// Ghost entries
	if (opts.showGhosts && report.ghosts.length > 0) {
		console.log(chalk.bold.red(`Ghost Entries (${report.ghosts.length}):`));
		if (!opts.quiet) {
			for (const g of report.ghosts) {
				const reason =
					g.reason === "file-renamed" ? chalk.yellow("[renamed]") : chalk.red("[deleted]");
				console.log(`  ${chalk.bold(g.id)}  ${g.last_file}  ${reason}`);
			}
		}
		console.log("");
	}

	// Status drift
	if (opts.showStatusDrift && report.status_drift.length > 0) {
		console.log(chalk.bold.cyan(`Status Drift (${report.status_drift.length}):`));
		if (!opts.quiet) {
			for (const d of report.status_drift) {
				console.log(
					`  ${chalk.bold(d.id)}  ${d.file}  ${chalk.dim(d.recorded)} → ${chalk.green(d.actual)}`,
				);
			}
		}
		console.log("");
	}

	// Summary
	console.log(chalk.bold("Summary:"));
	if (report.untracked.length > 0) {
		console.log(chalk.yellow(`  ${report.untracked.length} untracked tests`));
	}
	if (report.ghosts.length > 0) {
		console.log(chalk.red(`  ${report.ghosts.length} ghost entries`));
	}
	if (report.status_drift.length > 0) {
		console.log(chalk.cyan(`  ${report.status_drift.length} status drift`));
	}

	console.log("");

	if (report.untracked.length > 0) {
		console.log(chalk.dim("→ Run `surface backfill` to annotate untracked tests."));
	}
	if (report.ghosts.length > 0) {
		console.log(chalk.dim("→ Run `surface gen` to prune ghost entries from surface.json."));
	}
	if (report.status_drift.length > 0) {
		console.log(chalk.dim("→ Run `surface gen` to refresh implementation status."));
	}
}
