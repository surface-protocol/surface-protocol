/**
 * Commander CLI Discovery Adapter
 *
 * Finds CLI commands defined with Commander.js:
 *   program.command('name')
 *   program.command('name <arg>')
 */

import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { findTestFiles } from "../parser.js";
import type { RawEntryPoint } from "../types.js";
import { registerDiscoveryAdapter } from "./adapter.js";
import type { DiscoveryAdapter } from "./adapter.js";

// Matches: program.command('name') or .command("name <arg>")
const COMMAND_PATTERN = /\.command\s*\(\s*['"`]([^'"`]+)['"`]/g;
// Matches: .description('text') for labeling
const DESCRIPTION_PATTERN = /\.description\s*\(\s*['"`]([^'"`]+)['"`]/;

async function detect(dir: string): Promise<boolean> {
	try {
		const raw = await readFile(join(dir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const deps = {
			...((pkg.dependencies as Record<string, string>) ?? {}),
			...((pkg.devDependencies as Record<string, string>) ?? {}),
		};
		return "commander" in deps;
	} catch {
		return false;
	}
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];
	// Reuse findTestFiles with ts/js patterns (it handles both git and fallback)
	const sourceFiles = findTestFiles(dir, ["**/*.ts", "**/*.js"]);

	for (const absFile of sourceFiles) {
		if (
			absFile.includes("node_modules") ||
			absFile.includes(".test.") ||
			absFile.includes(".spec.")
		)
			continue;

		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}

		if (!content.includes("commander") && !content.includes(".command(")) continue;

		const relFile = relative(dir, absFile);
		COMMAND_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
		while ((match = COMMAND_PATTERN.exec(content)) !== null) {
			const commandName = match[1] ?? "";
			const beforeMatch = content.slice(0, match.index);
			const line = beforeMatch.split("\n").length;

			// Try to find the description in the next ~300 chars
			const afterMatch = content.slice(
				match.index + match[0].length,
				match.index + match[0].length + 300,
			);
			const descMatch = DESCRIPTION_PATTERN.exec(afterMatch);
			const label = descMatch?.[1] ? `${commandName} — ${descMatch[1]}` : commandName;

			entryPoints.push({ type: "cli", path: commandName, file: relFile, line, label });
		}
	}

	return entryPoints;
}

const commanderCliAdapter: DiscoveryAdapter = {
	name: "commander-cli",
	description: "Discovers CLI commands defined with Commander.js",
	detect,
	discover,
};

registerDiscoveryAdapter(commanderCliAdapter);
export { commanderCliAdapter };
