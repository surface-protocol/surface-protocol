/**
 * surface backfill — Auto-annotate untracked tests with inferred YAML metadata
 *
 * Injects YAML frontmatter into test files that lack it.
 * After injection, runs `surface gen` to regenerate surface.json.
 *
 * Used to bootstrap a known-good surface from an existing codebase.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/adapter.js";
import "../lib/adapters/index.js";
import { spawnSync } from "node:child_process";
import { backfillFile, idPrefixForType, inferArea, inferTestType } from "../lib/backfill.js";
import { loadConfig } from "../lib/config.js";
import { buildDriftReport } from "../lib/drift.js";
import { formatJson } from "../lib/formatters.js";
import { allocateRequirementIds } from "../lib/ingest.js";
import type { SurfaceMap, UntrackedTest } from "../lib/types.js";

export function registerBackfillCommand(program: Command): void {
	program
		.command("backfill")
		.description(
			"Auto-annotate untracked tests with inferred YAML metadata (bootstrap existing codebases)",
		)
		.option("--all", "Backfill all untracked tests")
		.option("--file <path>", "Backfill only this specific test file")
		.option("--dry-run", "Preview what would be injected without writing")
		.option("--yes", "Skip confirmation prompt")
		.option("--no-gen", "Skip running `surface gen` after backfill")
		.option("--json", "JSON output (implies --yes)")
		.option("--type <type>", "Override inferred test type for all backfills")
		.option("--area <area>", "Override inferred area for all backfills")
		.action(async (options) => {
			const cwd = process.cwd();
			const isCI = Boolean(process.env.CI);

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

			// Find all untracked tests
			const report = await buildDriftReport(cwd, surfaceMap, adapter, config.testFilePatterns);

			if (report.untracked.length === 0) {
				console.log(chalk.green("No untracked tests found. Surface is clean."));
				return;
			}

			// Filter candidates
			let untracked = report.untracked;
			if (options.file) {
				untracked = untracked.filter(
					(t) => t.file === options.file || t.file.endsWith(options.file),
				);
				if (untracked.length === 0) {
					console.log(chalk.yellow(`No untracked tests found in "${options.file}".`));
					return;
				}
			}

			// If no filter flags, show the list and guide user
			if (!options.all && !options.file) {
				printUntrackedList(untracked);
				console.log("");
				console.log("To backfill:");
				console.log(`${chalk.cyan("  surface backfill --all              ")}  annotate all`);
				console.log(`${chalk.cyan("  surface backfill --file <path>      ")}  annotate one file`);
				console.log(`${chalk.cyan("  surface backfill --all --dry-run    ")}  preview only`);
				return;
			}

			// Group by file
			const byFile = new Map<string, UntrackedTest[]>();
			for (const t of untracked) {
				const existing = byFile.get(t.file) ?? [];
				existing.push(t);
				byFile.set(t.file, existing);
			}

			if (options.dryRun) {
				printDryRunPreview(untracked, config, adapter, options);
				return;
			}

			// Confirm
			const skipConfirm = options.yes || isCI || options.json;
			if (!skipConfirm) {
				const confirmed = await confirm(
					`Inject YAML into ${untracked.length} tests across ${byFile.size} files? [y/N] `,
				);
				if (!confirmed) {
					console.log(chalk.dim("Cancelled."));
					return;
				}
			} else if (isCI && !options.yes) {
				console.log(chalk.dim("CI environment detected — skipping confirmation."));
			}

			// Allocate all IDs up front (atomic batch)
			const idsByFile = new Map<string, string[]>();
			for (const [file, tests] of byFile) {
				const inferredType = options.type ?? inferTestType(file, adapter);
				const prefix = idPrefixForType(inferredType as never, config);
				const ids = await allocateRequirementIds(cwd, prefix, tests.length);
				idsByFile.set(file, ids);
			}

			// Backfill each file
			const allResults = [];
			for (const [file, tests] of byFile) {
				const ids = idsByFile.get(file) ?? [];
				const result = await backfillFile(cwd, { file, untracked: tests }, adapter, config, ids);
				allResults.push(result);
			}

			if (options.json) {
				console.log(formatJson({ backfilled: allResults }));
			} else {
				printBackfillResults(allResults);
			}

			// Run surface gen unless --no-gen
			if (options.gen !== false) {
				console.log(chalk.dim("\nRunning `surface gen` to update surface.json..."));
				const genResult = spawnSync(process.execPath, [process.argv[1] ?? "surface", "gen"], {
					cwd,
					stdio: "inherit",
				});
				if (genResult.status !== 0) {
					console.log(chalk.yellow("Warning: `surface gen` exited with an error."));
				}
			}
		});
}

function printUntrackedList(tests: UntrackedTest[]): void {
	console.log(chalk.bold(`Found ${tests.length} untracked tests:`));
	console.log("");
	const byFile = new Map<string, UntrackedTest[]>();
	for (const t of tests) {
		const arr = byFile.get(t.file) ?? [];
		arr.push(t);
		byFile.set(t.file, arr);
	}
	for (const [file, fileTests] of byFile) {
		console.log(chalk.cyan(`  ${file}`) + chalk.dim(` (${fileTests.length} untracked)`));
		for (const t of fileTests.slice(0, 5)) {
			const label = t.describe ? `${t.describe} > ${t.it}` : (t.it ?? "?");
			console.log(chalk.dim(`    :${t.line}  "${label}"`));
		}
		if (fileTests.length > 5) console.log(chalk.dim(`    ... and ${fileTests.length - 5} more`));
	}
}

function printDryRunPreview(
	tests: UntrackedTest[],
	config: import("../lib/config.js").SurfaceConfig,
	adapter: import("../lib/adapters/adapter.js").StackAdapter,
	options: Record<string, unknown>,
): void {
	console.log(chalk.bold("DRY RUN — no files will be modified"));
	console.log("");
	console.log(
		`Would annotate ${tests.length} tests across ${new Set(tests.map((t) => t.file)).size} files:`,
	);
	console.log("");
	for (const t of tests.slice(0, 30)) {
		const type = (options.type as string) ?? inferTestType(t.file, adapter);
		const area = (options.area as string) ?? inferArea(t.file, config.areas);
		const label = t.it ?? "untracked test";
		console.log(
			`  ${chalk.dim(`${t.file}:${t.line}`)}  ${chalk.cyan(type)}/${chalk.green(area)}  "${label}"`,
		);
	}
	if (tests.length > 30) console.log(chalk.dim(`  ... and ${tests.length - 30} more`));
	console.log("");
	console.log(chalk.dim("Remove --dry-run to write."));
}

function printBackfillResults(results: import("../lib/backfill.js").BackfillResult[]): void {
	const totalInjected = results.reduce((sum, r) => sum + r.injected.length, 0);
	const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

	console.log(chalk.green(`\nBackfilled ${totalInjected} tests across ${results.length} files:`));
	for (const r of results) {
		if (r.injected.length > 0) {
			const ids = r.injected.map((i) => i.id).join(", ");
			console.log(`  ${chalk.cyan(r.file)}  +${r.injected.length} annotations (${ids})`);
		}
	}
	if (totalErrors > 0) {
		console.log(chalk.red(`\nErrors (${totalErrors}):`));
		for (const r of results) {
			for (const err of r.errors) {
				console.log(chalk.red(`  ${r.file}: ${err}`));
			}
		}
	}
	console.log(
		chalk.dim("\nNote: Annotations are drafts — review summaries, areas, and acceptance criteria."),
	);
}

async function confirm(prompt: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(prompt, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y");
		});
	});
}
