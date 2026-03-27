import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildYamlBlock,
	generateSummaryFromLabel,
	inferArea,
	inferTestType,
	injectYamlIntoContent,
} from "../../src/lib/backfill.js";
import { HASH_BLOCK, JS_BLOCK } from "../../src/lib/comment-formats.js";
import "../../src/lib/adapters/index.js";
import { getAdapter } from "../../src/lib/adapters/adapter.js";
import { extractAllYamlBlocks } from "../../src/lib/parser.js";

// =============================================================================
// inferArea
// =============================================================================

describe("inferArea", () => {
	it("returns area from config prefix match", () => {
		const areas = { auth: {}, billing: {} };
		expect(inferArea("src/auth/login.test.ts", areas)).toBe("auth");
		expect(inferArea("src/billing/invoice.test.ts", areas)).toBe("billing");
	});

	it("uses first meaningful path segment as fallback", () => {
		expect(inferArea("src/checkout/cart.test.ts", {})).toBe("checkout");
		expect(inferArea("tests/users/profile.test.ts", {})).toBe("users");
	});

	it("skips generic segments", () => {
		expect(inferArea("tests/auth.test.ts", {})).not.toBe("tests");
	});

	it("returns 'general' as ultimate fallback", () => {
		expect(inferArea("test.ts", {})).toBe("general");
	});
});

// =============================================================================
// inferTestType
// =============================================================================

describe("inferTestType", () => {
	const adapter = getAdapter("typescript-vitest")!;

	it("detects e2e from path", () => {
		expect(inferTestType("tests/e2e/checkout.spec.ts", adapter)).toBe("e2e");
	});

	it("detects smoke from path", () => {
		expect(inferTestType("tests/smoke/deploy.spec.ts", adapter)).toBe("smoke");
	});

	it("defaults to unit", () => {
		expect(inferTestType("tests/auth/login.test.ts", adapter)).toBe("unit");
	});

	it("detects performance from path", () => {
		expect(inferTestType("tests/perf/api.test.ts", adapter)).toBe("performance");
	});
});

// =============================================================================
// generateSummaryFromLabel
// =============================================================================

describe("generateSummaryFromLabel", () => {
	it("capitalizes first letter", () => {
		expect(generateSummaryFromLabel("validates email")).toBe("Validates email");
	});

	it("strips trailing REQ ID", () => {
		expect(generateSummaryFromLabel("validates email (REQ-001)")).toBe("Validates email");
	});

	it("prepends describe context", () => {
		expect(generateSummaryFromLabel("validates email", "auth")).toBe("auth: Validates email");
	});

	it("truncates long combined labels at 120 chars", () => {
		const longDesc = "a".repeat(100);
		const result = generateSummaryFromLabel("validates email", longDesc);
		expect(result.length).toBeLessThanOrEqual(120);
	});

	it("returns fallback for empty label", () => {
		expect(generateSummaryFromLabel("")).toBe("Untracked test");
	});
});

// =============================================================================
// buildYamlBlock
// =============================================================================

describe("buildYamlBlock", () => {
	it("generates a JS_BLOCK with required fields", () => {
		const block = buildYamlBlock(
			{ req: "REQ-001", type: "unit", area: "auth", summary: "Login test" },
			JS_BLOCK,
		);
		expect(block).toContain("/*---");
		expect(block).toContain("---*/");
		expect(block).toContain("req: REQ-001");
		expect(block).toContain("type: unit");
		expect(block).toContain("area: auth");
		expect(block).toContain("summary: Login test");
		expect(block).toContain("source:");
		expect(block).toContain("implementation");
	});

	it("generates a HASH_BLOCK with # prefixes", () => {
		const block = buildYamlBlock({ req: "REQ-001", type: "unit", summary: "Test" }, HASH_BLOCK);
		expect(block).toContain("#---");
		// Each content line should start with "# "
		const contentLines = block.split("\n").slice(1, -1);
		for (const line of contentLines) {
			expect(line).toMatch(/^# /);
		}
	});
});

// =============================================================================
// injectYamlIntoContent
// =============================================================================

describe("injectYamlIntoContent", () => {
	it("inserts YAML block before the target line", () => {
		const content = [
			"import { it } from 'vitest';",
			"",
			"describe('auth', () => {",
			"  it('validates email', () => {});",
			"});",
		].join("\n");

		const yamlBlock = "/*---\nreq: REQ-001\ntype: unit\nsummary: test\n---*/";
		const result = injectYamlIntoContent(content, 4, yamlBlock);

		const lines = result.split("\n");
		// The YAML block should appear before line 4's content
		const yamlIdx = lines.findIndex((l) => l.includes("/*---"));
		const testIdx = lines.findIndex((l) => l.includes("validates email"));
		expect(yamlIdx).toBeLessThan(testIdx);
	});

	it("does not modify other lines", () => {
		const content = "line1\nline2\nline3\n";
		const result = injectYamlIntoContent(content, 2, "BLOCK");
		expect(result).toContain("line1");
		expect(result).toContain("line2");
		expect(result).toContain("line3");
	});
});

// =============================================================================
// Round-trip injection
// =============================================================================

describe("backfill round-trip", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sp-backfill-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("injecting a YAML block increases extractAllYamlBlocks count by 1", async () => {
		const filePath = join(tmpDir, "test.test.ts");
		const content = [
			"import { it } from 'vitest';",
			"",
			"describe('auth', () => {",
			"  it('validates email', () => {});",
			"});",
		].join("\n");
		writeFileSync(filePath, content);

		const before = extractAllYamlBlocks(content);
		const yamlBlock = "/*---\nreq: REQ-001\ntype: unit\nsummary: test\n---*/";
		const updated = injectYamlIntoContent(content, 4, yamlBlock);

		const after = extractAllYamlBlocks(updated);
		expect(after.length).toBe(before.length + 1);
	});
});
