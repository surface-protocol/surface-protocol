/**
 * Package Scripts Discovery Adapter
 *
 * Reads scripts from package.json (or Gemfile for Ruby projects).
 * Always applicable when package.json exists.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RawEntryPoint } from "../types.js";
import type { DiscoveryAdapter } from "./adapter.js";
import { registerDiscoveryAdapter } from "./adapter.js";

async function detect(dir: string): Promise<boolean> {
	try {
		await readFile(join(dir, "package.json"), "utf-8");
		return true;
	} catch {
		return false;
	}
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];

	try {
		const raw = await readFile(join(dir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const scripts = pkg.scripts as Record<string, string> | undefined;
		if (!scripts) return [];

		let line = 1;
		// Find line numbers by scanning raw content
		const pkgLines = raw.split("\n");
		const scriptsStart = pkgLines.findIndex((l) => l.includes('"scripts"'));

		for (const [name, command] of Object.entries(scripts)) {
			// Find the line for this script
			const scriptLine = pkgLines.findIndex((l, i) => i > scriptsStart && l.includes(`"${name}"`));
			line = scriptLine >= 0 ? scriptLine + 1 : scriptsStart + 1;

			entryPoints.push({
				type: "script",
				path: name,
				file: "package.json",
				line,
				label: `${name}: ${command}`,
			});
		}
	} catch {
		// No package.json or parse error
	}

	return entryPoints;
}

const packageScriptsAdapter: DiscoveryAdapter = {
	name: "package-scripts",
	description: "Discovers scripts defined in package.json",
	detect,
	discover,
};

registerDiscoveryAdapter(packageScriptsAdapter);

export { packageScriptsAdapter };
