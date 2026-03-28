import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildEnrichedYamlBlock,
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
// buildEnrichedYamlBlock
// =============================================================================

describe("buildEnrichedYamlBlock", () => {
	it("includes rationale as multi-line literal block", () => {
		const block = buildEnrichedYamlBlock(
			{
				req: "REQ-001",
				type: "unit",
				area: "cli",
				summary: "CLI server configuration",
				rationale: "The CLI needs flexible server config.\nSupports local and remote modes.",
			},
			JS_BLOCK,
		);
		expect(block).toContain("rationale: |");
		expect(block).toContain("  The CLI needs flexible server config.");
		expect(block).toContain("  Supports local and remote modes.");
	});

	it("includes acceptance criteria as YAML array", () => {
		const block = buildEnrichedYamlBlock(
			{
				req: "REQ-001",
				type: "unit",
				summary: "Test",
				acceptance: ["Returns flag value when provided", "Falls back to default"],
			},
			JS_BLOCK,
		);
		expect(block).toContain("acceptance:");
		expect(block).toContain("  - Returns flag value when provided");
		expect(block).toContain("  - Falls back to default");
	});

	it("includes tags as inline YAML array", () => {
		const block = buildEnrichedYamlBlock(
			{ req: "REQ-001", type: "unit", summary: "Test", tags: ["cli", "core"] },
			JS_BLOCK,
		);
		expect(block).toContain("tags: [cli, core]");
	});

	it("produces parseable YAML that round-trips through extractAllYamlBlocks", () => {
		const block = buildEnrichedYamlBlock(
			{
				req: "REQ-042",
				type: "unit",
				area: "auth",
				summary: "Login validates credentials",
				rationale: "Core auth flow.\nMust validate before issuing tokens.",
				acceptance: ["Valid credentials return session token", "Invalid credentials return 401"],
				tags: ["auth", "security"],
			},
			JS_BLOCK,
		);

		const blocks = extractAllYamlBlocks(block);
		expect(blocks).toHaveLength(1);
		const yaml = blocks[0]?.yaml as Record<string, unknown>;
		expect(yaml.req).toBe("REQ-042");
		expect(yaml.area).toBe("auth");
		expect(yaml.rationale).toContain("Core auth flow.");
		expect(yaml.acceptance).toHaveLength(2);
		expect(yaml.tags).toEqual(["auth", "security"]);
	});

	it("omits rationale, acceptance, tags when not provided", () => {
		const block = buildEnrichedYamlBlock(
			{ req: "REQ-001", type: "unit", summary: "Simple test" },
			JS_BLOCK,
		);
		expect(block).not.toContain("rationale:");
		expect(block).not.toContain("acceptance:");
		expect(block).not.toContain("tags:");
	});

	it("quotes acceptance criteria with special YAML characters", () => {
		const block = buildEnrichedYamlBlock(
			{
				req: "REQ-001",
				type: "unit",
				summary: "Test",
				acceptance: ['Returns { status: "ok" }'],
			},
			JS_BLOCK,
		);
		// The criterion should be quoted because of braces
		expect(block).toContain("acceptance:");
		const blocks = extractAllYamlBlocks(block);
		expect(blocks).toHaveLength(1);
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

	it("matches tab indentation of the target it() line", () => {
		const content = [
			"describe('suite', () => {",
			"\tit('first test', () => {});",
			"\tit('second test', () => {});",
			"});",
		].join("\n");

		const yamlBlock = "/*---\nreq: REQ-001\ntype: unit\nsummary: test\n---*/";
		const result = injectYamlIntoContent(content, 2, yamlBlock);

		const lines = result.split("\n");
		const openLine = lines.find((l) => l.includes("/*---"));
		const closeLine = lines.find((l) => l.includes("---*/"));
		const reqLine = lines.find((l) => l.includes("req: REQ-001"));

		// All YAML lines should be tab-indented to match the it() line
		expect(openLine).toBe("\t/*---");
		expect(closeLine).toBe("\t---*/");
		expect(reqLine).toBe("\treq: REQ-001");
	});

	it("matches space indentation of the target it() line", () => {
		const content = ["describe('suite', () => {", "    it('test', () => {});", "});"].join("\n");

		const yamlBlock = "/*---\nreq: REQ-001\n---*/";
		const result = injectYamlIntoContent(content, 2, yamlBlock);

		const lines = result.split("\n");
		const openLine = lines.find((l) => l.includes("/*---"));
		expect(openLine).toBe("    /*---");
	});

	it("preserves column-0 injection when target is not indented", () => {
		const content = "it('top-level test', () => {});\n";

		const yamlBlock = "/*---\nreq: REQ-001\n---*/";
		const result = injectYamlIntoContent(content, 1, yamlBlock);

		const lines = result.split("\n");
		const openLine = lines.find((l) => l.includes("/*---"));
		expect(openLine).toBe("/*---");
	});

	it("indented blocks round-trip through extractAllYamlBlocks", () => {
		const content = [
			"describe('suite', () => {",
			"\tit('first', () => { expect(1).toBe(1); });",
			"\tit('second', () => { expect(2).toBe(2); });",
			"});",
		].join("\n");

		const yamlBlock = "/*---\nreq: REQ-001\ntype: unit\nsummary: First test\n---*/";
		const result = injectYamlIntoContent(content, 2, yamlBlock);

		const blocks = extractAllYamlBlocks(result);
		expect(blocks).toHaveLength(1);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-001");
	});

	it("multiple reverse-order injections all get correct indentation", () => {
		const content = [
			"describe('suite', () => {",
			"\tit('first', () => { expect(1).toBe(1); });",
			"\tit('second', () => { expect(2).toBe(2); });",
			"\tit('third', () => { expect(3).toBe(3); });",
			"});",
		].join("\n");

		const yamlBlock1 = "/*---\nreq: REQ-001\ntype: unit\nsummary: First\n---*/";
		const yamlBlock2 = "/*---\nreq: REQ-002\ntype: unit\nsummary: Second\n---*/";
		const yamlBlock3 = "/*---\nreq: REQ-003\ntype: unit\nsummary: Third\n---*/";

		// Inject in reverse order (bottom to top) as backfillFile does
		let result = injectYamlIntoContent(content, 4, yamlBlock3);
		result = injectYamlIntoContent(result, 3, yamlBlock2);
		result = injectYamlIntoContent(result, 2, yamlBlock1);

		const blocks = extractAllYamlBlocks(result);
		expect(blocks).toHaveLength(3);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-001");
		expect((blocks[1]?.yaml as Record<string, unknown>).req).toBe("REQ-002");
		expect((blocks[2]?.yaml as Record<string, unknown>).req).toBe("REQ-003");

		// All blocks should be tab-indented
		const lines = result.split("\n");
		const openLines = lines.filter((l) => l.includes("/*---"));
		for (const ol of openLines) {
			expect(ol).toBe("\t/*---");
		}
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
