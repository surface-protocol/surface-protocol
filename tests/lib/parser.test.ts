import { describe, expect, it } from "vitest";
import {
	extractAllYamlBlocks,
	extractRequirementId,
	extractYamlFrontmatter,
	getMissingFields,
	getRequirementCategory,
	hasRequiredFields,
	parseTestFileContent,
} from "../../src/lib/parser.js";

describe("extractYamlFrontmatter", () => {
	it("extracts YAML from js-block format", () => {
		const content = `/*---
req: REQ-001
type: unit
summary: Test requirement
---*/`;
		const result = extractYamlFrontmatter(content);
		expect(result).not.toBeNull();
		expect((result as Record<string, unknown>).req).toBe("REQ-001");
		expect((result as Record<string, unknown>).type).toBe("unit");
		expect((result as Record<string, unknown>).summary).toBe("Test requirement");
	});

	it("returns null for content without frontmatter", () => {
		const content = "just some code\nno yaml here";
		expect(extractYamlFrontmatter(content)).toBeNull();
	});

	it("returns null for malformed YAML", () => {
		const content = `/*---
this: is: not: valid: yaml: [
---*/`;
		expect(extractYamlFrontmatter(content)).toBeNull();
	});
});

describe("extractAllYamlBlocks", () => {
	it("extracts multiple YAML blocks", () => {
		const content = `
/*---
req: REQ-001
type: unit
summary: First test
---*/
it("first test", () => {});

/*---
req: REQ-002
type: functional
summary: Second test
---*/
it("second test", () => {});
`;
		const blocks = extractAllYamlBlocks(content);
		expect(blocks).toHaveLength(2);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-001");
		expect((blocks[1]?.yaml as Record<string, unknown>).req).toBe("REQ-002");
	});

	it("returns empty array for content without YAML", () => {
		const blocks = extractAllYamlBlocks("no yaml here");
		expect(blocks).toHaveLength(0);
	});

	it("extracts tab-indented YAML blocks inside describe()", () => {
		const content = `import { describe, it } from "vitest";
describe("feature", () => {
\t/*---
\treq: REQ-010
\ttype: unit
\tsummary: Indented block
\t---*/
\tit("first test", () => {});

\t/*---
\treq: REQ-011
\ttype: unit
\tsummary: Second indented block
\t---*/
\tit("second test", () => {});
});`;
		const blocks = extractAllYamlBlocks(content);
		expect(blocks).toHaveLength(2);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-010");
		expect((blocks[1]?.yaml as Record<string, unknown>).req).toBe("REQ-011");
	});

	it("extracts space-indented YAML blocks", () => {
		const content = `describe("feature", () => {
    /*---
    req: REQ-020
    type: unit
    summary: Space indented
    ---*/
    it("test", () => {});
});`;
		const blocks = extractAllYamlBlocks(content);
		expect(blocks).toHaveLength(1);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-020");
	});

	it("parses YAML with unquoted braces in acceptance criteria", () => {
		const content = `/*---
req: REQ-030
type: unit
summary: Health check
acceptance:
  - GET /api/health returns 200 with { status: "ok" }
  - POST /api/data accepts { name: "test" }
tags: [server, api]
---*/
it("test", () => {});`;
		const blocks = extractAllYamlBlocks(content);
		expect(blocks).toHaveLength(1);
		const yaml = blocks[0]?.yaml as Record<string, unknown>;
		expect(yaml.req).toBe("REQ-030");
		expect(yaml.acceptance).toHaveLength(2);
	});

	it("parses YAML with unquoted brackets in list items", () => {
		const content = `\t/*---
\treq: REQ-040
\ttype: unit
\tsummary: CLI parsing
\tacceptance:
\t  - Parses "launch <url>" into { command: "launch", args: [url] }
\t---*/
\tit("test", () => {});`;
		const blocks = extractAllYamlBlocks(content);
		expect(blocks).toHaveLength(1);
		expect((blocks[0]?.yaml as Record<string, unknown>).req).toBe("REQ-040");
	});
});

describe("parseTestFileContent", () => {
	it("parses a complete test file", () => {
		const content = `
import { describe, it } from "vitest";

/*---
req: REQ-042
type: functional
area: auth
summary: User login requires valid credentials
tags: [auth, security]
---*/
describe("auth", () => {
  it("requires valid credentials", () => {
    expect(true).toBe(true);
  });
});
`;
		const tests = parseTestFileContent(content, "auth.test.ts");
		expect(tests).toHaveLength(1);
		expect(tests[0]?.metadata.req).toBe("REQ-042");
		expect(tests[0]?.metadata.area).toBe("auth");
		expect(tests[0]?.location.file).toBe("auth.test.ts");
		expect(tests[0]?.location.describe).toBe("auth");
		expect(tests[0]?.location.it).toBe("requires valid credentials");
	});

	it("detects stub status for it.todo()", () => {
		const content = `
/*---
req: REQ-001
type: unit
summary: Pending test
---*/
describe("feature", () => {
  it.todo("pending test (REQ-001)");
});
`;
		const tests = parseTestFileContent(content, "test.ts");
		expect(tests[0]?.implementation?.state).toBe("stub");
		// Detection source can be "it-todo" or "no-assertions" depending on window size
		expect(["it-todo", "no-assertions"]).toContain(tests[0]?.implementation?.detected_from);
	});

	it("detects complete status for tests with assertions", () => {
		const content = `
/*---
req: REQ-001
type: unit
summary: Complete test
---*/
describe("feature", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
`;
		const tests = parseTestFileContent(content, "test.ts");
		expect(tests[0]?.implementation?.state).toBe("complete");
	});
});

describe("extractRequirementId", () => {
	it("extracts req ID", () => {
		expect(extractRequirementId({ req: "REQ-001", type: "unit", summary: "test" })).toBe("REQ-001");
	});

	it("extracts flow ID", () => {
		expect(extractRequirementId({ flow: "FLOW-001", type: "e2e", summary: "test" })).toBe(
			"FLOW-001",
		);
	});

	it("returns null when no ID present", () => {
		expect(extractRequirementId({ type: "unit", summary: "test" } as never)).toBeNull();
	});
});

describe("getRequirementCategory", () => {
	it("categorizes by prefix", () => {
		expect(getRequirementCategory("REQ-001")).toBe("requirements");
		expect(getRequirementCategory("REGR-001")).toBe("regressions");
		expect(getRequirementCategory("FLOW-001")).toBe("flows");
		expect(getRequirementCategory("CONTRACT-001")).toBe("contracts");
	});
});

describe("hasRequiredFields", () => {
	it("returns true when all required fields present", () => {
		expect(hasRequiredFields({ req: "REQ-001", type: "unit", summary: "test" })).toBe(true);
	});

	it("returns false when missing ID", () => {
		expect(hasRequiredFields({ type: "unit", summary: "test" } as never)).toBe(false);
	});
});

describe("getMissingFields", () => {
	it("lists missing fields", () => {
		const missing = getMissingFields({ type: "unit" } as never);
		expect(missing).toContain("req|flow|contract|smoke (at least one required)");
		expect(missing).toContain("summary");
	});
});
