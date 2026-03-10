/**
 * surface init — Initialize Surface Protocol in a project
 *
 * Creates surfaceprotocol.settings.json, empty surface.json, SURFACE.md,
 * and the .surface/ state directory.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { getAdapterNames } from "../lib/adapters/index.js";
import { configExists } from "../lib/config.js";
import { formatJson } from "../lib/formatters.js";
import type { SurfaceMap } from "../lib/types.js";

const EMPTY_SURFACE_MAP: SurfaceMap = {
	generated: new Date(0).toISOString(),
	version: "2.0",
	stats: {
		total: 0,
		by_type: {
			unit: 0,
			regression: 0,
			functional: 0,
			e2e: 0,
			contract: 0,
			performance: 0,
			security: 0,
			smoke: 0,
		},
		by_area: {},
		by_tag: {},
		coverage: {
			with_metadata: 0,
			without_metadata: 0,
		},
	},
	requirements: [],
	regressions: [],
	flows: [],
	contracts: [],
	smoke: [],
	placeholders: [],
	gaps: [],
};

const CLAUDE_SNIPPET = `## Surface Protocol

When \`surfaceprotocol.settings.json\` exists in the project root, route feature requests
through \`/surface:capture\` and bug reports through \`/surface:problem\`.

Generated files (\`surface.json\`, \`SURFACE.md\`, \`docs/features/\`) are never edited manually.
Run \`surface gen\` to regenerate them from test metadata.

Commit messages include \`Affects: REQ-XXX\` and \`Surface-Protocol:\` trailers when requirements
are touched. Valid trailer values: \`capture\`, \`implement\`, \`ship\`, \`quickfix\`, \`problem\`, \`learn\`, \`reconcile\`.
`;

function buildDefaultConfig(adapter: string) {
	return {
		adapter,
		output: {
			surfaceJson: "surface.json",
			surfaceMd: "SURFACE.md",
			featureDocs: "docs/features",
		},
	};
}

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Initialize Surface Protocol in a project")
		.option("--dir <path>", "Project directory", ".")
		.option(
			"--adapter <adapter>",
			`Stack adapter (${getAdapterNames().join(", ")})`,
			"typescript-vitest",
		)
		.action(async (options: { dir: string; adapter: string }) => {
			const cwd = resolve(options.dir);
			const adapterNames = getAdapterNames();

			if (!adapterNames.includes(options.adapter)) {
				console.error(
					chalk.red(`Unknown adapter: ${options.adapter}. Available: ${adapterNames.join(", ")}`),
				);
				process.exit(1);
			}

			if (await configExists(cwd)) {
				console.error(chalk.yellow("Surface Protocol is already initialized in this directory."));
				process.exit(1);
			}

			// Create directories
			await mkdir(join(cwd, ".surface", "state"), { recursive: true });
			await mkdir(join(cwd, ".surface", "sources"), { recursive: true });
			await mkdir(join(cwd, ".surface", "learnings"), { recursive: true });

			// Write config
			const config = buildDefaultConfig(options.adapter);
			await writeFile(join(cwd, "surfaceprotocol.settings.json"), formatJson(config), "utf-8");

			// Write empty surface map
			await writeFile(join(cwd, "surface.json"), formatJson(EMPTY_SURFACE_MAP), "utf-8");

			// Write SURFACE.md
			await writeFile(
				join(cwd, "SURFACE.md"),
				"# Surface Map\n\nNo requirements captured yet. Run `surface gen` after adding test metadata.\n",
				"utf-8",
			);

			// Write CLAUDE.md only if it doesn't exist
			const claudeMdPath = join(cwd, "CLAUDE.md");
			if (!existsSync(claudeMdPath)) {
				await writeFile(claudeMdPath, CLAUDE_SNIPPET, "utf-8");
			}

			console.log(chalk.green(`Initialized Surface Protocol in ${cwd}`));
			console.log();
			console.log("  Created:");
			console.log(
				`    ${chalk.cyan("surfaceprotocol.settings.json")}  — config (adapter: ${options.adapter})`,
			);
			console.log(`    ${chalk.cyan("surface.json")}                   — empty surface map`);
			console.log(`    ${chalk.cyan("SURFACE.md")}                     — human-readable view`);
			console.log(`    ${chalk.cyan(".surface/")}                      — state directory`);
			if (!existsSync(claudeMdPath)) {
				console.log(`    ${chalk.cyan("CLAUDE.md")}                      — routing stub`);
			}
			console.log();
			console.log("  Next steps:");
			console.log("    1. Add YAML frontmatter to your test files");
			console.log("    2. Run `surface gen` to generate the surface map");
			console.log("    3. Run `surface check` to validate coverage");
		});
}
