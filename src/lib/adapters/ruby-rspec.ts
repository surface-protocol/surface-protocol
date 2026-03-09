/**
 * Ruby + RSpec Adapter
 *
 * Handles Ruby spec files using RSpec conventions. Uses the hash-block
 * comment format where each YAML line is prefixed with "# ".
 */

import { HASH_BLOCK } from "../comment-formats.js";
import type { TestMetadata } from "../types.js";
import type { StackAdapter } from "./adapter.js";
import { registerAdapter } from "./adapter.js";

// =============================================================================
// Stub Template
// =============================================================================

function generateStub(metadata: TestMetadata): string {
	const lines: string[] = [];

	// YAML frontmatter in hash-block format
	lines.push("#---");
	if (metadata.req) lines.push(`# req: ${metadata.req}`);
	if (metadata.flow) lines.push(`# flow: ${metadata.flow}`);
	if (metadata.contract) lines.push(`# contract: ${metadata.contract}`);
	if (metadata.smoke) lines.push(`# smoke: ${metadata.smoke}`);
	lines.push(`# type: ${metadata.type}`);
	if (metadata.status) lines.push(`# status: ${metadata.status}`);
	if (metadata.area) lines.push(`# area: ${metadata.area}`);
	lines.push(`# summary: ${metadata.summary}`);
	if (metadata.rationale) {
		lines.push("# rationale: |");
		for (const line of metadata.rationale.split("\n")) {
			lines.push(`#   ${line}`);
		}
	}
	if (metadata.acceptance && metadata.acceptance.length > 0) {
		lines.push("# acceptance:");
		for (const criterion of metadata.acceptance) {
			lines.push(`#   - ${criterion}`);
		}
	}
	if (metadata.tags && metadata.tags.length > 0) {
		lines.push(`# tags: [${metadata.tags.join(", ")}]`);
	}
	if (metadata.source) {
		lines.push("# source:");
		lines.push(`#   type: ${metadata.source.type}`);
		lines.push(`#   ref: "${metadata.source.ref}"`);
		if (metadata.source.url) lines.push(`#   url: ${metadata.source.url}`);
	}
	lines.push("# changed:");
	lines.push(`#   - date: ${new Date().toISOString().split("T")[0]}`);
	lines.push(`#     commit: pending`);
	lines.push(`#     note: Initial stub created`);
	lines.push("#---");

	// RSpec test skeleton
	const id = metadata.req ?? metadata.flow ?? metadata.contract ?? metadata.smoke ?? "unknown";
	const contextBlock = metadata.area ?? "feature";

	lines.push("");
	lines.push(`RSpec.describe "${contextBlock}" do`);
	lines.push(`  it "${metadata.summary} (${id})" do`);
	lines.push(`    pending "Not yet implemented"`);
	lines.push(`  end`);
	lines.push(`end`);
	lines.push("");

	return lines.join("\n");
}

// =============================================================================
// Adapter Definition
// =============================================================================

export const rubyRspecAdapter: StackAdapter = {
	name: "ruby-rspec",
	description: "Ruby + RSpec",

	filePatterns: ["**/*_spec.rb"],

	commentFormat: HASH_BLOCK,

	stubTemplate: generateStub,

	assertionPatterns: [
		// RSpec expectations
		/expect\s*\(/,
		/expect\s*\{/,
		/is_expected\.to/,
		// Legacy should syntax
		/\.should\s/,
		/\.should_not\s/,
		// Minitest-style (sometimes used in RSpec)
		/assert_equal/,
		/assert_nil/,
		/assert_raises/,
		/assert_match/,
		/assert_includes/,
		/assert\s/,
	],

	stubPatterns: [
		// pending keyword
		/^\s*pending\s+['"`]/m,
		/^\s*pending$/m,
		// Empty it blocks (no meaningful body between do/end)
		/it\s+['"`][^'"`]+['"`]\s+do\s*\n(?:\s*#[^\n]*\n)*\s*end/,
	],

	skipPatterns: [
		// skip keyword
		/^\s*skip\s+['"`]/m,
		/^\s*skip$/m,
		// x-prefixed methods
		/\bxit\s+['"`]/,
		/\bxdescribe\s+['"`]/,
		/\bxcontext\s+['"`]/,
	],

	testCommand: "bundle exec rspec",

	describePattern: /(?:RSpec\.)?(?:describe|context)\s+['"`]([^'"`]+)['"`]/,

	itPattern: /it\s+['"`]([^'"`]+)['"`]/,
};

// Auto-register
registerAdapter(rubyRspecAdapter);
