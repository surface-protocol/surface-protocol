/**
 * surface query — Query Requirements
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { formatJson, formatRequirementsList } from "../lib/formatters.js";
import type { QueryResult, Requirement, SurfaceMap } from "../lib/types.js";

function getAllRequirements(surfaceMap: SurfaceMap): Requirement[] {
	return [
		...surfaceMap.requirements,
		...surfaceMap.regressions,
		...surfaceMap.flows,
		...surfaceMap.contracts,
	];
}

function buildQueryResult(requirements: Requirement[], dangerousTags: Set<string>): QueryResult {
	const dangerous = requirements.filter((r) => r.tags.some((t) => dangerousTags.has(t)));
	return {
		requirements,
		total: requirements.length,
		dangerous: dangerous.length > 0,
		dangerous_requirements: dangerous.map((r) => r.id),
	};
}

export function registerQueryCommand(program: Command): void {
	program
		.command("query")
		.description("Query requirements from surface.json")
		.option("--file <path>", "Requirements for a specific file")
		.option("--tag <tag>", "Filter by tag")
		.option("--type <type>", "Filter by test type")
		.option("--dangerous", "Show DANGEROUS requirements only")
		.option("--staged", "Only staged files")
		.option("--id <id>", "Get specific requirement by ID")
		.option("--json", "JSON output")
		.action(async (options) => {
			const cwd = process.cwd();
			const config = await loadConfig(cwd);
			const surfaceJsonPath = join(cwd, config.output.surfaceJson);
			const jsonOutput = options.json as boolean;
			const dangerousTags = new Set(config.tagCategories.dangerous);

			let surfaceMap: SurfaceMap;
			try {
				const content = await readFile(surfaceJsonPath, "utf-8");
				surfaceMap = JSON.parse(content) as SurfaceMap;
			} catch {
				console.error(chalk.red("Error: surface.json not found. Run `surface gen` first."));
				process.exit(1);
			}

			let requirements = getAllRequirements(surfaceMap);

			if (options.staged) {
				try {
					const output = execSync("git diff --cached --name-only", { encoding: "utf-8", cwd });
					const stagedFiles = output
						.split("\n")
						.filter(
							(f) => f.endsWith(".test.ts") || f.endsWith(".spec.ts") || f.endsWith("_spec.rb"),
						);
					if (stagedFiles.length === 0) {
						if (jsonOutput) console.log(formatJson(buildQueryResult([], dangerousTags)));
						else console.log("No staged test files.");
						return;
					}
					requirements = requirements.filter((r) =>
						stagedFiles.some((f) => r.location.file.includes(f)),
					);
				} catch {
					requirements = [];
				}
			}

			if (options.file) {
				const p = (options.file as string).replace(/^\.\//, "");
				requirements = requirements.filter(
					(r) => r.location.file.includes(p) || p.includes(r.location.file),
				);
			}
			if (options.tag) {
				requirements = requirements.filter((r) => r.tags.includes(options.tag as string));
			}
			if (options.type) {
				requirements = requirements.filter((r) => r.type === options.type);
			}
			if (options.dangerous) {
				requirements = requirements.filter((r) => r.tags.some((t) => dangerousTags.has(t)));
			}

			if (options.id) {
				const req = requirements.find((r) => r.id === options.id);
				if (req) {
					requirements = [req];
				} else {
					if (jsonOutput) console.log(formatJson({ error: `Requirement ${options.id} not found` }));
					else console.log(chalk.red(`Requirement ${options.id} not found.`));
					process.exit(1);
				}
			}

			const result = buildQueryResult(requirements, dangerousTags);
			if (jsonOutput) {
				console.log(formatJson(result));
				return;
			}
			if (requirements.length === 0) {
				console.log("No requirements found matching criteria.");
				return;
			}

			console.log(chalk.bold(`Found ${requirements.length} requirement(s):`));
			console.log("");
			if (result.dangerous) {
				console.log(
					chalk.red(
						`DANGEROUS: ${result.dangerous_requirements.length} requirement(s) have critical tags`,
					),
				);
				console.log("");
			}
			console.log(formatRequirementsList(requirements, { showLocation: true }));
		});
}
