/**
 * Discovery Adapter Interface
 *
 * Discovery adapters scan implementation code (not test files) to find
 * customer-facing entry points: API routes, web pages, CLI commands, scripts, etc.
 */

import type { RawEntryPoint } from "../types.js";

// =============================================================================
// Discovery Adapter Interface
// =============================================================================

export interface DiscoveryAdapter {
	/** Unique identifier */
	name: string;
	/** Human-readable description */
	description: string;
	/** Detect whether this adapter applies to the given project */
	detect(dir: string): Promise<boolean>;
	/** Find all entry points in the project */
	discover(dir: string): Promise<RawEntryPoint[]>;
}

// =============================================================================
// Registry
// =============================================================================

const registry: DiscoveryAdapter[] = [];

export function registerDiscoveryAdapter(adapter: DiscoveryAdapter): void {
	registry.push(adapter);
}

export function getAllDiscoveryAdapters(): DiscoveryAdapter[] {
	return [...registry];
}

/**
 * Auto-detect which discovery adapters apply to the given project.
 */
export async function autoDetectAdapters(dir: string): Promise<DiscoveryAdapter[]> {
	const results: DiscoveryAdapter[] = [];
	for (const adapter of registry) {
		try {
			if (await adapter.detect(dir)) results.push(adapter);
		} catch {
			// Detection failure means adapter doesn't apply
		}
	}
	return results;
}
