import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI = join(import.meta.dirname, "../../dist/cli/index.js");
const FIXTURES = join(import.meta.dirname, "../fixtures");

function run(args: string[], cwd?: string): string {
	return execFileSync("node", [CLI, ...args], {
		cwd,
		encoding: "utf-8",
		timeout: 10000,
	}).trim();
}

describe("CLI smoke tests", () => {
	describe("surface --help", () => {
		it("shows usage and all commands", () => {
			const out = run(["--help"]);
			expect(out).toContain("Surface Protocol");
			expect(out).toContain("init");
			expect(out).toContain("gen");
			expect(out).toContain("check");
			expect(out).toContain("scan");
			expect(out).toContain("backfill");
			expect(out).toContain("discover");
			expect(out).toContain("query");
			expect(out).toContain("metrics");
		});
	});

	describe("surface scan --help", () => {
		it("shows scan command options", () => {
			const out = run(["scan", "--help"]);
			expect(out).toContain("drift");
			expect(out).toContain("--json");
			expect(out).toContain("--exit-code");
			expect(out).toContain("--untracked");
		});
	});

	describe("surface backfill --help", () => {
		it("shows backfill command options", () => {
			const out = run(["backfill", "--help"]);
			expect(out).toContain("--all");
			expect(out).toContain("--dry-run");
			expect(out).toContain("--file");
		});
	});

	describe("surface discover --help", () => {
		it("shows discover command options", () => {
			const out = run(["discover", "--help"]);
			expect(out).toContain("entry point");
			expect(out).toContain("--json");
			expect(out).toContain("--type");
			expect(out).toContain("--uncovered");
		});
	});

	describe("surface --version", () => {
		it("prints the version from package.json", () => {
			const out = run(["--version"]);
			expect(out).toMatch(/^\d+\.\d+\.\d+$/);
		});
	});

	describe("surface init", () => {
		let dir: string;

		beforeAll(() => {
			dir = mkdtempSync(join(tmpdir(), "sp-smoke-"));
			run(["init", "--dir", dir]);
		});

		afterAll(() => {
			rmSync(dir, { recursive: true, force: true });
		});

		it("creates surfaceprotocol.settings.json", () => {
			expect(existsSync(join(dir, "surfaceprotocol.settings.json"))).toBe(true);
			const config = JSON.parse(readFileSync(join(dir, "surfaceprotocol.settings.json"), "utf-8"));
			expect(config.adapter).toBe("typescript-vitest");
		});

		it("creates surface.json", () => {
			expect(existsSync(join(dir, "surface.json"))).toBe(true);
		});

		it("creates SURFACE.md", () => {
			expect(existsSync(join(dir, "SURFACE.md"))).toBe(true);
		});

		it("creates .surface/ state directory", () => {
			expect(existsSync(join(dir, ".surface"))).toBe(true);
		});

		it("creates CLAUDE.md routing snippet", () => {
			expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
		});

		it("accepts --adapter flag", () => {
			const dir2 = mkdtempSync(join(tmpdir(), "sp-smoke-ruby-"));
			run(["init", "--dir", dir2, "--adapter", "ruby-rspec"]);
			const config = JSON.parse(readFileSync(join(dir2, "surfaceprotocol.settings.json"), "utf-8"));
			expect(config.adapter).toBe("ruby-rspec");
			rmSync(dir2, { recursive: true, force: true });
		});
	});

	describe("surface gen", () => {
		it("generates surface map from vitest fixture", () => {
			const out = run(["gen"], join(FIXTURES, "vitest-project"));
			expect(out).toContain("surface.json");
			expect(out).toContain("SURFACE.md");
			expect(out).toContain("Total requirements: 5");
		});

		it("generates surface map from rspec fixture", () => {
			const out = run(["gen"], join(FIXTURES, "rspec-project"));
			expect(out).toContain("surface.json");
			expect(out).toContain("Total requirements: 3");
		});
	});

	describe("surface check", () => {
		it("reports coverage from vitest fixture", () => {
			const out = run(["check"], join(FIXTURES, "vitest-project"));
			expect(out).toContain("Coverage:");
			expect(out).toContain("83.3");
		});

		it("identifies dangerous requirements", () => {
			const out = run(["check"], join(FIXTURES, "vitest-project"));
			expect(out).toContain("DANGEROUS requirements: 1");
		});
	});

	describe("surface query", () => {
		it("queries dangerous requirements", () => {
			const out = run(["query", "--dangerous"], join(FIXTURES, "vitest-project"));
			expect(out).toContain("REQ-001");
			expect(out).toContain("DANGEROUS");
		});

		it("outputs JSON format", () => {
			const out = run(["query", "--dangerous", "--json"], join(FIXTURES, "vitest-project"));
			const parsed = JSON.parse(out);
			expect(parsed.requirements).toBeDefined();
			expect(parsed.requirements.length).toBeGreaterThan(0);
			expect(parsed.dangerous).toBe(true);
		});
	});
});
