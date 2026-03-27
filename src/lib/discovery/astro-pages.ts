/**
 * Astro Pages Discovery Adapter
 *
 * Discovers web page routes from Astro's file-based routing system.
 * File paths in src/pages/ directly map to URL routes.
 */

import { readdir, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { readFile } from "node:fs/promises";
import type { RawEntryPoint } from "../types.js";
import { registerDiscoveryAdapter } from "./adapter.js";
import type { DiscoveryAdapter } from "./adapter.js";

async function detect(dir: string): Promise<boolean> {
	// Detect Astro: astro in deps OR src/pages/ directory exists
	try {
		const raw = await readFile(join(dir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const deps = {
			...((pkg.dependencies as Record<string, string>) ?? {}),
			...((pkg.devDependencies as Record<string, string>) ?? {}),
		};
		if ("astro" in deps) return true;
	} catch {
		// No package.json — check for pages dir
	}

	try {
		await stat(join(dir, "src/pages"));
		return true;
	} catch {
		return false;
	}
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];
	const pagesDir = join(dir, "src/pages");

	try {
		await stat(pagesDir);
	} catch {
		return []; // No pages directory
	}

	const files = await walkDir(pagesDir);

	for (const absFile of files) {
		const ext = extname(absFile);
		if (![".astro", ".ts", ".js", ".tsx", ".jsx", ".md", ".mdx"].includes(ext)) continue;

		const relToPages = relative(pagesDir, absFile);
		const urlPath = filePathToUrlPath(relToPages);
		const relFile = relative(dir, absFile);

		entryPoints.push({
			type: "page",
			path: urlPath,
			file: relFile,
			line: 1,
			label: urlPath,
		});
	}

	return entryPoints;
}

/**
 * Convert a file path (relative to pages/) to a URL path.
 * Examples:
 *   index.astro          → /
 *   about.astro          → /about
 *   blog/[slug].astro    → /blog/[slug]
 *   api/users.ts         → /api/users
 */
function filePathToUrlPath(relPath: string): string {
	const normalized = relPath.replace(/\\/g, "/");
	// Remove extension
	const withoutExt = normalized.replace(/\.[^.]+$/, "");
	// Replace /index with nothing (index routes)
	const withoutIndex = withoutExt.replace(/\/index$/, "").replace(/^index$/, "");
	// Prefix with /
	const urlPath = `/${withoutIndex}`;
	return urlPath === "/" ? "/" : urlPath;
}

async function walkDir(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await walkDir(full)));
			} else {
				files.push(full);
			}
		}
	} catch {
		// Directory not accessible
	}
	return files;
}

const astroPagesAdapter: DiscoveryAdapter = {
	name: "astro-pages",
	description: "Discovers page routes from Astro's file-based routing (src/pages/)",
	detect,
	discover,
};

registerDiscoveryAdapter(astroPagesAdapter);
export { astroPagesAdapter };
