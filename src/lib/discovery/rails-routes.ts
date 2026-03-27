/**
 * Rails Routes Discovery Adapter
 *
 * Parses config/routes.rb to find HTTP routes exposed by a Rails application.
 * Supports: resources, resource, get, post, put, patch, delete
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RawEntryPoint } from "../types.js";
import { registerDiscoveryAdapter } from "./adapter.js";
import type { DiscoveryAdapter } from "./adapter.js";

async function detect(dir: string): Promise<boolean> {
	try {
		await readFile(join(dir, "config/routes.rb"), "utf-8");
		return true;
	} catch {
		return false;
	}
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];

	let routesContent: string;
	try {
		routesContent = await readFile(join(dir, "config/routes.rb"), "utf-8");
	} catch {
		return [];
	}

	// Parse explicit verb routes: get '/path', post '/path', etc.
	const verbPattern = /^\s*(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gm;
	for (const match of routesContent.matchAll(verbPattern)) {
		const method = (match[1] ?? "GET").toUpperCase();
		const path = match[2] ?? "/";
		const beforeMatch = routesContent.slice(0, match.index ?? 0);
		const line = beforeMatch.split("\n").length;
		entryPoints.push({
			type: "api",
			method,
			path,
			file: "config/routes.rb",
			line,
			label: `${method} ${path}`,
		});
	}

	// Parse resources :name (generates standard REST routes)
	const resourcesPattern = /^\s*resources?\s+:(\w+)/gm;
	for (const match of routesContent.matchAll(resourcesPattern)) {
		const resource = match[1] ?? "resource";
		const plural = resource.endsWith("s") ? resource : `${resource}s`;
		const beforeMatch = routesContent.slice(0, match.index ?? 0);
		const line = beforeMatch.split("\n").length;

		const restRoutes: Array<{ method: string; path: string }> = [
			{ method: "GET", path: `/${plural}` },
			{ method: "POST", path: `/${plural}` },
			{ method: "GET", path: `/${plural}/:id` },
			{ method: "PUT", path: `/${plural}/:id` },
			{ method: "PATCH", path: `/${plural}/:id` },
			{ method: "DELETE", path: `/${plural}/:id` },
		];

		for (const route of restRoutes) {
			entryPoints.push({
				type: "api",
				method: route.method,
				path: route.path,
				file: "config/routes.rb",
				line,
				label: `${route.method} ${route.path} (resources :${resource})`,
			});
		}
	}

	return entryPoints;
}

const railsRoutesAdapter: DiscoveryAdapter = {
	name: "rails-routes",
	description: "Discovers HTTP routes from Rails config/routes.rb",
	detect,
	discover,
};

registerDiscoveryAdapter(railsRoutesAdapter);
export { railsRoutesAdapter };
