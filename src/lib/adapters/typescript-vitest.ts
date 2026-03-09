/**
 * TypeScript + Vitest/Playwright Adapter
 *
 * Handles TypeScript test files using Vitest (unit/functional) and
 * Playwright (e2e). This is the original adapter — the one Surface
 * Protocol was built on.
 */

import { stringify } from "yaml";
import { JS_BLOCK } from "../comment-formats.js";
import type { StubRenderInput, TestMetadata } from "../types.js";
import type { StackAdapter } from "./adapter.js";
import { registerAdapter } from "./adapter.js";

// =============================================================================
// Stub Template
// =============================================================================

function generateStub(metadata: TestMetadata): string {
	const lines: string[] = [];

	// YAML frontmatter
	lines.push("/*---");
	if (metadata.req) lines.push(`req: ${metadata.req}`);
	if (metadata.flow) lines.push(`flow: ${metadata.flow}`);
	if (metadata.contract) lines.push(`contract: ${metadata.contract}`);
	if (metadata.smoke) lines.push(`smoke: ${metadata.smoke}`);
	lines.push(`type: ${metadata.type}`);
	if (metadata.status) lines.push(`status: ${metadata.status}`);
	if (metadata.area) lines.push(`area: ${metadata.area}`);
	lines.push(`summary: ${metadata.summary}`);
	if (metadata.rationale) {
		lines.push("rationale: |");
		for (const line of metadata.rationale.split("\n")) {
			lines.push(`  ${line}`);
		}
	}
	if (metadata.acceptance && metadata.acceptance.length > 0) {
		lines.push("acceptance:");
		for (const criterion of metadata.acceptance) {
			lines.push(`  - ${criterion}`);
		}
	}
	if (metadata.tags && metadata.tags.length > 0) {
		lines.push(`tags: [${metadata.tags.join(", ")}]`);
	}
	if (metadata.source) {
		lines.push("source:");
		lines.push(`  type: ${metadata.source.type}`);
		lines.push(`  ref: "${metadata.source.ref}"`);
		if (metadata.source.url) lines.push(`  url: ${metadata.source.url}`);
	}
	lines.push("changed:");
	lines.push(`  - date: ${new Date().toISOString().split("T")[0]}`);
	lines.push(`    commit: pending`);
	lines.push(`    note: Initial stub created`);
	lines.push("---*/");

	// Test skeleton
	const id = metadata.req ?? metadata.flow ?? metadata.contract ?? metadata.smoke ?? "unknown";
	const describeBlock = metadata.area ?? "feature";

	lines.push("");
	lines.push(`import { describe, it } from "vitest";`);
	lines.push("");
	lines.push(`describe("${describeBlock}", () => {`);
	lines.push(`  it.todo("${metadata.summary} (${id})")`);
	lines.push(`});`);
	lines.push("");

	return lines.join("\n");
}

// =============================================================================
// Stub Rendering (for ingestion pipeline)
// =============================================================================

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function renderStub(input: StubRenderInput): { filePath: string; content: string } {
	const dir = input.requirementDir ?? "tests/requirements";
	const slug = slugify(input.summary);
	const metadata = {
		req: input.id,
		type: "unit",
		status: "pending",
		area: input.area,
		summary: input.summary,
		acceptance: input.acceptance,
		tags: ["surface-protocol", "target-repo"],
		source: input.source,
		changed: [
			{
				date: input.date,
				commit: "pending",
				note:
					input.kind === "problem"
						? "Captured via surface problem"
						: "Captured via surface capture",
			},
		],
	};

	const examples = input.acceptance.map((criterion) => `  it.todo("${criterion}")`).join("\n\n");

	return {
		filePath: `${dir}/${slug}.test.ts`,
		content: `/*---\n${stringify(metadata).trimEnd()}\n---*/\n\nimport { describe, it } from "vitest";\n\ndescribe("${input.id}: ${input.summary}", () => {\n${examples}\n});\n`,
	};
}

// =============================================================================
// Adapter Definition
// =============================================================================

export const typescriptVitestAdapter: StackAdapter = {
	name: "typescript-vitest",
	description: "TypeScript + Vitest (unit/functional) and Playwright (e2e)",

	filePatterns: [
		"**/*.test.ts",
		"**/*.test.tsx",
		"**/*.spec.ts",
		"**/*.spec.tsx",
		"**/*.e2e.spec.ts",
	],

	commentFormat: JS_BLOCK,

	stubTemplate: generateStub,

	renderStub,

	defaultRequirementDir: "tests/requirements",

	assertionPatterns: [
		/expect\s*\(/,
		/expect\.\w+\s*\(/,
		/assert\s*\.\w+\s*\(/,
		/assert\s*\(/,
		/\.toBe\s*\(/,
		/\.toEqual\s*\(/,
		/\.toMatchSnapshot\s*\(/,
		/\.toThrow\s*\(/,
		/\.toHaveBeenCalled/,
		/\.toHaveBeenCalledWith\s*\(/,
		/\.toHaveBeenCalledTimes\s*\(/,
		/\.toHaveProperty\s*\(/,
		/\.toContain\s*\(/,
		/\.toBeTruthy\s*\(/,
		/\.toBeFalsy\s*\(/,
		/\.toBeNull\s*\(/,
		/\.toBeDefined\s*\(/,
		/\.toBeInstanceOf\s*\(/,
		/\.toHaveLength\s*\(/,
		/\.rejects\./,
		/\.resolves\./,
	],

	stubPatterns: [
		/(?:it|test)\.todo\s*\(/,
		/throw\s+new\s+Error\s*\(\s*['"`]NOT\s+IMPLEMENTED['"`]\s*\)/i,
		/throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)/i,
	],

	skipPatterns: [
		/(?:it|test)\.skip\s*\(\s*['"`]/,
		/describe\.skip\s*\(/,
		// Playwright conditional skip: test.skip(true, "reason")
		/^\s*(?:it|test)\.skip\s*\(\s*(?!['"`])/m,
	],

	testCommand: "vitest run",

	describePattern: /describe\s*\(\s*['"`]([^'"`]+)['"`]/,

	itPattern: /(?:it|test)(?:\.todo)?\s*\(\s*['"`]([^'"`]+)['"`]/,
};

// Auto-register
registerAdapter(typescriptVitestAdapter);
