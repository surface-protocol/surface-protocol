/**
 * Surface Protocol Configuration
 *
 * Loads and validates surfaceprotocol.settings.json from the target repo.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

// =============================================================================
// Config Schema
// =============================================================================

export const SurfaceConfigSchema = z.object({
	/** Which stack adapter to use */
	adapter: z.string().default("typescript-vitest"),

	/** Glob patterns for discovering test files (overrides adapter defaults) */
	testFilePatterns: z.array(z.string()).optional(),

	/** ID prefix configuration */
	idPrefixes: z
		.object({
			requirement: z.string().default("REQ"),
			flow: z.string().default("FLOW"),
			contract: z.string().default("CONTRACT"),
			smoke: z.string().default("SMOKE"),
			regression: z.string().default("REGR"),
		})
		.default({}),

	/** Output file paths */
	output: z
		.object({
			surfaceJson: z.string().default("surface.json"),
			surfaceMd: z.string().default("SURFACE.md"),
			featureDocs: z.string().default("docs/features"),
		})
		.default({}),

	/** Area definitions for grouping requirements */
	areas: z.record(z.string(), z.unknown()).default({}),

	/** Tag categories for classification */
	tagCategories: z
		.object({
			dangerous: z.array(z.string()).default(["critical", "compliance", "security", "blocking"]),
			audience: z.array(z.string()).default(["user-facing", "admin-facing", "backend"]),
		})
		.default({}),

	/** Commit message conventions */
	commitConventions: z
		.object({
			specPrefix: z.string().default("spec"),
			implPrefix: z.string().default("feat"),
			requireAffects: z.boolean().default(true),
			trailerValues: z
				.array(z.string())
				.default(["capture", "implement", "ship", "quickfix", "problem", "learn", "reconcile"]),
		})
		.default({}),

	/** Implicit detection settings (for Claude Code plugin) */
	implicitDetection: z
		.object({
			enabled: z.boolean().default(true),
			requireConfirmation: z.boolean().default(true),
		})
		.optional(),
});

export type SurfaceConfig = z.infer<typeof SurfaceConfigSchema>;

// =============================================================================
// Config Loading
// =============================================================================

const CONFIG_FILENAME = "surfaceprotocol.settings.json";

/**
 * Load Surface Protocol config from the target repo.
 * Returns default config if no config file exists.
 */
export async function loadConfig(projectDir: string): Promise<SurfaceConfig> {
	const configPath = join(projectDir, CONFIG_FILENAME);

	try {
		const content = await readFile(configPath, "utf-8");
		const raw = JSON.parse(content);
		return SurfaceConfigSchema.parse(raw);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") {
			// No config file — return defaults
			return SurfaceConfigSchema.parse({});
		}
		throw error;
	}
}

/**
 * Check if a Surface Protocol config exists in the given directory.
 */
export async function configExists(projectDir: string): Promise<boolean> {
	const configPath = join(projectDir, CONFIG_FILENAME);
	try {
		await readFile(configPath);
		return true;
	} catch {
		return false;
	}
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
