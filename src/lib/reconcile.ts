/**
 * Source Reconciliation
 *
 * Checks for consistency between surface.json requirement sources
 * and the actual files in .surface/sources/.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SurfaceMap } from "./types.js";

export interface ReconcileResult {
	/** Source refs referenced in requirements but missing from .surface/sources/ */
	missing_sources: string[];
	/** Files in .surface/sources/ not referenced by any requirement */
	stale_sources: string[];
}

/**
 * Walk a directory tree and collect all file paths relative to the root.
 */
async function walkDir(root: string): Promise<string[]> {
	const results: string[] = [];

	async function walk(current: string): Promise<void> {
		try {
			const entries = await readdir(current, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(current, entry.name);
				if (entry.isDirectory()) {
					await walk(fullPath);
				} else {
					results.push(relative(root, fullPath));
				}
			}
		} catch {
			// Directory doesn't exist — nothing to walk
		}
	}

	await walk(root);
	return results;
}

/**
 * Reconcile source references in the surface map against actual source files.
 *
 * - `missing_sources`: refs in requirements that don't have a corresponding file
 * - `stale_sources`: files in .surface/sources/ that no requirement references
 */
export async function reconcileSources(
	dir: string,
	surfaceMap: SurfaceMap,
): Promise<ReconcileResult> {
	const sourceRefs = new Set(
		[
			...surfaceMap.requirements,
			...surfaceMap.regressions,
			...surfaceMap.flows,
			...surfaceMap.contracts,
		]
			.map((req) => req.source?.ref)
			.filter(Boolean) as string[],
	);

	const sourceRoot = join(dir, ".surface/sources");
	const existingSources = await walkDir(sourceRoot);

	const missing_sources: string[] = [];
	for (const ref of sourceRefs) {
		try {
			await readFile(join(sourceRoot, ref), "utf-8");
		} catch {
			missing_sources.push(ref);
		}
	}

	const stale_sources = existingSources.filter((path) => !sourceRefs.has(path));

	return { missing_sources, stale_sources };
}
