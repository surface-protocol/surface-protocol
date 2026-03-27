/**
 * GraphQL Schema Discovery Adapter
 *
 * Finds customer-facing GraphQL operations from schema files (*.graphql, *.gql).
 * Discovers: type Query { ... }, type Mutation { ... }, type Subscription { ... }
 */

import { readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { findTestFiles } from "../parser.js";
import type { RawEntryPoint } from "../types.js";
import { registerDiscoveryAdapter } from "./adapter.js";
import type { DiscoveryAdapter } from "./adapter.js";

// Matches: type Query { or type Mutation { or type Subscription {
const ROOT_TYPE_PATTERN = /type\s+(Query|Mutation|Subscription)\s*\{([^}]*)\}/gs;
// Matches individual field definitions: fieldName(args): ReturnType
const FIELD_PATTERN = /^\s+(\w+)\s*(?:\([^)]*\))?\s*:/gm;

async function detect(dir: string): Promise<boolean> {
	// Look for .graphql or .gql files, or graphql in dependencies
	try {
		const raw = await readFile(join(dir, "package.json"), "utf-8");
		const pkg = JSON.parse(raw) as Record<string, unknown>;
		const deps = {
			...((pkg.dependencies as Record<string, string>) ?? {}),
			...((pkg.devDependencies as Record<string, string>) ?? {}),
		};
		if ("graphql" in deps || "@apollo/server" in deps || "pothos-graphql" in deps) return true;
	} catch {
		// No package.json
	}

	// Check for .graphql files
	const graphqlFiles = findTestFiles(dir, ["**/*.graphql", "**/*.gql"]);
	return graphqlFiles.length > 0;
}

async function discover(dir: string): Promise<RawEntryPoint[]> {
	const entryPoints: RawEntryPoint[] = [];
	const schemaFiles = findTestFiles(dir, ["**/*.graphql", "**/*.gql"]);

	for (const absFile of schemaFiles) {
		if (absFile.includes("node_modules")) continue;

		let content: string;
		try {
			content = await readFile(absFile, "utf-8");
		} catch {
			continue;
		}

		const relFile = relative(dir, absFile);

		for (const typeMatch of content.matchAll(ROOT_TYPE_PATTERN)) {
			const typeName = typeMatch[1] ?? "Query"; // Query | Mutation | Subscription
			const typeBody = typeMatch[2] ?? "";
			const typeStart = content.indexOf(typeMatch[0]);
			const beforeType = content.slice(0, typeStart);
			const typeLine = beforeType.split("\n").length;

			for (const fieldMatch of typeBody.matchAll(FIELD_PATTERN)) {
				const fieldName = fieldMatch[1] ?? "field";
				const beforeField = typeBody.slice(0, fieldMatch.index ?? 0);
				const fieldLine = typeLine + beforeField.split("\n").length;

				entryPoints.push({
					type: "graphql",
					method: typeName, // "Query" | "Mutation" | "Subscription"
					path: fieldName,
					file: relFile,
					line: fieldLine,
					label: `${typeName}.${fieldName}`,
				});
			}
		}
	}

	return entryPoints;
}

const graphqlSchemaAdapter: DiscoveryAdapter = {
	name: "graphql-schema",
	description: "Discovers GraphQL queries, mutations, and subscriptions from schema files",
	detect,
	discover,
};

registerDiscoveryAdapter(graphqlSchemaAdapter);
export { graphqlSchemaAdapter };
