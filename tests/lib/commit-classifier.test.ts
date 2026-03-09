import { describe, expect, it } from "vitest";
import {
	buildClassifiedCommit,
	categorizeBypass,
	classifyCommit,
	extractSurfaceTrailer,
	parseCommitLine,
	parseConventionalCommit,
} from "../../src/lib/commit-classifier.js";

describe("parseCommitLine", () => {
	it("parses a valid commit line", () => {
		const result = parseCommitLine("abc1234|Alice|2026-01-15|feat(auth): add login");
		expect(result).toEqual({
			hash: "abc1234",
			author: "Alice",
			date: "2026-01-15",
			subject: "feat(auth): add login",
		});
	});

	it("returns null for invalid line", () => {
		expect(parseCommitLine("incomplete")).toBeNull();
	});

	it("handles pipes in subject", () => {
		const result = parseCommitLine("abc|Alice|2026-01-15|fix: handle A|B case");
		expect(result?.subject).toBe("fix: handle A|B case");
	});
});

describe("parseConventionalCommit", () => {
	it("parses type, scope, and summary", () => {
		expect(parseConventionalCommit("feat(auth): add login")).toEqual({
			type: "feat",
			scope: "auth",
			summary: "add login",
		});
	});

	it("handles commits without scope", () => {
		expect(parseConventionalCommit("fix: broken link")).toEqual({
			type: "fix",
			scope: "",
			summary: "broken link",
		});
	});

	it("handles non-conventional commits", () => {
		expect(parseConventionalCommit("random commit message")).toEqual({
			type: "",
			scope: "",
			summary: "random commit message",
		});
	});
});

describe("extractSurfaceTrailer", () => {
	it("extracts capture trailer", () => {
		expect(extractSurfaceTrailer("Some body\n\nSurface-Protocol: capture")).toBe("trailer-capture");
	});

	it("extracts implement trailer", () => {
		expect(extractSurfaceTrailer("Surface-Protocol: implement")).toBe("trailer-implement");
	});

	it("extracts ship trailer", () => {
		expect(extractSurfaceTrailer("Surface-Protocol: ship")).toBe("trailer-ship");
	});

	it("returns null when no trailer", () => {
		expect(extractSurfaceTrailer("no trailer here")).toBeNull();
	});

	it("returns heuristic for unknown values", () => {
		expect(extractSurfaceTrailer("Surface-Protocol: unknown-value")).toBe("heuristic");
	});
});

describe("classifyCommit", () => {
	it("classifies by trailer (highest priority)", () => {
		const result = classifyCommit("feat: something", "Surface-Protocol: capture");
		expect(result.classification).toBe("surface-routed");
		expect(result.signal).toBe("trailer-capture");
	});

	it("classifies by Affects trailer", () => {
		const result = classifyCommit("feat: something", "Affects: REQ-001, REQ-002");
		expect(result.classification).toBe("surface-routed");
		expect(result.signal).toBe("affects-trailer");
	});

	it("classifies by REQ ID in subject", () => {
		const result = classifyCommit("feat: implement REQ-042 login", "");
		expect(result.classification).toBe("surface-routed");
		expect(result.signal).toBe("req-id-in-subject");
	});

	it("classifies as bypass when no signals", () => {
		const result = classifyCommit("chore: update deps", "");
		expect(result.classification).toBe("bypass");
		expect(result.bypass_category).toBe("config");
	});
});

describe("categorizeBypass", () => {
	it("categorizes CI/build as ci-infra", () => {
		expect(categorizeBypass("ci")).toBe("ci-infra");
		expect(categorizeBypass("build")).toBe("ci-infra");
	});

	it("categorizes docs", () => {
		expect(categorizeBypass("docs")).toBe("docs");
	});

	it("categorizes chore/refactor as config", () => {
		expect(categorizeBypass("chore")).toBe("config");
		expect(categorizeBypass("refactor")).toBe("config");
	});

	it("categorizes unknown types", () => {
		expect(categorizeBypass("feat")).toBe("unknown");
	});
});

describe("buildClassifiedCommit", () => {
	it("builds a complete classified commit", () => {
		const commit = buildClassifiedCommit(
			"abc1234",
			"Alice",
			"2026-01-15",
			"feat(auth): add login",
			"Affects: REQ-001\nSurface-Protocol: implement",
		);

		expect(commit.hash).toBe("abc1234");
		expect(commit.type).toBe("feat");
		expect(commit.scope).toBe("auth");
		expect(commit.classification).toBe("surface-routed");
		expect(commit.signal).toBe("trailer-implement");
	});
});
