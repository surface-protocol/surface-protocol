/**
 * surface badge — Generate badge assets and markdown snippets
 *
 * Writes surface-badge.json (shields.io endpoint format) and prints
 * copy-pasteable badge markdown for READMEs.
 */

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import {
	allBadgeSnippets,
	buildBadgeEndpoint,
	customBadgeMarkdown,
	endpointBadgeMarkdown,
	shieldsBadgeMarkdown,
} from "../lib/badge.js";
import { loadConfig } from "../lib/config.js";
import { formatJson } from "../lib/formatters.js";
import type { SurfaceMap } from "../lib/types.js";
import { writeIfContentChanged } from "../lib/write-if-changed.js";

function detectGitHubRemote(cwd: string): { owner: string; repo: string } | null {
	try {
		const remote = execFileSync("git", ["remote", "get-url", "origin"], {
			cwd,
			encoding: "utf-8",
		}).trim();
		// Match SSH or HTTPS GitHub URLs
		const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
		if (match?.[1] && match[2]) return { owner: match[1], repo: match[2] };
	} catch {
		// Not a git repo or no remote
	}
	return null;
}

export function registerBadgeCommand(program: Command): void {
	program
		.command("badge")
		.description("Generate badge JSON and markdown snippets")
		.option("-o, --output <dir>", "Output directory", ".")
		.option("-s, --snippet", "Print all badge markdown snippets")
		.option("-f, --format <format>", "Print specific format: shields, custom, endpoint")
		.action(async (options) => {
			const cwd = process.cwd();
			const config = await loadConfig(cwd);
			const outputDir = resolve(cwd, options.output as string);
			const remote = detectGitHubRemote(cwd);

			if (options.snippet) {
				console.log(allBadgeSnippets(remote?.owner, remote?.repo));
				return;
			}

			if (options.format) {
				const format = options.format as string;
				switch (format) {
					case "shields":
						console.log(shieldsBadgeMarkdown());
						return;
					case "custom":
						console.log(customBadgeMarkdown());
						return;
					case "endpoint":
						if (!remote) {
							console.error(
								chalk.yellow(
									"Could not detect GitHub remote. Use --format shields or --format custom instead.",
								),
							);
							process.exit(1);
						}
						console.log(endpointBadgeMarkdown(remote.owner, remote.repo));
						return;
					default:
						console.error(
							chalk.red(`Unknown format: ${format}. Use shields, custom, or endpoint.`),
						);
						process.exit(1);
				}
			}

			// Default: generate surface-badge.json
			const surfaceJsonName = config.output.surfaceJson;
			const surfaceJsonPath = join(outputDir, surfaceJsonName);

			try {
				const content = await readFile(surfaceJsonPath, "utf-8");
				const surfaceMap = JSON.parse(content) as SurfaceMap;
				const endpoint = buildBadgeEndpoint(surfaceMap.stats);
				const badgePath = join(outputDir, "surface-badge.json");

				await writeIfContentChanged(badgePath, `${formatJson(endpoint)}\n`);

				console.log(chalk.green("Generated:"));
				console.log(`  ${badgePath}`);
				console.log();
				console.log(`Coverage: ${endpoint.message} (${endpoint.color})`);
				console.log();
				console.log(chalk.dim("Tip: run `surface badge --snippet` for README markdown"));
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					console.error(
						chalk.red(
							`${surfaceJsonName} not found. Run \`surface gen\` first, then \`surface badge\`.`,
						),
					);
					process.exit(1);
				}
				throw error;
			}
		});
}
