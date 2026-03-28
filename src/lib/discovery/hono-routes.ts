/**
 * Hono Routes Discovery Adapter
 *
 * Finds HTTP route handlers defined with Hono's routing API:
 *   app.get('/path', handler)
 *   app.post('/path', handler)
 *   router.put('/path', handler)
 *   etc.
 */

import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFileNoThrow } from "../../utils/execFileNoThrow.js";
import type { RawEntryPoint } from "../types.js";
import type { DiscoveryAdapter } from "./adapter.js";
import { registerDiscoveryAdapter } from "./adapter.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "all"];

// Matches: app.get('/path', ...) or router.post('/api/path', ...)
const ROUTE_PATTERN = new RegExp(
	`(?:app|router|server|api|hono)\\s*\\.\\s*(${HTTP_METHODS.join("|")})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
	"gi",
);

async function detect(dir: string): Promise<boolean> {
	try {
		const raw = await readFile(join(dir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const deps = {
			...((pkg.dependencies as Record<string, string>) ?? {}),
			...((pkg.devDependencies as Record<string, string>) ?? {}),
		};
		return "hono" in deps;
	} catch {
		return false;
	}
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];
	const sourceFiles = await findSourceFiles(dir);

	for (const absFile of sourceFiles) {
		if (
			absFile.includes("node_modules") ||
			absFile.includes(".test.") ||
			absFile.includes(".spec.") ||
			absFile.includes("__tests__")
		)
			continue;

		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}

		if (!content.includes("hono") && !content.includes(".get(") && !content.includes(".post("))
			continue;

		const relFile = relative(dir, absFile);

		ROUTE_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null;

		// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
		while ((match = ROUTE_PATTERN.exec(content)) !== null) {
			const method = (match[1] ?? "GET").toUpperCase();
			const path = match[2] ?? "/";
			const beforeMatch = content.slice(0, match.index);
			const line = beforeMatch.split("\n").length;

			entryPoints.push({
				type: "api",
				method,
				path,
				file: relFile,
				line,
				label: `${method} ${path}`,
			});
		}
	}

	return deduplicateEntryPoints(entryPoints);
}

async function findSourceFiles(dir: string): Promise<string[]> {
	const extensions = ["*.ts", "*.tsx", "*.js", "*.jsx"];
	const result = await execFileNoThrow(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", ...extensions],
		dir,
	);
	if (result.status !== 0) return [];
	return result.stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((f) => join(dir, f));
}

function deduplicateEntryPoints(points: RawEntryPoint[]): RawEntryPoint[] {
	const seen = new Set<string>();
	return points.filter((p) => {
		const key = `${p.method}:${p.path}:${p.file}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

const honoRoutesAdapter: DiscoveryAdapter = {
	name: "hono-routes",
	description: "Discovers HTTP route handlers in Hono applications",
	detect,
	discover,
};

registerDiscoveryAdapter(honoRoutesAdapter);
export { honoRoutesAdapter };
